/**
 * NewMark Platform Ultra: Dynamic Schema & Metadata Router
 * Maps routes to ObjectController handlers with granular RBAC permissions.
 */

import { Router } from 'express';
import { ObjectController } from '../controllers/object.controller';
import { requirePermission } from '../middleware/auth';

export const objectRouter = Router();

// Schema Definitions
objectRouter.get(
  '/objects',
  requirePermission('schema:read'),
  ObjectController.listObjects
);

objectRouter.post(
  '/objects',
  requirePermission('schema:create'),
  ObjectController.createObject
);

objectRouter.get(
  '/objects/:id',
  requirePermission('schema:read'),
  ObjectController.getObject
);

objectRouter.post(
  '/objects/:id/fields',
  requirePermission('schema:create'),
  ObjectController.addField
);

// Dynamic Records CRUD
objectRouter.get(
  '/objects/:id/records',
  requirePermission('records:read'),
  ObjectController.listRecords
);

objectRouter.post(
  '/objects/:id/records',
  requirePermission('records:create'),
  ObjectController.createRecord
);

objectRouter.put(
  '/objects/:id/records/:recordId',
  requirePermission('records:update'),
  ObjectController.updateRecord
);

objectRouter.delete(
  '/objects/:id/records/:recordId',
  requirePermission('records:delete'),
  ObjectController.deleteRecord
);

// Immutable Audit Logs
objectRouter.get(
  '/audit-logs',
  requirePermission('audit:read'),
  ObjectController.getAuditLogs
);
