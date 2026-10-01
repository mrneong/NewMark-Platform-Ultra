/**
 * NewMark Platform Ultra: Agentic Orchestration & SSE Event Stream Controller
 * Exposes natural language command interfaces, direct MCP tool executions,
 * and Server-Sent Events (SSE) for Kafka/Redis domain event broadcasting.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { supervisorAgent } from '../agents/supervisor';
import { ENTERPRISE_TOOLS } from '../agents/tools';
import { db } from '../lib/db';
import { redis, DomainEvent } from '../lib/redis';

const ChatSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  sessionId: z.string().optional(),
  locale: z.enum(['en-US', 'vi-VN']).optional()
});

const ExecuteToolSchema = z.object({
  toolName: z.string(),
  args: z.record(z.string(), z.any()).default({}),
  locale: z.enum(['en-US', 'vi-VN']).optional()
});

export class AgentController {
  /**
   * Natural language chat / instruction endpoint for Autonomous Supervisor
   */
  public static async chat(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId || 'tenant_enterprise_ultra_001';
      const actor = req.user?.email || 'enterprise.operator@newmark.ultra';
      const parsed = ChatSchema.parse(req.body);
      const locale = parsed.locale || (req as any).locale || 'en-US';

      const response = await supervisorAgent.executePlan(parsed.message, {
        tenantId,
        actor,
        sessionId: parsed.sessionId,
        locale
      });

      res.json({ success: true, data: response });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * Direct tool invocation (Model Context Protocol / MCP endpoint)
   */
  public static async executeTool(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId || 'tenant_enterprise_ultra_001';
      const actor = req.user?.email || 'enterprise.operator@newmark.ultra';
      const parsed = ExecuteToolSchema.parse(req.body);
      const locale = parsed.locale || (req as any).locale || 'en-US';

      const tool = ENTERPRISE_TOOLS[parsed.toolName];
      if (!tool) {
        res.status(404).json({
          success: false,
          error: `Tool '${parsed.toolName}' is not registered in MCP registry.`
        });
        return;
      }

      const validatedInput = tool.parameters.parse(parsed.args);
      const startTime = Date.now();
      const output = await tool.execute(validatedInput, { tenantId, actor, locale });
      const duration = Date.now() - startTime;

      db.logAgentExecution({
        tenantId,
        sessionId: `mcp_${Date.now()}`,
        agentRole: 'SUPERVISOR',
        toolName: parsed.toolName,
        inputPayload: parsed.args,
        outputPayload: output,
        executionMs: duration,
        status: 'SUCCESS'
      });

      res.json({
        success: true,
        data: {
          toolName: parsed.toolName,
          executionTimeMs: duration,
          output
        }
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * Retrieve Agent execution telemetry logs
   */
  public static async getLogs(req: Request, res: Response) {
    try {
      const tenantId = req.tenantId || 'tenant_enterprise_ultra_001';
      const logs = db.getAgentLogs(tenantId);
      res.json({ success: true, data: logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Real-time Server-Sent Events (SSE) Stream
   * Pushes all Kafka/Redis domain events to connected frontend clients
   */
  public static async streamEvents(req: Request, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Send connection established event
    res.write(`data: ${JSON.stringify({
      topic: 'sys.connection.established',
      timestamp: new Date().toISOString(),
      payload: { message: 'Connected to NewMark Platform Ultra Kafka/Redis Mesh' }
    })}\n\n`);

    // Subscribe to all domain events
    const unsubscribe = redis.subscribe('*', (event: DomainEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    // Heartbeat every 15s to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }
}
