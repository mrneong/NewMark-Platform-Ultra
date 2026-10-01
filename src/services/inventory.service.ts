/**
 * NewMark Platform Ultra: Autonomous Inventory & Supply Chain Engine
 * Full transactional implementation with FEFO/FIFO allocations, Redlock concurrency,
 * automated threshold deficit detection, autonomous PO formulation, and batch lifecycle tracking.
 */

import { db, InventoryBatchEntity, InventoryThresholdEntity, PurchaseOrderEntity } from '../lib/db';
import { redis } from '../lib/redis';

export interface AllocationRequest {
  tenantId: string;
  sku: string;
  quantityRequested: number;
  strategy?: 'FEFO' | 'FIFO';
  warehouseId?: string;
  actorId?: string;
}

export interface AllocationBatchBreakdown {
  batchId: string;
  batchNumber: string;
  warehouseId: string;
  allocatedQty: number;
  remainingBatchQty: number;
  expirationDate: string;
  unitCost: number;
  subtotal: number;
}

export interface AllocationResult {
  success: boolean;
  sku: string;
  strategy: 'FEFO' | 'FIFO';
  quantityRequested: number;
  allocatedTotal: number;
  unfulfilledQuantity: number;
  batchesAllocated: AllocationBatchBreakdown[];
  totalCost: number;
  thresholdBreached: boolean;
  purchaseOrderGenerated?: {
    poId: string;
    poNumber: string;
    totalAmount: number;
    orderedQuantity: number;
  };
}

export interface StockSummaryItem {
  sku: string;
  productName: string;
  totalAvailable: number;
  totalAllocated: number;
  minThreshold: number;
  targetStockLevel: number;
  reorderQuantity: number;
  isBreached: boolean;
  batches: InventoryBatchEntity[];
  earliestExpiration: string | null;
  daysUntilEarliestExpiration: number | null;
  totalInventoryValuation: number;
}

export class InventoryService {
  /**
   * Retrieves aggregated inventory summary across warehouses with valuation and expiration countdown
   */
  public async getStockSummary(tenantId: string, skuFilter?: string): Promise<StockSummaryItem[]> {
    const batches = db.getBatches(tenantId, skuFilter);
    const thresholds = db.getThresholds(tenantId);
    const thresholdMap = new Map(thresholds.map(t => [t.sku, t]));

    const skuGroups: Record<string, StockSummaryItem> = {};

    for (const batch of batches) {
      if (!skuGroups[batch.sku]) {
        const thresh = thresholdMap.get(batch.sku);
        skuGroups[batch.sku] = {
          sku: batch.sku,
          productName: batch.productName,
          totalAvailable: 0,
          totalAllocated: 0,
          minThreshold: thresh?.minThreshold ?? 50,
          targetStockLevel: thresh?.targetStockLevel ?? 500,
          reorderQuantity: thresh?.reorderQuantity ?? 200,
          isBreached: false,
          batches: [],
          earliestExpiration: null,
          daysUntilEarliestExpiration: null,
          totalInventoryValuation: 0
        };
      }

      skuGroups[batch.sku].batches.push(batch);

      if (batch.status === 'AVAILABLE') {
        skuGroups[batch.sku].totalAvailable += batch.quantity;
        skuGroups[batch.sku].totalAllocated += batch.allocatedQuantity;
        skuGroups[batch.sku].totalInventoryValuation += batch.quantity * batch.unitCost;

        if (
          !skuGroups[batch.sku].earliestExpiration ||
          new Date(batch.expirationDate) < new Date(skuGroups[batch.sku].earliestExpiration!)
        ) {
          skuGroups[batch.sku].earliestExpiration = batch.expirationDate;
        }
      }
    }

    // Compute breach status and expiration countdown
    const now = Date.now();
    for (const group of Object.values(skuGroups)) {
      group.isBreached = group.totalAvailable < group.minThreshold;
      if (group.earliestExpiration) {
        const expTime = new Date(group.earliestExpiration).getTime();
        group.daysUntilEarliestExpiration = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24));
      }
    }

    return Object.values(skuGroups);
  }

  /**
   * Executes FEFO or FIFO allocation wrapped in a Redlock distributed mutex
   */
  public async allocateStock(request: AllocationRequest): Promise<AllocationResult> {
    const { tenantId, sku, quantityRequested, strategy = 'FEFO', warehouseId, actorId = 'system_allocator' } = request;

    if (!sku || sku.trim() === '') {
      throw new Error('Allocation error: SKU parameter cannot be blank.');
    }

    if (!quantityRequested || quantityRequested <= 0) {
      throw new Error('Allocation error: Requested quantity must be a positive integer.');
    }

    const lockKey = `lock:inventory:${tenantId}:${sku}`;

    // Acquire Redlock with 5000ms TTL
    const lock = await redis.acquireLock(lockKey, 5000, 3, 150);
    if (!lock) {
      throw new Error(`Concurrency Conflict: Failed to acquire distributed lock for SKU ${sku}. Resource is actively locked by another node.`);
    }

    try {
      // Fetch batches in ACID transaction
      return await db.executeTransaction(async (tx) => {
        let batches = tx.getBatches(tenantId, sku).filter(
          b => b.status === 'AVAILABLE' && b.quantity > 0 && (!warehouseId || b.warehouseId === warehouseId)
        );

        if (batches.length === 0) {
          throw new Error(`Inventory Deficit: Zero available units found for SKU '${sku}'.`);
        }

        // Apply Allocation Strategy
        if (strategy === 'FEFO') {
          // Earliest expiration date first
          batches.sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());
        } else {
          // First in (received), first out
          batches.sort((a, b) => new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime());
        }

        let remainingDemand = quantityRequested;
        let totalCost = 0;
        const allocations: AllocationBatchBreakdown[] = [];

        for (const batch of batches) {
          if (remainingDemand <= 0) break;

          const allocQty = Math.min(batch.quantity, remainingDemand);
          batch.quantity -= allocQty;
          batch.allocatedQuantity += allocQty;
          batch.updatedAt = new Date().toISOString();
          remainingDemand -= allocQty;

          const subtotal = allocQty * batch.unitCost;
          totalCost += subtotal;

          allocations.push({
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            warehouseId: batch.warehouseId,
            allocatedQty: allocQty,
            remainingBatchQty: batch.quantity,
            expirationDate: batch.expirationDate,
            unitCost: batch.unitCost,
            subtotal
          });

          tx.saveBatch(batch);
        }

        const allocatedTotal = quantityRequested - remainingDemand;

        // Log allocation in audit ledger
        tx.logAudit({
          tenantId,
          actorId,
          action: 'STOCK_ALLOCATED',
          entityType: 'INVENTORY_BATCH',
          entityId: sku,
          payloadAfter: {
            sku,
            strategy,
            quantityRequested,
            allocatedTotal,
            unfulfilledQuantity: remainingDemand,
            totalCost,
            allocations
          }
        });

        // Publish event to CQRS event stream
        redis.publish('inventory.stock.allocated', tenantId, 'InventoryService.allocateStock', {
          sku,
          strategy,
          allocatedTotal,
          unfulfilledQuantity: remainingDemand,
          totalCost,
          allocations
        });

        // Evaluate if safety threshold is breached after decrement
        const breachResult = await this.evaluateThresholdAndTriggerRestock(tenantId, sku);

        return {
          success: allocatedTotal > 0,
          sku,
          strategy,
          quantityRequested,
          allocatedTotal,
          unfulfilledQuantity: remainingDemand,
          batchesAllocated: allocations,
          totalCost,
          thresholdBreached: breachResult.breached,
          purchaseOrderGenerated: breachResult.generatedPO
        };
      });
    } finally {
      await lock.release();
    }
  }

  /**
   * Autonomous Restocking Evaluator
   * If stock < minThreshold, emits a Kafka domain event and automatically drafts
   * an enterprise Purchase Order in PENDING_SUPERVISOR_APPROVAL status.
   */
  public async evaluateThresholdAndTriggerRestock(
    tenantId: string,
    sku: string
  ): Promise<{ breached: boolean; generatedPO?: { poId: string; poNumber: string; totalAmount: number; orderedQuantity: number } }> {
    const threshold = db.getThresholdBySku(tenantId, sku);
    if (!threshold || !threshold.autoRestockEnabled) {
      return { breached: false };
    }

    const batches = db.getBatches(tenantId, sku).filter(b => b.status === 'AVAILABLE');
    const totalAvailable = batches.reduce((acc, b) => acc + b.quantity, 0);

    if (totalAvailable < threshold.minThreshold) {
      // Check if a pending PO is already active to prevent duplicates
      const pendingPOs = db.getPurchaseOrders(tenantId, 'PENDING_SUPERVISOR_APPROVAL');
      const alreadyHasPendingPO = pendingPOs.some(po =>
        po.lineItems.some(item => item.sku === sku)
      );

      if (alreadyHasPendingPO) {
        console.log(`[AUTONOMOUS OPS] Pending PO already active for ${sku}. Skipping duplicate PO creation.`);
        return { breached: true };
      }

      // Publish Kafka domain event: inventory.threshold.breach
      redis.publish('inventory.threshold.breach', tenantId, 'AutonomousOpsAgent', {
        sku,
        currentStock: totalAvailable,
        minThreshold: threshold.minThreshold,
        deficit: threshold.targetStockLevel - totalAvailable,
        targetStockLevel: threshold.targetStockLevel,
        recommendedReorderQuantity: threshold.reorderQuantity,
        primarySupplierId: threshold.primarySupplierId
      });

      // Formulate formal Purchase Order
      const sampleBatch = batches[0];
      const unitPrice = sampleBatch?.unitCost ?? 250.0;
      const orderQty = Math.max(threshold.reorderQuantity, threshold.targetStockLevel - totalAvailable);
      const totalAmount = orderQty * unitPrice;
      const poNumber = `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const newPO: PurchaseOrderEntity = {
        id: `po_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        tenantId,
        poNumber,
        supplierId: threshold.primarySupplierId,
        supplierName: `Primary Vendor (${threshold.primarySupplierId})`,
        status: 'PENDING_SUPERVISOR_APPROVAL',
        totalAmount,
        currency: 'USD',
        notes: `Autonomous procurement order generated by Ops Agent: Available stock (${totalAvailable}) breached safety minimum (${threshold.minThreshold}).`,
        triggerReason: 'STOCK_DEFICIT_BREACH',
        requestedByAgent: 'OPS_INVENTORY_AGENT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lineItems: [
          {
            id: `li_${Date.now()}_01`,
            sku,
            productName: sampleBatch?.productName || sku,
            quantity: orderQty,
            unitPrice,
            totalAmount
          }
        ]
      };

      db.savePurchaseOrder(newPO);
      threshold.lastTriggeredAt = new Date().toISOString();
      db.saveThreshold(threshold);

      // Publish Kafka domain event: po.created
      redis.publish('po.created', tenantId, 'AutonomousOpsAgent', {
        poId: newPO.id,
        poNumber: newPO.poNumber,
        totalAmount: newPO.totalAmount,
        sku,
        quantity: orderQty,
        status: newPO.status
      });

      return {
        breached: true,
        generatedPO: {
          poId: newPO.id,
          poNumber: newPO.poNumber,
          totalAmount: newPO.totalAmount,
          orderedQuantity: orderQty
        }
      };
    }

    return { breached: false };
  }

  /**
   * Receives inbound shipment batch into warehouse with validation and event dispatch
   */
  public async receiveBatch(
    tenantId: string,
    warehouseId: string,
    sku: string,
    productName: string,
    batchNumber: string,
    quantity: number,
    unitCost: number,
    expirationDate: string,
    actorId: string = 'warehouse_receiver'
  ): Promise<InventoryBatchEntity> {
    if (!sku || !batchNumber || quantity <= 0 || unitCost <= 0) {
      throw new Error('Invalid batch intake parameters: SKU, batchNumber, positive quantity, and cost required.');
    }

    const parsedExp = new Date(expirationDate);
    if (isNaN(parsedExp.getTime())) {
      throw new Error('Invalid expirationDate: Must be a valid ISO-8601 date string.');
    }

    const newBatch: InventoryBatchEntity = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tenantId,
      warehouseId,
      sku,
      productName,
      batchNumber,
      quantity,
      allocatedQuantity: 0,
      unitCost,
      receivedDate: new Date().toISOString(),
      expirationDate: parsedExp.toISOString(),
      status: 'AVAILABLE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.saveBatch(newBatch);

    db.logAudit({
      tenantId,
      actorId,
      action: 'BATCH_RECEIVED',
      entityType: 'INVENTORY_BATCH',
      entityId: newBatch.id,
      payloadAfter: newBatch
    });

    redis.publish('inventory.batch.received', tenantId, 'InventoryService.receiveBatch', {
      batchId: newBatch.id,
      sku,
      batchNumber,
      warehouseId,
      quantity,
      expirationDate: newBatch.expirationDate
    });

    return newBatch;
  }

  /**
   * Scans all batches and auto-quarantines expired batches
   */
  public async quarantineExpiredBatches(tenantId: string): Promise<InventoryBatchEntity[]> {
    const now = new Date().toISOString();
    const batches = db.getBatches(tenantId);
    const quarantined: InventoryBatchEntity[] = [];

    for (const b of batches) {
      if (b.status === 'AVAILABLE' && b.expirationDate < now) {
        b.status = 'EXPIRED';
        b.updatedAt = new Date().toISOString();
        db.saveBatch(b);
        quarantined.push(b);

        redis.publish('inventory.batch.quarantined', tenantId, 'InventoryService.quarantineExpiredBatches', {
          batchId: b.id,
          batchNumber: b.batchNumber,
          sku: b.sku,
          expiredAt: b.expirationDate
        });
      }
    }

    return quarantined;
  }
}

export const inventoryService = new InventoryService();
