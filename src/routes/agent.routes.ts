/**
 * NewMark Platform Ultra: Autonomous Agent Router
 * Exposes chat orchestrator, MCP tool calling, telemetry logs, and live SSE event streams.
 */

import { Router } from 'express';
import { AgentController } from '../controllers/agent.controller';
import { requirePermission } from '../middleware/auth';

export const agentRouter = Router();

// Natural language directive
agentRouter.post(
  '/agents/chat',
  requirePermission('agent:execute'),
  AgentController.chat
);

// Direct MCP Tool execution
agentRouter.post(
  '/agents/execute-tool',
  requirePermission('agent:execute'),
  AgentController.executeTool
);

// Telemetry logs
agentRouter.get(
  '/agents/logs',
  requirePermission('audit:read'),
  AgentController.getLogs
);
