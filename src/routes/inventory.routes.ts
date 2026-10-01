/**
 * NewMark Platform Ultra: Inventory & Procurement Router
 * Maps routes to InventoryController handlers with RBAC permission enforcement.
 */

import { Router } from 'express';
import { InventoryController } from '../controllers/inventory.controller';
import { requirePermission } from '../middleware/auth';

export const inventoryRouter = Router();

// Stock & Batch Inspection
inventoryRouter.get(
  '/summary',
  requirePermission('inventory:read'),
  InventoryController.getStockSummary
);

inventoryRouter.get(
  '/batches',
  requirePermission('inventory:read'),
  InventoryController.getBatches
);

// Transactional Mutations
inventoryRouter.post(
  '/allocate',
  requirePermission('inventory:allocate'),
  InventoryController.allocateStock
);

inventoryRouter.post(
  '/receive',
  requirePermission('inventory:receive'),
  InventoryController.receiveBatch
);

inventoryRouter.post(
  '/quarantine-expired',
  requirePermission('inventory:quarantine'),
  InventoryController.quarantineExpired
);

// Purchase Orders & Workflow
inventoryRouter.get(
  '/orders',
  requirePermission('po:read'),
  InventoryController.getPurchaseOrders
);

inventoryRouter.post(
  '/orders/:id/approve',
  requirePermission('po:approve'),
  InventoryController.approvePurchaseOrder
);

// Financial Clearing & Ledger
inventoryRouter.post(
  '/orders/:id/disburse',
  requirePermission('finance:disburse'),
  InventoryController.disbursePayment
);

inventoryRouter.get(
  '/transactions',
  requirePermission('finance:read'),
  InventoryController.getFinancialTransactions
);
