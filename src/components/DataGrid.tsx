/**
 * NewMark Platform Ultra: High-Density Production DataGrid
 * Implements multi-column sorting, real-time search filtering, dynamic pagination,
 * inline cell editing, column visibility customization, and CSV/JSON export.
 */

import React, { useState, useMemo } from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  Search, 
  Download, 
  Check, 
  X, 
  Edit2, 
  Filter,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileCode
} from 'lucide-react';
import { useLanguage } from '../i18n/context';

export interface ColumnDef<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  editable?: boolean;
  type?: 'text' | 'number' | 'boolean' | 'badge';
  badgeColorMap?: Record<string, string>;
  sortable?: boolean;
  width?: string;
}

interface DataGridProps<T extends Record<string, any>> {
  data: T[];
  columns: ColumnDef<T>[];
  idField: string;
  title?: string;
  subtitle?: string;
  onRowUpdate?: (id: string, updatedFields: Partial<T>) => Promise<void> | void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function DataGrid<T extends Record<string, any>>({
  data,
  columns,
  idField,
  title,
  subtitle,
  onRowUpdate,
  onRefresh,
  isLoading
}: DataGridProps<T>) {
  const { dictionary } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editingCell, setEditingCell] = useState<{ id: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() =>
    columns.reduce((acc, col) => ({ ...acc, [col.key]: true }), {})
  );
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Sorting Handler
  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else {
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Filtered & Sorted Rows
  const filteredData = useMemo(() => {
    let result = [...data];

    // Global Search across visible columns
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(row =>
        columns.some(col => {
          if (!visibleColumns[col.key]) return false;
          const val = row[col.key];
          return val !== undefined && val !== null && String(val).toLowerCase().includes(lower);
        })
      );
    }

    // Sorting
    if (sortKey) {
      result.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        
        let comparison = 0;
        if (typeof valA === 'number' && typeof valB === 'number') {
          comparison = valA - valB;
        } else {
          comparison = String(valA).localeCompare(String(valB));
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [data, searchTerm, sortKey, sortDirection, columns, visibleColumns]);

  // Paginated Rows
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page, pageSize]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;

  // Inline Cell Editing
  const startEditing = (id: string, key: string, initialValue: any) => {
    setEditingCell({ id, key });
    setEditValue(initialValue !== undefined && initialValue !== null ? String(initialValue) : '');
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const commitEdit = async (id: string, key: string) => {
    if (onRowUpdate) {
      const col = columns.find(c => c.key === key);
      let parsedValue: any = editValue;
      if (col?.type === 'number') {
        const n = parseFloat(editValue);
        parsedValue = isNaN(n) ? 0 : n;
      } else if (col?.type === 'boolean') {
        parsedValue = editValue.toLowerCase() === 'true';
      }
      await onRowUpdate(id, { [key]: parsedValue } as any);
    }
    setEditingCell(null);
  };

  // Export CSV
  const exportCSV = () => {
    const activeCols = columns.filter(c => visibleColumns[c.key]);
    const headers = activeCols.map(c => `"${c.header}"`).join(',');
    const rows = filteredData.map(row =>
      activeCols.map(c => {
        const val = row[c.key];
        return `"${val !== undefined && val !== null ? String(val).replace(/"/g, '""') : ''}"`;
      }).join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `${title || 'export'}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export JSON
  const exportJSON = () => {
    const jsonContent = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredData, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonContent);
    link.setAttribute('download', `${title || 'export'}_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeColumnsList = columns.filter(c => visibleColumns[c.key]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Table Header Bar */}
      <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-950/70">
        <div>
          {title && (
            <h3 className="text-base font-bold text-slate-100 tracking-tight flex items-center gap-2 font-sans">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              {title}
            </h3>
          )}
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={dictionary.datagrid.searchPlaceholder}
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
              className="pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors w-48 lg:w-60"
            />
          </div>

          {/* Column Visibility Selector */}
          <div className="relative">
            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              title={dictionary.datagrid.customizeColumns}
              className="p-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            {showColumnSelector && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-2xl z-30 space-y-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block border-b border-slate-800 pb-1">
                  {dictionary.datagrid.visibleColumns}
                </span>
                <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
                  {columns.map(col => (
                    <label key={col.key} className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer py-0.5">
                      <input
                        type="checkbox"
                        checked={visibleColumns[col.key] !== false}
                        onChange={e => setVisibleColumns({ ...visibleColumns, [col.key]: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                      />
                      <span className="truncate">{col.header}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title={dictionary.datagrid.refreshTooltip}
              className="p-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-cyan-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* Export Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={exportCSV}
              title="Export CSV"
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>{dictionary.datagrid.exportCsv}</span>
            </button>
            <button
              onClick={exportJSON}
              title="Export JSON"
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              <FileCode className="w-3.5 h-3.5 text-cyan-400" />
              <span>{dictionary.datagrid.exportJson}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-800">
            <tr>
              {activeColumnsList.map(col => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={`py-3 px-4 select-none ${col.sortable !== false ? 'cursor-pointer hover:text-cyan-400' : ''}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {col.sortable !== false && (
                      <span className="text-slate-600">
                        {sortKey === col.key ? (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-cyan-400" /> : <ChevronDown className="w-3 h-3 text-cyan-400" />
                        ) : (
                          <ChevronUp className="w-3 h-3 opacity-20" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={activeColumnsList.length} className="text-center py-10 text-slate-500 font-mono text-xs">
                  {isLoading ? dictionary.datagrid.syncingDataset : dictionary.datagrid.noMatchingRecords}
                </td>
              </tr>
            ) : (
              paginatedData.map(row => {
                const rowId = String(row[idField]);
                return (
                  <tr key={rowId} className="hover:bg-slate-800/40 transition-colors group">
                    {activeColumnsList.map(col => {
                      const isEditing = editingCell?.id === rowId && editingCell?.key === col.key;
                      const rawValue = row[col.key];

                      return (
                        <td key={col.key} className="py-2.5 px-4 whitespace-nowrap">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type={col.type === 'number' ? 'number' : 'text'}
                                value={editValue}
                                autoFocus
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') commitEdit(rowId, col.key);
                                  if (e.key === 'Escape') cancelEditing();
                                }}
                                className="px-2 py-0.5 bg-slate-950 border border-cyan-500 rounded text-xs text-white focus:outline-none"
                              />
                              <button
                                onClick={() => commitEdit(rowId, col.key)}
                                className="p-0.5 text-emerald-400 hover:text-emerald-300"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="p-0.5 text-rose-400 hover:text-rose-300"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between group/cell">
                              <div>
                                {col.render ? (
                                  col.render(row)
                                ) : col.type === 'badge' ? (
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                                    col.badgeColorMap?.[String(rawValue)] || 'bg-slate-800 text-slate-300 border-slate-700'
                                  }`}>
                                    {String(rawValue ?? 'N/A')}
                                  </span>
                                ) : (
                                  <span className="font-mono text-slate-200">
                                    {rawValue !== undefined && rawValue !== null ? String(rawValue) : '—'}
                                  </span>
                                )}
                              </div>

                              {col.editable && onRowUpdate && (
                                <button
                                  onClick={() => startEditing(rowId, col.key, rawValue)}
                                  className="opacity-0 group-hover/cell:opacity-100 text-slate-500 hover:text-cyan-400 transition-opacity ml-2"
                                  title={dictionary.datagrid.editCellTooltip}
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span>{dictionary.datagrid.rowsPerPage}</span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="ml-2">
            {dictionary.datagrid.showingRecords} {filteredData.length === 0 ? 0 : (page - 1) * pageSize + 1} - {Math.min(page * pageSize, filteredData.length)} {dictionary.datagrid.pageOf} {filteredData.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>{dictionary.datagrid.prevPage}</span>
          </button>
          <span className="text-slate-300 font-medium">Page {page} {dictionary.datagrid.pageOf} {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <span>{dictionary.datagrid.nextPage}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
