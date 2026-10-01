/**
 * NewMark Platform Ultra: Real-Time Kafka/Redis CQRS Event Terminal
 * Streams domain events in real-time over SSE, with topic filtering,
 * JSON payload inspection, and broker connection health telemetry.
 */

import React, { useState } from 'react';
import { 
  Terminal, 
  Pause, 
  Play, 
  Trash2, 
  Radio, 
  Filter, 
  ArrowUpRight, 
  Maximize2,
  Minimize2,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useEventMesh, DomainEventStreamItem } from '../providers';

export function KafkaEventTerminal() {
  const { events, isConnected, clearEvents } = useEventMesh();
  const [isPaused, setIsPaused] = useState(false);
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>('ALL');
  const [inspectedEvent, setInspectedEvent] = useState<DomainEventStreamItem | null>(null);

  const topics = ['ALL', 'inventory.', 'po.', 'finance.', 'agent.', 'schema.', 'record.'];

  const filteredEvents = React.useMemo(() => {
    if (selectedTopicFilter === 'ALL') return events;
    return events.filter(e => e.topic.startsWith(selectedTopicFilter));
  }, [events, selectedTopicFilter]);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[520px]">
      {/* Terminal Title Bar */}
      <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
          </div>
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800 text-slate-300 font-bold">
            <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-rose-500'}`} />
            <span>KAFKA / REDIS CQRS EVENT MESH</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            isConnected
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
          }`}>
            {isConnected ? 'BROKER: CONNECTED (SSE/KAFKA)' : 'BROKER: DISCONNECTED'}
          </span>

          <span className="text-slate-500 text-[10px]">{events.length} Events Logged</span>

          <div className="flex items-center gap-1 border-l border-slate-800 pl-3">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
              title={isPaused ? 'Resume stream' : 'Pause stream'}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={clearEvents}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400"
              title="Clear terminal"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Topic Filter Chips */}
      <div className="px-4 py-2 bg-slate-900/40 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none font-mono text-[10px]">
        <span className="text-slate-500 uppercase mr-1 flex items-center gap-1">
          <Filter className="w-3 h-3 text-cyan-400" /> Topic Filter:
        </span>
        {topics.map(t => (
          <button
            key={t}
            onClick={() => setSelectedTopicFilter(t)}
            className={`px-2 py-0.5 rounded border transition-colors ${
              selectedTopicFilter === t
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Main Terminal Area */}
      <div className="flex-1 flex overflow-hidden font-mono text-[11px]">
        {/* Event Stream List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
          {filteredEvents.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-600 text-xs">
              Waiting for domain events on topic stream...
            </div>
          ) : (
            filteredEvents.map(evt => {
              const isSelected = inspectedEvent?.id === evt.id;
              const isBreach = evt.topic.includes('breach');
              const isPO = evt.topic.startsWith('po.');
              const isFinance = evt.topic.startsWith('finance.');

              return (
                <div
                  key={evt.id}
                  onClick={() => setInspectedEvent(isSelected ? null : evt)}
                  className={`p-2 rounded border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-200'
                      : isBreach
                      ? 'bg-rose-950/20 border-rose-900/40 text-rose-300 hover:bg-rose-950/40'
                      : isPO
                      ? 'bg-amber-950/20 border-amber-900/40 text-amber-200 hover:bg-amber-950/40'
                      : isFinance
                      ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-200 hover:bg-emerald-950/40'
                      : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-slate-500 text-[10px] shrink-0">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase shrink-0 ${
                      isBreach ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-cyan-400'
                    }`}>
                      {evt.topic}
                    </span>
                    <span className="text-slate-400 truncate text-[10px]">
                      {JSON.stringify(evt.payload).substring(0, 90)}...
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-500">[{evt.source || 'system'}]</span>
                    <ArrowUpRight className="w-3 h-3 text-slate-500" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Inspected Event Payload Side-drawer */}
        {inspectedEvent && (
          <div className="w-80 border-l border-slate-800 bg-slate-950 p-4 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-bold text-xs text-cyan-400">EVENT INSPECTOR</span>
                <button
                  onClick={() => setInspectedEvent(null)}
                  className="text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="mt-3 space-y-2 text-[10px]">
                <div>
                  <span className="text-slate-500">Topic:</span>
                  <div className="text-white font-bold">{inspectedEvent.topic}</div>
                </div>
                <div>
                  <span className="text-slate-500">Timestamp:</span>
                  <div className="text-slate-300">{inspectedEvent.timestamp}</div>
                </div>
                <div>
                  <span className="text-slate-500">Source:</span>
                  <div className="text-slate-300">{inspectedEvent.source}</div>
                </div>
                <div>
                  <span className="text-slate-500">Event ID:</span>
                  <div className="text-slate-400">{inspectedEvent.id}</div>
                </div>
                <div className="pt-2">
                  <span className="text-slate-500">Payload (JSON):</span>
                  <pre className="p-2 bg-slate-900 rounded border border-slate-800 text-cyan-300 overflow-x-auto mt-1 max-h-48">
                    {JSON.stringify(inspectedEvent.payload, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-500">
              Kafka Partition: 0 • Offset Commit: OK
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
