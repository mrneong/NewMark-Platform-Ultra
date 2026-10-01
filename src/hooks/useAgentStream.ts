/**
 * NewMark Platform Ultra: Production Agent Stream & Bi-Directional WebSocket Hook
 * Manages live WebSocket and REST streaming of multi-agent reasoning steps,
 * tool execution events, dynamic approval forms, and optimistic state synchronization.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AgentStepEvent, GenerativeUIWidget } from '../agents/supervisor';
import { useLanguage } from '../i18n/context';

export interface DynamicApprovalFormState {
  formId: string;
  type: 'PO_APPROVAL' | 'FINANCIAL_DISBURSEMENT' | 'EMERGENCY_RESTOCK' | 'SCHEMA_MUTATION';
  title: string;
  description: string;
  data: Record<string, any>;
  fields: {
    name: string;
    label: string;
    type: 'text' | 'number' | 'textarea' | 'select';
    defaultValue?: any;
    options?: { label: string; value: string }[];
    required?: boolean;
  }[];
  actions: {
    actionId: string;
    label: string;
    style: 'primary' | 'danger' | 'warning' | 'success';
  }[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  steps?: AgentStepEvent[];
  generativeWidgets?: GenerativeUIWidget[];
  approvalForm?: DynamicApprovalFormState;
}

export function useAgentStream() {
  const { locale } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init_msg_1',
      role: 'assistant',
      content: 'Autonomous Supervisor Engine online. Real-time multi-agent reasoning mesh and executable database MCP tools active. Ready for high-concurrency directives.',
      timestamp: new Date().toISOString()
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const currentSessionIdRef = useRef<string | null>(null);

  // Initialize and maintain resilient WebSocket connection
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    function connect() {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/agents`;
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          setWsConnected(true);
          setError(null);
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Handle real-time intermediate step emitted by supervisor
            if (data.type === 'STEP_EVENT' && data.step) {
              const step: AgentStepEvent = data.step;
              if (step.toolName) {
                setActiveTool(step.toolName);
              }

              // Synthesize dynamic approval form if tool returns actionable pending state
              let dynamicForm: DynamicApprovalFormState | undefined = undefined;
              if (step.toolName === 'create_purchase_order' && step.result?.poId) {
                dynamicForm = {
                  formId: `form_${step.result.poId}`,
                  type: 'PO_APPROVAL',
                  title: `Purchase Order Review: ${step.result.poNumber}`,
                  description: 'The autonomous agent generated a purchase order requiring executive authorization.',
                  data: step.result,
                  fields: [
                    { name: 'poId', label: 'Purchase Order ID', type: 'text', defaultValue: step.result.poId, required: true },
                    { name: 'approverNotes', label: 'Supervisor Sign-off Notes', type: 'textarea', defaultValue: 'Approved via autonomous workflow review.', required: false }
                  ],
                  actions: [
                    { actionId: 'CONFIRM_PO_APPROVAL', label: 'Authorize & Sign PO', style: 'primary' },
                    { actionId: 'REJECT_PO', label: 'Reject Order', style: 'danger' }
                  ]
                };
              } else if (step.toolName === 'execute_fefo_allocation' && step.result?.thresholdBreached) {
                dynamicForm = {
                  formId: `form_breach_${Date.now()}`,
                  type: 'EMERGENCY_RESTOCK',
                  title: `Safety Threshold Breach: ${step.result.sku}`,
                  description: 'Stock reserve dropped below minimum threshold. Authorize procurement restock requisition.',
                  data: step.result,
                  fields: [
                    { name: 'sku', label: 'Target SKU', type: 'text', defaultValue: step.result.sku, required: true },
                    { name: 'reorderQty', label: 'Emergency Reorder Quantity', type: 'number', defaultValue: 200, required: true },
                    { name: 'supplierLead', label: 'Procurement Priority', type: 'select', defaultValue: 'EXPEDITED', options: [
                      { label: 'Expedited (24h)', value: 'EXPEDITED' },
                      { label: 'Standard (3-5 days)', value: 'STANDARD' }
                    ]}
                  ],
                  actions: [
                    { actionId: 'DISPATCH_EMERGENCY_RESTOCK', label: 'Emit Restock Order', style: 'warning' }
                  ]
                };
              }

              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant') {
                  const updatedSteps = [...(last.steps || []), step];
                  const updatedWidgets = step.generativeUI
                    ? [...(last.generativeWidgets || []), step.generativeUI]
                    : last.generativeWidgets;

                  return [
                    ...prev.slice(0, -1),
                    {
                      ...last,
                      steps: updatedSteps,
                      generativeWidgets: updatedWidgets,
                      approvalForm: dynamicForm || last.approvalForm
                    }
                  ];
                }
                return prev;
              });
            }

            // Handle final execution completion
            if (data.type === 'EXECUTION_COMPLETE' && data.result) {
              setIsProcessing(false);
              setActiveTool(null);

              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant') {
                  return [
                    ...prev.slice(0, -1),
                    {
                      ...last,
                      content: data.result.response || last.content,
                      generativeWidgets: data.result.generativeWidgets || last.generativeWidgets
                    }
                  ];
                }
                return prev;
              });

              queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
              queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
              queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
            }

            // Handle action click results (PO sign-offs, Disbursements)
            if (data.type === 'ACTION_RESULT') {
              queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
              queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
              queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
            }

            // Handle real-time domain events over WebSocket
            if (data.type === 'DOMAIN_EVENT') {
              const topic = data.event?.topic || '';
              if (topic.startsWith('inventory.')) {
                queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
                queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
              }
              if (topic.startsWith('po.')) {
                queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
              }
              if (topic.startsWith('finance.')) {
                queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
              }
            }
          } catch (e) {
            console.error('[WS PARSE ERROR]', e);
          }
        };

        socket.onerror = () => {
          setWsConnected(false);
        };

        socket.onclose = () => {
          setWsConnected(false);
          reconnectTimeout = setTimeout(connect, 3000);
        };
      } catch (err) {
        setWsConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      socket?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [queryClient]);

  // Send Natural Language Directive to Multi-Agent Supervisor
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };

    const assistantPlaceholder: ChatMessage = {
      id: `msg_asst_${Date.now()}`,
      role: 'assistant',
      content: 'Autonomous Supervisor analyzing directive and formulating execution plan...',
      timestamp: new Date().toISOString(),
      steps: [],
      generativeWidgets: []
    };

    setMessages(prev => [...prev, userMessage, assistantPlaceholder]);
    setIsProcessing(true);
    setActiveTool('supervisor_intent_parser');
    setError(null);

    const sessionId = `sess_${Date.now()}`;
    currentSessionIdRef.current = sessionId;

    // Send over active WebSocket if available
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'DIRECTIVE',
        prompt: content,
        sessionId,
        locale,
        tenantId: 'tenant_enterprise_ultra_001'
      }));
    } else {
      // Fallback to HTTP REST
      try {
        const res = await fetch('/api/v1/agents/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': 'tenant_enterprise_ultra_001',
            'Accept-Language': locale
          },
          body: JSON.stringify({ message: content, sessionId, locale })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to dispatch agent directive');

        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                content: json.data.response,
                steps: json.data.steps || [],
                generativeWidgets: json.data.generativeWidgets || []
              }
            ];
          }
          return prev;
        });

        queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
        queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
        queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsProcessing(false);
        setActiveTool(null);
      }
    }
  }, [isProcessing, queryClient]);

  // Submit dynamic approval form action
  const submitApproval = useCallback(async (formId: string, actionId: string, formValues: Record<string, any>) => {
    // Clear approval form from active message optimistically
    setMessages(prev => prev.map(m => (m.approvalForm?.formId === formId ? { ...m, approvalForm: undefined } : m)));

    if (actionId === 'CONFIRM_PO_APPROVAL' && formValues.poId) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ACTION_CLICK',
          actionId: 'APPROVE_PO',
          payload: { poId: formValues.poId, notes: formValues.approverNotes },
          tenantId: 'tenant_enterprise_ultra_001'
        }));
      } else {
        await fetch(`/api/v1/inventory/orders/${formValues.poId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approverId: 'supervisor.ui@newmark.ultra', notes: formValues.approverNotes })
        });
        queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      }
    } else if (actionId === 'DISPATCH_EMERGENCY_RESTOCK' && formValues.sku) {
      sendMessage(`Generate emergency purchase order for ${formValues.sku} with quantity ${formValues.reorderQty || 200}`);
    }
  }, [queryClient, sendMessage]);

  // Direct action button click handler
  const dispatchAction = useCallback(async (actionId: string, payload: Record<string, any>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'ACTION_CLICK',
        actionId,
        payload,
        tenantId: 'tenant_enterprise_ultra_001'
      }));
    } else {
      if (actionId === 'APPROVE_PO' && payload.poId) {
        await fetch(`/api/v1/inventory/orders/${payload.poId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approverId: 'supervisor.ui@newmark.ultra' })
        });
        queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      } else if (actionId === 'DISBURSE_PAYMENT' && payload.poId) {
        const invNum = `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
        await fetch(`/api/v1/inventory/orders/${payload.poId}/disburse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoiceNumber: invNum })
        });
        queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
        queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      }
    }
  }, [queryClient]);

  return {
    messages,
    isProcessing,
    activeTool,
    wsConnected,
    error,
    sendMessage,
    submitApproval,
    dispatchAction
  };
}
