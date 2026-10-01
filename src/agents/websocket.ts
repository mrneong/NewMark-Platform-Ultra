/**
 * NewMark Platform Ultra: Multi-Agent Real-Time WebSocket Server
 * Streams reasoning steps, tool execution events, and Generative UI widgets
 * to connected frontend clients with bi-directional action handling.
 */

import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { supervisorAgent, AgentStepEvent } from './supervisor';
import { ENTERPRISE_TOOLS } from './tools';
import { db } from '../lib/db';
import { redis, DomainEvent } from '../lib/redis';
import { SupportedLocale } from '../i18n/types';

export interface ClientInboundMessage {
  type: 'DIRECTIVE' | 'EXECUTE_TOOL' | 'ACTION_CLICK' | 'PING';
  prompt?: string;
  toolName?: string;
  args?: Record<string, any>;
  actionId?: string;
  payload?: Record<string, any>;
  sessionId?: string;
  tenantId?: string;
  locale?: SupportedLocale;
}

export interface ServerOutboundMessage {
  type:
    | 'CONNECTION_ESTABLISHED'
    | 'STEP_EVENT'
    | 'EXECUTION_COMPLETE'
    | 'TOOL_RESULT'
    | 'ACTION_RESULT'
    | 'DOMAIN_EVENT'
    | 'ERROR'
    | 'PONG';
  step?: AgentStepEvent;
  result?: any;
  event?: DomainEvent;
  error?: string;
  timestamp: string;
}

export class AgentWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private redisUnsubscribe: (() => void) | null = null;

  /**
   * Initializes WebSocket server mounted on the main HTTP server
   */
  public initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/agents'
    });

    console.log('[AGENT WEBSOCKET] Attached to HTTP server at path: /ws/agents');

    // Subscribe to Redis / Kafka CQRS domain events and broadcast to all connected clients
    this.redisUnsubscribe = redis.subscribe('*', (event: DomainEvent) => {
      this.broadcast({
        type: 'DOMAIN_EVENT',
        event,
        timestamp: new Date().toISOString()
      });
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      this.clients.add(ws);
      console.log(`[AGENT WEBSOCKET] Client connected. Total active clients: ${this.clients.size}`);

      // Send greeting & cluster capabilities
      this.sendToClient(ws, {
        type: 'CONNECTION_ESTABLISHED',
        result: {
          status: 'CONNECTED',
          clusterNode: 'us-east-mesh-01',
          toolsCount: Object.keys(ENTERPRISE_TOOLS).length,
          tools: Object.keys(ENTERPRISE_TOOLS)
        },
        timestamp: new Date().toISOString()
      });

      // Handle incoming messages
      ws.on('message', async (data) => {
        try {
          const message: ClientInboundMessage = JSON.parse(data.toString());
          await this.handleClientMessage(ws, message);
        } catch (err: any) {
          console.error('[AGENT WEBSOCKET] Message parsing/handling error:', err);
          this.sendToClient(ws, {
            type: 'ERROR',
            error: err.message || 'Malformed message format',
            timestamp: new Date().toISOString()
          });
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[AGENT WEBSOCKET] Client disconnected. Remaining clients: ${this.clients.size}`);
      });

      ws.on('error', (err) => {
        console.error('[AGENT WEBSOCKET] Socket error:', err);
        this.clients.delete(ws);
      });
    });
  }

  /**
   * Processes client requests (Directives, Direct Tool Calls, Generative UI Action clicks)
   */
  private async handleClientMessage(ws: WebSocket, msg: ClientInboundMessage): Promise<void> {
    const tenantId = msg.tenantId || 'tenant_enterprise_ultra_001';
    const actor = 'websocket_operator@newmark.ultra';

    switch (msg.type) {
      case 'PING':
        this.sendToClient(ws, {
          type: 'PONG',
          timestamp: new Date().toISOString()
        });
        break;

      case 'DIRECTIVE': {
        if (!msg.prompt || !msg.prompt.trim()) {
          throw new Error('Directive prompt cannot be empty.');
        }

        const sessionId = msg.sessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const locale = msg.locale || 'en-US';

        // Execute supervisor planning loop with real-time streaming of steps
        const result = await supervisorAgent.executePlan(
          msg.prompt,
          { tenantId, actor, sessionId, locale },
          (step: AgentStepEvent) => {
            // Stream each intermediate step to the client in real-time
            this.sendToClient(ws, {
              type: 'STEP_EVENT',
              step,
              timestamp: new Date().toISOString()
            });
          }
        );

        // Send final completion message with full result and generative widgets
        this.sendToClient(ws, {
          type: 'EXECUTION_COMPLETE',
          result,
          timestamp: new Date().toISOString()
        });
        break;
      }

      case 'EXECUTE_TOOL': {
        if (!msg.toolName) throw new Error('toolName is required');
        const tool = ENTERPRISE_TOOLS[msg.toolName];
        if (!tool) throw new Error(`Tool '${msg.toolName}' is not registered.`);

        const parsedArgs = tool.parameters.parse(msg.args || {});
        const startTime = Date.now();
        const toolResult = await tool.execute(parsedArgs, { tenantId, actor });

        this.sendToClient(ws, {
          type: 'TOOL_RESULT',
          result: {
            toolName: msg.toolName,
            output: toolResult,
            executionTimeMs: Date.now() - startTime
          },
          timestamp: new Date().toISOString()
        });
        break;
      }

      case 'ACTION_CLICK': {
        // Handle Generative UI action card clicks directly over WebSocket
        if (msg.actionId === 'APPROVE_PO' && msg.payload?.poId) {
          const po = db.getPurchaseOrderById(msg.payload.poId);
          if (po && po.tenantId === tenantId) {
            po.status = 'APPROVED';
            po.approvedBy = 'supervisor.websocket@newmark.ultra';
            po.approvedAt = new Date().toISOString();
            db.savePurchaseOrder(po);

            redis.publish('po.approved', tenantId, 'AgentWebSocketServer', {
              poId: po.id,
              poNumber: po.poNumber,
              totalAmount: po.totalAmount
            });

            this.sendToClient(ws, {
              type: 'ACTION_RESULT',
              result: {
                actionId: 'APPROVE_PO',
                success: true,
                message: `Purchase Order ${po.poNumber} officially APPROVED.`,
                po
              },
              timestamp: new Date().toISOString()
            });
          }
        } else if (msg.actionId === 'DISBURSE_PAYMENT' && msg.payload?.poId) {
          const tool = ENTERPRISE_TOOLS['approve_financial_disbursement'];
          const invNum = `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
          const disburseRes = await tool.execute({ poId: msg.payload.poId, invoiceNumber: invNum }, { tenantId, actor });

          this.sendToClient(ws, {
            type: 'ACTION_RESULT',
            result: {
              actionId: 'DISBURSE_PAYMENT',
              success: true,
              message: `Disbursed $${disburseRes.amountDisbursed.toLocaleString()} to ledger.`,
              data: disburseRes
            },
            timestamp: new Date().toISOString()
          });
        }
        break;
      }

      default:
        console.warn(`[AGENT WEBSOCKET] Unknown message type: ${(msg as any).type}`);
    }
  }

  /**
   * Helper to send JSON packet to a specific WebSocket client
   */
  private sendToClient(ws: WebSocket, message: ServerOutboundMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcasts a JSON packet to all connected WebSocket clients
   */
  public broadcast(message: ServerOutboundMessage): void {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }
}

export const agentWebSocketServer = new AgentWebSocketServer();
