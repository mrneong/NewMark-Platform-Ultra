/**
 * NewMark Platform Ultra: Autonomous Multi-Agent Workspace
 * Features live WebSocket reasoning step streams, Generative UI execution cards,
 * dynamic approval forms for human-in-the-loop sign-offs, and tool execution telemetry.
 */

import React, { useState } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  Clock, 
  Cpu, 
  DollarSign, 
  Layers, 
  Boxes, 
  Activity,
  Radio,
  FileCheck,
  ShieldCheck,
  Zap,
  ArrowRight,
  ClipboardCheck,
  XCircle,
  FileText
} from 'lucide-react';
import { useAgentStream, DynamicApprovalFormState } from '../hooks/useAgentStream';
import { AgentStepEvent, GenerativeUIWidget } from '../agents/supervisor';
import { useLanguage } from '../i18n/context';

export function AgentWorkspace() {
  const { dictionary, locale } = useLanguage();
  const { 
    messages, 
    isProcessing, 
    activeTool, 
    wsConnected, 
    error, 
    sendMessage, 
    submitApproval, 
    dispatchAction 
  } = useAgentStream();

  const [inputText, setInputText] = useState('');
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [formInputs, setFormInputs] = useState<Record<string, any>>({});
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessing) return;
    sendMessage(inputText);
    setInputText('');
  };

  const handleApprovalSubmit = async (form: DynamicApprovalFormState, actionId: string) => {
    // Collect default values merged with user edits
    const mergedValues: Record<string, any> = { ...form.data };
    form.fields.forEach(f => {
      mergedValues[f.name] = formInputs[f.name] !== undefined ? formInputs[f.name] : f.defaultValue;
    });

    await submitApproval(form.formId, actionId, mergedValues);
    setFeedbackNotice(dictionary.agents.actionExecutedSuccess);
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  const quickDirectives = [
    { 
      label: locale === 'vi-VN' ? 'Kiểm Toán Tồn Kho' : 'Audit Inventory & Deficits', 
      prompt: dictionary.agents.quickDirective1 
    },
    { 
      label: locale === 'vi-VN' ? 'Phân Bổ 20 SKU-TITAN' : 'Allocate 20 SKU-TITAN via FEFO', 
      prompt: dictionary.agents.quickDirective2 
    },
    { 
      label: locale === 'vi-VN' ? 'Duyệt & Giải Ngân PO' : 'Review & Disburse Pending POs', 
      prompt: dictionary.agents.quickDirective3 
    },
    { 
      label: locale === 'vi-VN' ? 'Rà Soát Lược Đồ' : 'Inspect Dynamic Schemas', 
      prompt: dictionary.agents.quickDirective4 
    }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Workspace Header */}
      <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide">{dictionary.agents.workspaceTitle}</h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border flex items-center gap-1.5 ${
                wsConnected
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/20 border-amber-500/30 text-amber-400'
              }`}>
                <Radio className={`w-2.5 h-2.5 ${wsConnected ? 'animate-pulse text-emerald-400' : ''}`} />
                {wsConnected ? dictionary.agents.wsActiveStatus : dictionary.agents.httpPollingStatus}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {dictionary.agents.workspaceSubtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          {activeTool ? (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400">
              <Activity className="w-3.5 h-3.5 animate-spin" />
              <span>{dictionary.agents.activeStatusPrefix} {activeTool}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span>{dictionary.agents.awaitingDirective}</span>
            </div>
          )}
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedbackNotice && (
        <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 font-mono animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{feedbackNotice}</span>
        </div>
      )}

      {/* Message & Step Stream */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                {msg.role === 'user' 
                  ? dictionary.agents.operatorBadge 
                  : msg.role === 'assistant' 
                  ? dictionary.agents.supervisorBadge 
                  : dictionary.agents.systemTraceBadge}
              </span>
              <span className="text-[10px] font-mono text-slate-600">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <div
              className={`max-w-3xl rounded-xl p-4 text-xs leading-relaxed shadow-lg ${
                msg.role === 'user'
                  ? 'bg-cyan-950/40 border border-cyan-800/60 text-cyan-100 font-sans'
                  : 'bg-slate-950/80 border border-slate-800 text-slate-200'
              }`}
            >
              <div className="whitespace-pre-wrap font-sans text-[13px]">{msg.content}</div>

              {/* Dynamic Approval Form: Renders when Agent tool call requires supervisor authorization */}
              {msg.approvalForm && (
                <div className="mt-4 p-4 bg-slate-900 border border-amber-500/40 rounded-xl space-y-3 font-sans shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="w-4 h-4 text-amber-400" />
                      <h4 className="font-bold text-white text-xs">{msg.approvalForm.title}</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[10px]">
                      AWAITING SIGN-OFF
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400">{msg.approvalForm.description}</p>

                  {/* Form Input Fields */}
                  <div className="space-y-2.5 pt-1">
                    {msg.approvalForm.fields.map(f => (
                      <div key={f.name}>
                        <label className="text-[10px] font-mono text-slate-400 block mb-1">
                          {f.label} {f.required && <span className="text-rose-400">*</span>}
                        </label>
                        {f.type === 'textarea' ? (
                          <textarea
                            value={formInputs[f.name] !== undefined ? formInputs[f.name] : (f.defaultValue || '')}
                            onChange={e => setFormInputs({ ...formInputs, [f.name]: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 h-16 font-mono"
                          />
                        ) : f.type === 'select' && f.options ? (
                          <select
                            value={formInputs[f.name] !== undefined ? formInputs[f.name] : (f.defaultValue || '')}
                            onChange={e => setFormInputs({ ...formInputs, [f.name]: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                          >
                            {f.options.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={f.type === 'number' ? 'number' : 'text'}
                            value={formInputs[f.name] !== undefined ? formInputs[f.name] : (f.defaultValue || '')}
                            onChange={e => setFormInputs({ ...formInputs, [f.name]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Form Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    {msg.approvalForm.actions.map(act => (
                      <button
                        key={act.actionId}
                        onClick={() => handleApprovalSubmit(msg.approvalForm!, act.actionId)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow transition-colors flex items-center gap-1.5 ${
                          act.style === 'primary'
                            ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                            : act.style === 'danger'
                            ? 'bg-rose-600 hover:bg-rose-500 text-white'
                            : act.style === 'warning'
                            ? 'bg-amber-600 hover:bg-amber-500 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {act.style === 'danger' ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>{act.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Real-time intermediate execution steps */}
              {msg.steps && msg.steps.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                  <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Terminal className="w-3 h-3 text-cyan-400" />
                    <span>{dictionary.agents.executionStepsTitle} ({msg.steps.length})</span>
                  </div>

                  <div className="space-y-1.5">
                    {msg.steps.map((step) => {
                      const isExpanded = expandedStepId === step.id;
                      const isComplete = step.type === 'tool:complete';
                      const isExecuting = step.type === 'tool:executing' || step.type === 'tool:start';
                      const isError = step.type === 'tool:error';

                      return (
                        <div
                          key={step.id}
                          className="bg-slate-900/80 border border-slate-800 rounded p-2 font-mono text-[11px]"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${
                                isComplete ? 'bg-emerald-400' : isExecuting ? 'bg-amber-400 animate-pulse' : isError ? 'bg-rose-500' : 'bg-cyan-400'
                              }`} />
                              <span className="text-slate-400 text-[10px]">[{step.agentRole}]</span>
                              <span className="font-bold text-slate-100">{step.toolName || step.type}</span>
                              {step.executionTimeMs !== undefined && (
                                <span className="text-slate-500 text-[10px]">({step.executionTimeMs}ms)</span>
                              )}
                            </div>

                            {(step.args || step.result) && (
                              <button
                                onClick={() => setExpandedStepId(isExpanded ? null : step.id)}
                                className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
                              >
                                <span>{isExpanded ? dictionary.agents.collapseData : dictionary.agents.inspectData}</span>
                                <ChevronRight className={`w-3 h-3 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>
                            )}
                          </div>

                          {step.message && (
                            <p className="text-slate-400 text-[11px] mt-1 font-sans">{step.message}</p>
                          )}

                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] space-y-1.5">
                              {step.args && (
                                <div>
                                  <span className="text-slate-500">{dictionary.agents.inputParameters}</span>
                                  <pre className="p-1.5 bg-slate-950 rounded text-slate-300 overflow-x-auto mt-0.5">
                                    {JSON.stringify(step.args, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {step.result && (
                                <div>
                                  <span className="text-slate-500">{dictionary.agents.databaseOutput}</span>
                                  <pre className="p-1.5 bg-slate-950 rounded text-cyan-300 overflow-x-auto mt-0.5">
                                    {JSON.stringify(step.result, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Generative UI Action Widgets */}
              {msg.generativeWidgets && msg.generativeWidgets.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-800 space-y-3">
                  <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>{dictionary.agents.interactiveActionsTitle}</span>
                  </div>

                  {msg.generativeWidgets.map((widget, widx) => (
                    <div
                      key={widx}
                      className="p-3.5 bg-slate-900 border border-cyan-800/50 rounded-xl shadow-lg space-y-3 font-sans"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileCheck className="w-4 h-4 text-cyan-400" />
                          <h4 className="font-bold text-white text-xs">{widget.title}</h4>
                        </div>
                        <span className="px-2 py-0.5 bg-cyan-950 border border-cyan-800 text-cyan-300 rounded text-[10px] font-mono">
                          {widget.type}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                        {Object.entries(widget.data).map(([key, val]) => (
                          <div key={key}>
                            <span className="text-slate-500 text-[10px] block">{key}:</span>
                            <span className="text-white font-semibold">
                              {typeof val === 'number' && key.toLowerCase().includes('amount')
                                ? `$${val.toLocaleString()}`
                                : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {widget.actions.length > 0 && (
                        <div className="flex items-center gap-2 pt-1">
                          {widget.actions.map((act) => (
                            <button
                              key={act.actionId}
                              onClick={() => dispatchAction(act.actionId, act.payload)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow transition-colors flex items-center gap-1.5 ${
                                act.style === 'primary'
                                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                                  : act.style === 'success'
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                  : act.style === 'warning'
                                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                              }`}
                            >
                              <span>{act.label}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex items-center gap-2.5 text-xs text-slate-400 font-mono py-2 animate-pulse">
            <Cpu className="w-4 h-4 text-cyan-400 animate-spin" />
            <span>{dictionary.agents.supervisorOrchestrating}</span>
          </div>
        )}
      </div>

      {/* Quick Directive Suggestions Bar */}
      <div className="px-5 py-2.5 border-t border-slate-800 bg-slate-950/50 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>{dictionary.agents.quickDirectivesTitle}</span>
        </span>
        {quickDirectives.map((qd, i) => (
          <button
            key={i}
            onClick={() => sendMessage(qd.prompt)}
            disabled={isProcessing}
            className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/50 rounded-full text-[11px] text-slate-300 hover:text-white whitespace-nowrap transition-colors disabled:opacity-50"
          >
            {qd.label}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="p-4 border-t border-slate-800 bg-slate-950 flex items-center gap-3">
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder={dictionary.agents.directiveInputPlaceholder}
          disabled={isProcessing}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors disabled:opacity-50 font-sans"
        />
        <button
          type="submit"
          disabled={isProcessing || !inputText.trim()}
          className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <span>{dictionary.agents.dispatchButton}</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
