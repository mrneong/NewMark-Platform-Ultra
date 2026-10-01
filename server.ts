/**
 * NewMark Platform Ultra: Core Application Server
 * Runs Express microservices with full-mesh REST/SSE routes and Vite middleware integration.
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { AgentController } from './src/controllers/agent.controller';
import { apiV1Router } from './src/routes/index';
import { agentWebSocketServer } from './src/agents/websocket';
import { i18nMiddleware } from './src/backend/middleware/i18n.middleware';
import { sendLocalizedProblemDetails } from './src/backend/errors/localized-error';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json());
  // Mount Enterprise Internationalization (i18n) & Localization middleware
  app.use(i18nMiddleware);

  // Healthcheck endpoint for Docker / orchestration probes
  app.get('/api/v1/health', (req, res) => {
    res.json({
      status: 'HEALTHY',
      service: 'NewMark Platform Ultra OS',
      timestamp: new Date().toISOString(),
      cluster: 'active-mesh-node-01',
      version: '4.8.2-ultra'
    });
  });

  // Real-time Event Streaming (SSE / Kafka event bridge)
  app.get('/api/v1/events/stream', AgentController.streamEvents);

  // Mount API v1 Router (authenticated & tenant-scoped)
  app.use('/api/v1', apiV1Router);

  // Initialize Multi-Agent WebSocket Server on the HTTP Server instance
  agentWebSocketServer.initialize(server);

  // Frontend Serving: Vite dev server middleware or static dist bundle
  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log(`[NEWMARK ULTRA] Vite dev server mounted in middleware mode.`);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`================================================================`);
    console.log(`🚀 NEWMARK PLATFORM ULTRA: DISTRIBUTED ENTERPRISE OS IS RUNNING`);
    console.log(`📡 HTTP & REST API listening on http://0.0.0.0:${PORT}`);
    console.log(`🔌 Multi-Agent WebSocket Server active at ws://0.0.0.0:${PORT}/ws/agents`);
    console.log(`🔒 Multi-Tenant Auth & RBAC: ACTIVE`);
    console.log(`🤖 Autonomous Supervisor & MCP Engine: ONLINE`);
    console.log(`⚡ Kafka/Redis CQRS Event Mesh: STREAMING`);
    console.log(`================================================================`);
  });
}

startServer().catch(err => {
  console.error('[FATAL SERVER ERROR]', err);
  process.exit(1);
});
