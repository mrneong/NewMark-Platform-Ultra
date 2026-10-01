/**
 * NewMark Platform Ultra: Global Application Providers
 * Implements TanStack Query cache, real-time SSE/Kafka event subscriber mesh,
 * and multi-tenant security context.
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from './i18n/context';

export interface DomainEventStreamItem {
  id: string;
  topic: string;
  tenantId: string;
  timestamp: string;
  source: string;
  payload: any;
}

interface EventMeshContextType {
  events: DomainEventStreamItem[];
  isConnected: boolean;
  clearEvents: () => void;
}

const EventMeshContext = createContext<EventMeshContextType>({
  events: [],
  isConnected: false,
  clearEvents: () => {}
});

export const useEventMesh = () => useContext(EventMeshContext);

interface TenantContextType {
  tenantId: string;
  userRole: string;
  setUserRole: (role: string) => void;
}

const TenantContext = createContext<TenantContextType>({
  tenantId: 'tenant_enterprise_ultra_001',
  userRole: 'ENTERPRISE_ARCHITECT',
  setUserRole: () => {}
});

export const useTenant = () => useContext(TenantContext);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5000,
      retry: 1
    }
  }
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<DomainEventStreamItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [userRole, setUserRole] = useState('ENTERPRISE_ARCHITECT');

  // SSE Stream Listener
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    function connectSSE() {
      try {
        eventSource = new EventSource('/api/v1/events/stream');

        eventSource.onopen = () => {
          setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.topic) {
              setEvents(prev => [data, ...prev].slice(0, 150)); // keep last 150 events
              // Invalidate relevant queries when domain events arrive
              if (data.topic.startsWith('inventory.')) {
                queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
                queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
              }
              if (data.topic.startsWith('po.')) {
                queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
              }
              if (data.topic.startsWith('finance.')) {
                queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
              }
              if (data.topic.startsWith('record.') || data.topic.startsWith('schema.')) {
                queryClient.invalidateQueries({ queryKey: ['custom-objects'] });
                queryClient.invalidateQueries({ queryKey: ['custom-records'] });
              }
            }
          } catch (e) {
            // ignore non-json heartbeats
          }
        };

        eventSource.onerror = () => {
          setIsConnected(false);
          eventSource?.close();
          // Auto reconnect after 3 seconds
          reconnectTimeout = setTimeout(connectSSE, 3000);
        };
      } catch (err) {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connectSSE, 3000);
      }
    }

    connectSSE();

    return () => {
      eventSource?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  const clearEvents = () => setEvents([]);

  const eventValue = useMemo(() => ({ events, isConnected, clearEvents }), [events, isConnected]);
  const tenantValue = useMemo(() => ({
    tenantId: 'tenant_enterprise_ultra_001',
    userRole,
    setUserRole
  }), [userRole]);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TenantContext.Provider value={tenantValue}>
          <EventMeshContext.Provider value={eventValue}>
            {children}
          </EventMeshContext.Provider>
        </TenantContext.Provider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
