/**
 * NewMark Platform Ultra: Dynamic Schema & Object Manager
 * Allows defining custom business schemas on the fly, validating dynamic payloads,
 * managing entity records with RLS, and inspecting immutable audit logs.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Database, 
  Plus, 
  Layers, 
  ShieldAlert, 
  CheckCircle, 
  FileText, 
  Trash2, 
  Table, 
  Code,
  Key,
  Calendar,
  ToggleLeft
} from 'lucide-react';
import { DataGrid, ColumnDef } from './DataGrid';
import { useLanguage } from '../i18n/context';

interface CustomObject {
  id: string;
  name: string;
  apiName: string;
  description: string;
  icon: string;
  primaryField: string;
  fields: {
    id: string;
    name: string;
    apiName: string;
    type: string;
    isRequired: boolean;
    defaultValue?: any;
    validationRules?: any;
  }[];
}

interface DynamicRecord {
  id: string;
  customObjectId: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export function DynamicSchemaManager() {
  const { dictionary } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [showCreateSchemaModal, setShowCreateSchemaModal] = useState(false);
  const [showCreateRecordModal, setShowCreateRecordModal] = useState(false);
  const [recordFormPayload, setRecordFormPayload] = useState<Record<string, any>>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  // New Schema Definition State
  const [newSchema, setNewSchema] = useState({
    name: '',
    apiName: '',
    description: '',
    fields: [
      { name: 'Asset Code', apiName: 'assetCode', type: 'STRING', isRequired: true },
      { name: 'Calibration Score', apiName: 'calibrationScore', type: 'NUMBER', isRequired: false }
    ]
  });

  // Query Custom Objects
  const { data: objects = [], isLoading: isLoadingObjects } = useQuery<CustomObject[]>({
    queryKey: ['custom-objects'],
    queryFn: async () => {
      const res = await fetch('/api/v1/objects');
      const json = await res.json();
      return json.data || [];
    }
  });

  // Select first object by default
  React.useEffect(() => {
    if (objects.length > 0 && !selectedObjectId) {
      setSelectedObjectId(objects[0].id);
    }
  }, [objects, selectedObjectId]);

  const activeObject = objects.find(o => o.id === selectedObjectId);

  // Query Records for active object
  const { data: records = [], isLoading: isLoadingRecords } = useQuery<DynamicRecord[]>({
    queryKey: ['custom-records', selectedObjectId],
    queryFn: async () => {
      if (!selectedObjectId) return [];
      const res = await fetch(`/api/v1/objects/${selectedObjectId}/records`);
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!selectedObjectId
  });

  // Query Audit Logs
  const { data: auditLogs = [] } = useQuery<any[]>({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const res = await fetch('/api/v1/audit-logs');
      const json = await res.json();
      return json.data || [];
    }
  });

  // Create Schema Mutation
  const createSchemaMutation = useMutation({
    mutationFn: async (payload: typeof newSchema) => {
      const res = await fetch('/api/v1/objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data.data;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['custom-objects'] });
      setSelectedObjectId(created.id);
      setShowCreateSchemaModal(false);
      setNewSchema({
        name: '',
        apiName: '',
        description: '',
        fields: [{ name: 'Name', apiName: 'name', type: 'STRING', isRequired: true }]
      });
    },
    onError: (err: any) => {
      alert(`Error creating schema: ${err.message}`);
    }
  });

  // Create Record Mutation
  const createRecordMutation = useMutation({
    mutationFn: async () => {
      if (!selectedObjectId) return;
      const res = await fetch(`/api/v1/objects/${selectedObjectId}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordFormPayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-records', selectedObjectId] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setShowCreateRecordModal(false);
      setRecordFormPayload({});
      setValidationError(null);
    },
    onError: (err: any) => {
      setValidationError(err.message);
    }
  });

  // Inline update handler
  const handleRecordUpdate = async (recordId: string, updatedFields: Record<string, any>) => {
    try {
      const res = await fetch(`/api/v1/objects/${selectedObjectId}/records/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ['custom-records', selectedObjectId] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  // Build dynamic columns for DataGrid based on schema fields
  const dynamicColumns: ColumnDef<any>[] = React.useMemo(() => {
    if (!activeObject) return [];

    const cols: ColumnDef<any>[] = activeObject.fields.map(f => ({
      key: f.apiName,
      header: f.name + (f.isRequired ? ' *' : ''),
      editable: true,
      type: f.type === 'NUMBER' ? 'number' : f.type === 'BOOLEAN' ? 'boolean' : 'text',
      sortable: true
    }));

    cols.push({
      key: 'createdAt',
      header: 'Created At',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-slate-500 text-[11px]">
          {new Date(row.createdAt).toLocaleDateString()} {new Date(row.createdAt).toLocaleTimeString()}
        </span>
      )
    });

    cols.push({
      key: '_actions',
      header: 'Actions',
      sortable: false,
      render: (row) => (
        <button
          onClick={async () => {
            if (confirm('Delete this dynamic record?')) {
              await fetch(`/api/v1/objects/${selectedObjectId}/records/${row.id}`, { method: 'DELETE' });
              queryClient.invalidateQueries({ queryKey: ['custom-records', selectedObjectId] });
              queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
            }
          }}
          className="text-rose-400 hover:text-rose-300 p-1"
          title="Delete record"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )
    });

    return cols;
  }, [activeObject, selectedObjectId, queryClient]);

  // Flattened record data for grid
  const gridRows = React.useMemo(() => {
    return records.map(r => ({
      id: r.id,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      ...r.data
    }));
  }, [records]);

  return (
    <div className="space-y-6">
      {/* Schema Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/90 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">{dictionary.schemas.title}</h2>
            <p className="text-xs text-slate-400">
              {dictionary.schemas.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateSchemaModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{dictionary.schemas.defineNewSchemaButton}</span>
          </button>
        </div>
      </div>

      {/* Schema Object Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {objects.map(obj => (
          <button
            key={obj.id}
            onClick={() => setSelectedObjectId(obj.id)}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-medium border transition-all ${
              selectedObjectId === obj.id
                ? 'bg-slate-800 border-cyan-500/80 text-white shadow-lg shadow-cyan-500/10'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <Table className="w-3.5 h-3.5 text-cyan-400" />
            <span>{obj.name}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono text-slate-400 border border-slate-700">
              {obj.fields.length} {dictionary.schemas.fieldsCount}
            </span>
          </button>
        ))}
      </div>

      {/* Active Object Details & Actions */}
      {activeObject && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-200 font-mono">{activeObject.apiName}</span>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-xs text-slate-400">{activeObject.description}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {activeObject.fields.map(f => (
                  <span
                    key={f.id}
                    className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300"
                  >
                    {f.apiName} <span className="text-cyan-400 font-bold">: {f.type}</span>
                    {f.isRequired && <span className="text-rose-400 ml-1">*</span>}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setRecordFormPayload({});
                setValidationError(null);
                setShowCreateRecordModal(true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-md transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{dictionary.schemas.insertRecordButton}</span>
            </button>
          </div>

          {/* Dynamic Records DataGrid */}
          <DataGrid
            data={gridRows}
            columns={dynamicColumns}
            idField="id"
            title={`${activeObject.name} Records`}
            subtitle="Editable dynamic records validated against dynamic JSON schema definitions."
            onRowUpdate={handleRecordUpdate}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['custom-records', selectedObjectId] })}
            isLoading={isLoadingRecords}
          />
        </div>
      )}

      {/* Audit Log Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
        <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-cyan-400" />
          <span>{dictionary.schemas.auditTrailTitle} (Last {auditLogs.length} Events)</span>
        </h3>
        <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 font-mono text-[11px]">
          {auditLogs.map(log => (
            <div
              key={log.id}
              className="p-2 bg-slate-950/60 rounded border border-slate-800/80 flex items-center justify-between text-slate-400"
            >
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 font-semibold">[{log.action}]</span>
                <span className="text-slate-300">{log.entityType} ({log.entityId})</span>
                <span className="text-slate-500 text-[10px]">Actor: {log.actorId || 'system'}</span>
              </div>
              <span className="text-slate-600 text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Define New Custom Schema */}
      {showCreateSchemaModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Define New Business Object Schema
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 font-mono">Object Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Hazardous Waste Tracking"
                  value={newSchema.name}
                  onChange={e => setNewSchema({ ...newSchema, name: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-mono">API Name (Unique lowercase snake_case)</label>
                <input
                  type="text"
                  placeholder="e.g. hazardous_waste_tracking"
                  value={newSchema.apiName}
                  onChange={e => setNewSchema({ ...newSchema, apiName: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  className="w-full mt-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-cyan-300 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-mono">Description</label>
                <textarea
                  placeholder="Compliance and telemetry records..."
                  value={newSchema.description}
                  onChange={e => setNewSchema({ ...newSchema, description: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white h-16"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] text-slate-400 font-mono">Fields Configuration</label>
                  <button
                    onClick={() => setNewSchema({
                      ...newSchema,
                      fields: [...newSchema.fields, { name: 'New Field', apiName: `field_${Date.now()}`, type: 'STRING', isRequired: false }]
                    })}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Field
                  </button>
                </div>

                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {newSchema.fields.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-950 p-2 rounded border border-slate-800">
                      <input
                        type="text"
                        placeholder="Label"
                        value={f.name}
                        onChange={e => {
                          const updated = [...newSchema.fields];
                          updated[i].name = e.target.value;
                          setNewSchema({ ...newSchema, fields: updated });
                        }}
                        className="w-1/3 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                      />
                      <input
                        type="text"
                        placeholder="apiName"
                        value={f.apiName}
                        onChange={e => {
                          const updated = [...newSchema.fields];
                          updated[i].apiName = e.target.value;
                          setNewSchema({ ...newSchema, fields: updated });
                        }}
                        className="w-1/3 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-cyan-300 font-mono"
                      />
                      <select
                        value={f.type}
                        onChange={e => {
                          const updated = [...newSchema.fields];
                          updated[i].type = e.target.value as any;
                          setNewSchema({ ...newSchema, fields: updated });
                        }}
                        className="w-1/4 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono"
                      >
                        <option value="STRING">STRING</option>
                        <option value="NUMBER">NUMBER</option>
                        <option value="BOOLEAN">BOOLEAN</option>
                        <option value="DATE">DATE</option>
                      </select>
                      <button
                        onClick={() => {
                          setNewSchema({
                            ...newSchema,
                            fields: newSchema.fields.filter((_, idx) => idx !== i)
                          });
                        }}
                        className="text-rose-400 hover:text-rose-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowCreateSchemaModal(false)}
                className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => createSchemaMutation.mutate(newSchema)}
                disabled={!newSchema.name || !newSchema.apiName}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold shadow disabled:opacity-50"
              >
                Create Schema
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Insert Record */}
      {showCreateRecordModal && activeObject && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Insert Record into [{activeObject.name}]
            </h3>

            {validationError && (
              <div className="p-2.5 bg-rose-950/40 border border-rose-900/60 rounded text-rose-300 text-xs font-mono">
                {validationError}
              </div>
            )}

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {activeObject.fields.map(field => (
                <div key={field.id}>
                  <label className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
                    <span>{field.name}</span>
                    <span className="text-[10px] text-cyan-400 font-bold">{field.type}{field.isRequired ? ' *' : ''}</span>
                  </label>
                  {field.type === 'BOOLEAN' ? (
                    <select
                      value={recordFormPayload[field.apiName] !== undefined ? String(recordFormPayload[field.apiName]) : 'true'}
                      onChange={e => setRecordFormPayload({ ...recordFormPayload, [field.apiName]: e.target.value === 'true' })}
                      className="w-full mt-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  ) : field.type === 'ENUM' && field.validationRules?.allowedValues ? (
                    <select
                      value={recordFormPayload[field.apiName] || field.validationRules.allowedValues[0]}
                      onChange={e => setRecordFormPayload({ ...recordFormPayload, [field.apiName]: e.target.value })}
                      className="w-full mt-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white font-mono"
                    >
                      {field.validationRules.allowedValues.map((val: string) => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : 'text'}
                      value={recordFormPayload[field.apiName] || ''}
                      onChange={e => setRecordFormPayload({
                        ...recordFormPayload,
                        [field.apiName]: field.type === 'NUMBER' ? Number(e.target.value) : e.target.value
                      })}
                      className="w-full mt-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowCreateRecordModal(false)}
                className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => createRecordMutation.mutate()}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold shadow"
              >
                Save Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
