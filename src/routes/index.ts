/**
 * NewMark Platform Ultra: Unified API v1 Router
 * Mounts inventory, dynamic objects, and agent routers behind authentication and tenant isolation.
 */

import { Router } from 'express';
import { authenticate, enforceTenantIsolation } from '../middleware/auth';
import { inventoryRouter } from './inventory.routes';
import { objectRouter } from './object.routes';
import { agentRouter } from './agent.routes';

export const apiV1Router = Router();

// Apply authentication and tenant isolation to all /api/v1 endpoints
apiV1Router.use(authenticate);
apiV1Router.use(enforceTenantIsolation);

// Sub-routers
apiV1Router.use('/inventory', inventoryRouter);
apiV1Router.use('/', objectRouter);
apiV1Router.use('/', agentRouter);
