/**
 * NewMark Platform Ultra: Autonomous Inventory Restocking & FEFO Allocation Engine
 * Monitors stock thresholds across distributed warehouses, executes FEFO batch decrements,
 * triggers autonomous Purchase Orders upon safety breaches, and orchestrates financial clearing.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Package, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  ArrowRight, 
  Plus, 
  Layers, 
  TrendingDown, 
  FileCheck,
  ShieldCheck,
  Zap,
  RotateCw
} from 'lucide-react';
import { DataGrid, ColumnDef } from './DataGrid';
import { useLanguage } from '../i18n/context';

export function InventoryRestockEngine() {
  const { dictionary, formatCurrency, formatDateTime } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedSku, setSelectedSku] = useState<string>('SKU-TITAN-SENS');
  const [allocateQty, setAllocateQty] = useState<number>(15);
  const [allocationMessage, setAllocationMessage] = useState<string | null>(null);

  // New Batch Modal State
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [newBatch, setNewBatch] = useState({
    sku: 'SKU-TITAN-SENS',
    productName: 'Titanium High-Precision Inertial IMU Sensor',
    batchNumber: `BATCH-${Date.now().toString().slice(-4)}`,
    quantity: 100,
    unitCost: 145.0,
    expirationDate: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0]
  });

  // Query Stock Summary
  const { data: stockItems = [], isLoading: isLoadingStock } = useQuery<any[]>({
    queryKey: ['inventory-summary'],
    queryFn: async () => {
      const res = await fetch('/api/v1/inventory/summary');
      const json = await res.json();
      return json.data || [];
    }
  });

  // Query Batches
  const { data: batches = [], isLoading: isLoadingBatches } = useQuery<any[]>({
    queryKey: ['inventory-batches', selectedSku],
    queryFn: async () => {
      const res = await fetch(`/api/v1/inventory/batches?sku=${selectedSku}`);
      const json = await res.json();
      return json.data || [];
    }
  });

  // Query Purchase Orders
  const { data: purchaseOrders = [], isLoading: isLoadingPOs } = useQuery<any[]>({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const res = await fetch('/api/v1/inventory/orders');
      const json = await res.json();
      return json.data || [];
    }
  });

  // Query Financial Transactions
  const { data: transactions = [] } = useQuery<any[]>({
    queryKey: ['financial-transactions'],
    queryFn: async () => {
      const res = await fetch('/api/v1/inventory/transactions');
      const json = await res.json();
      return json.data || [];
    }
  });

  // Mutation: Allocate Stock via FEFO
  const allocateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/inventory/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: selectedSku,
          quantity: allocateQty,
          strategy: 'FEFO'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });

      let msg = `Successfully allocated ${data.allocatedTotal} units of ${data.sku} across ${data.batchesAllocated.length} batch(es). Total cost: $${data.totalCost.toFixed(2)}.`;
      if (data.thresholdBreached) {
        msg += ' ⚠️ SAFETY THRESHOLD BREACH DETECTED: Autonomous Purchase Order generated for Supervisor approval!';
      }
      setAllocationMessage(msg);
      setTimeout(() => setAllocationMessage(null), 7000);
    },
    onError: (err: any) => {
      alert(`Allocation failed: ${err.message}`);
    }
  });

  // Mutation: Receive Batch
  const receiveBatchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/inventory/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newBatch,
          expirationDate: new Date(newBatch.expirationDate).toISOString()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      setShowReceiveModal(false);
      setNewBatch(prev => ({
        ...prev,
        batchNumber: `BATCH-${Date.now().toString().slice(-4)}`
      }));
    },
    onError: (err: any) => {
      alert(`Error receiving batch: ${err.message}`);
    }
  });

  // Mutation: Approve PO
  const approvePOMutation = useMutation({
    mutationFn: async (poId: string) => {
      const res = await fetch(`/api/v1/inventory/orders/${poId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approverId: 'supervisor.planner@newmark.ultra' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    }
  });

  // Mutation: Disburse Payment
  const disburseMutation = useMutation({
    mutationFn: async (poId: string) => {
      const invNum = `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
      const res = await fetch(`/api/v1/inventory/orders/${poId}/disburse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceNumber: invNum })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
    }
  });

  // Columns for Batch DataGrid
  const batchColumns: ColumnDef<any>[] = [
    { key: 'batchNumber', header: 'Batch #', sortable: true },
    { key: 'quantity', header: 'Available Units', type: 'number', sortable: true },
    { key: 'allocatedQuantity', header: 'Allocated', type: 'number', sortable: true },
    {
      key: 'unitCost',
      header: 'Unit Cost',
      sortable: true,
      render: (r) => <span className="font-mono text-cyan-300">${Number(r.unitCost).toFixed(2)}</span>
    },
    {
      key: 'expirationDate',
      header: 'Expiration Date (FEFO Target)',
      sortable: true,
      render: (r) => {
        const d = new Date(r.expirationDate);
        const daysLeft = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return (
          <div className="flex items-center gap-2">
            <span className="font-mono text-slate-200">{d.toLocaleDateString()}</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
              daysLeft < 60 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-slate-800 text-slate-400'
            }`}>
              {daysLeft > 0 ? `${daysLeft}d left` : 'EXPIRED'}
            </span>
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      type: 'badge',
      badgeColorMap: {
        AVAILABLE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        RESERVED: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        EXPIRED: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
      }
    }
  ];

  // Columns for Purchase Orders DataGrid
  const poColumns: ColumnDef<any>[] = [
    { key: 'poNumber', header: 'PO Number', sortable: true },
    { key: 'supplierName', header: 'Supplier', sortable: true },
    {
      key: 'totalAmount',
      header: 'Total Value',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-emerald-400">${Number(r.totalAmount).toLocaleString()}</span>
    },
    {
      key: 'status',
      header: 'Status',
      type: 'badge',
      badgeColorMap: {
        PENDING_SUPERVISOR_APPROVAL: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        APPROVED: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
        FULFILLED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
      }
    },
    {
      key: 'triggerReason',
      header: 'Autonomous Trigger',
      render: (r) => <span className="font-mono text-[10px] text-slate-400">{r.triggerReason || 'MANUAL'}</span>
    },
    {
      key: '_actions',
      header: 'Workflow Actions',
      render: (r) => (
        <div className="flex items-center gap-2">
          {r.status === 'PENDING_SUPERVISOR_APPROVAL' && (
            <button
              onClick={() => approvePOMutation.mutate(r.id)}
              disabled={approvePOMutation.isPending}
              className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold shadow transition-colors"
            >
              Approve PO
            </button>
          )}
          {r.status === 'APPROVED' && (
            <button
              onClick={() => disburseMutation.mutate(r.id)}
              disabled={disburseMutation.isPending}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow transition-colors"
            >
              Disburse Payment
            </button>
          )}
          {r.status === 'FULFILLED' && (
            <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Reconciled
            </span>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Title & Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/90 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">{dictionary.inventory.title}</h2>
            <p className="text-xs text-slate-400">
              {dictionary.inventory.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowReceiveModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{dictionary.inventory.receiveBatchButton}</span>
          </button>
        </div>
      </div>

      {/* Allocation Message Notification */}
      {allocationMessage && (
        <div className="p-3 bg-cyan-950/40 border border-cyan-500/40 rounded-xl text-cyan-200 text-xs flex items-center gap-2 font-mono animate-fadeIn">
          <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{allocationMessage}</span>
        </div>
      )}

      {/* SKU Metrics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stockItems.map(item => (
          <div
            key={item.sku}
            onClick={() => setSelectedSku(item.sku)}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedSku === item.sku
                ? 'bg-slate-900 border-cyan-500/80 shadow-lg shadow-cyan-500/10'
                : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900/90 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-slate-400 font-bold">{item.sku}</span>
              {item.isBreached ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-mono font-bold animate-pulse">
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  {dictionary.inventory.breachBadge}
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  {dictionary.inventory.safeBadge}
                </span>
              )}
            </div>

            <h4 className="text-xs font-semibold text-slate-100 mt-2 line-clamp-1">{item.productName}</h4>

            <div className="mt-3 flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold font-mono text-white">{item.totalAvailable}</span>
                <span className="text-xs text-slate-500">/ {item.minThreshold} min</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">{item.batches.length} Batches</span>
            </div>

            {/* Visual Stock Level Progress Bar */}
            <div className="mt-2 w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  item.isBreached ? 'bg-rose-500' : 'bg-cyan-500'
                }`}
                style={{ width: `${Math.min(100, (item.totalAvailable / item.targetStockLevel) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* FEFO Allocation Terminal */}
      <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200 font-mono">{dictionary.inventory.allocateStockTitle}</h4>
            <p className="text-[11px] text-slate-400">
              {dictionary.inventory.allocateStockSubtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-slate-400">{dictionary.inventory.selectedSku}</span>
          <span className="text-cyan-400 font-bold">{selectedSku}</span>

          <span className="text-slate-400 ml-2">{dictionary.inventory.unitsLabel}</span>
          <input
            type="number"
            min={1}
            max={200}
            value={allocateQty}
            onChange={e => setAllocateQty(Number(e.target.value))}
            className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-white"
          />

          <button
            onClick={() => allocateMutation.mutate()}
            disabled={allocateMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg font-semibold shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
          >
            <span>{dictionary.inventory.allocateButton}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Batches for Selected SKU */}
      <DataGrid
        data={batches}
        columns={batchColumns}
        idField="id"
        title={`${dictionary.inventory.batchesTableTitle} ${selectedSku}`}
        subtitle={dictionary.inventory.batchesTableSubtitle}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['inventory-batches', selectedSku] })}
        isLoading={isLoadingBatches}
      />

      {/* Autonomous Purchase Orders & Ledger Clearing */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 font-mono flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-cyan-400" />
            <span>{dictionary.inventory.purchaseOrdersTitle} ({purchaseOrders.length})</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {purchaseOrders.filter(po => po.status === 'PENDING_SUPERVISOR_APPROVAL').length} {dictionary.inventory.pendingApprovalSummary}
          </span>
        </div>

        <DataGrid
          data={purchaseOrders}
          columns={poColumns}
          idField="id"
          title={dictionary.inventory.purchaseOrdersTitle}
          subtitle={dictionary.inventory.purchaseOrdersSubtitle}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })}
          isLoading={isLoadingPOs}
        />
      </div>

      {/* Modal: Receive New Batch */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Receive Inbound Batch to Warehouse
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 font-mono">SKU Identifier</label>
                <select
                  value={newBatch.sku}
                  onChange={e => {
                    const chosen = stockItems.find(s => s.sku === e.target.value);
                    setNewBatch({
                      ...newBatch,
                      sku: e.target.value,
                      productName: chosen?.productName || e.target.value
                    });
                  }}
                  className="w-full mt-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-cyan-300 font-mono"
                >
                  {stockItems.map(s => (
                    <option key={s.sku} value={s.sku}>{s.sku} ({s.productName})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-mono">Batch Number</label>
                <input
                  type="text"
                  value={newBatch.batchNumber}
                  onChange={e => setNewBatch({ ...newBatch, batchNumber: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 font-mono">Quantity</label>
                  <input
                    type="number"
                    value={newBatch.quantity}
                    onChange={e => setNewBatch({ ...newBatch, quantity: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 font-mono">Unit Cost ($)</label>
                  <input
                    type="number"
                    value={newBatch.unitCost}
                    onChange={e => setNewBatch({ ...newBatch, unitCost: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-mono">Expiration Date (FEFO Target)</label>
                <input
                  type="date"
                  value={newBatch.expirationDate}
                  onChange={e => setNewBatch({ ...newBatch, expirationDate: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowReceiveModal(false)}
                className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => receiveBatchMutation.mutate()}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold shadow"
              >
                Commit Batch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
