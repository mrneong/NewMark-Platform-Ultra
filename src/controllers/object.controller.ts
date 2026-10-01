/**
 * NewMark Platform Ultra: Dynamic Schema & Metadata Controller
 * Validates dynamic schema definitions, field additions, record CRUD,
 * and immutable audit trail inspections.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { objectService } from '../services/object.service';

// Validation Schemas
export const FieldDefinitionSchema = z.object({
  name: z.string().min(1, 'Field display name is required.'),
  apiName: z.string().regex(/^[a-zA-Z0-9_]{1,64}$/, 'Field API name must be alphanumeric with underscores.'),
  type: z.enum(['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'ENUM', 'JSON']),
  isRequired: z.boolean().default(false),
  isUnique: z.boolean().optional(),
  defaultValue: z.any().optional(),
  validationRules: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    regex: z.string().optional(),
    allowedValues: z.array(z.string()).optional()
  }).optional()
});

export const CreateCustomObjectSchema = z.object({
  name: z.string().min(2, 'Object display name must be at least 2 characters.'),
  apiName: z.string().regex(/^[a-z0-9_]{2,64}$/, 'API name must be lowercase alphanumeric with underscores.'),
  description: z.string().max(1000).default(''),
  icon: z.string().default('Box'),
  primaryField: z.string().optional(),
  fields: z.array(FieldDefinitionSchema).min(1, 'Object must declare at least one field.')
});

export const AddFieldSchema = FieldDefinitionSchema;

export class ObjectController {
  /**
   * GET /api/v1/objects
   * Lists all custom object schema definitions for current tenant
   */
  public static async listObjects(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId || 'tenant_enterprise_ultra_001';
      const objects = db.getCustomObjects(tenantId);
      res.json({
        success: true,
        data: objects,
        total: objects.length,
        correlationId: req.correlationId
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: 'SCHEMA_QUERY_FAILED',
        message: err.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * GET /api/v1/objects/:id
   * Retrieves single custom object schema definition
   */
  public static async getObject(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId || 'tenant_enterprise_ultra_001';
      const { id } = req.params;
      const obj = db.getCustomObjectById(id);

      if (!obj || obj.tenantId !== tenantId) {
        res.status(404).json({
          success: false,
          error: 'OBJECT_NOT_FOUND',
          message: `Custom object '${id}' does not exist in tenant context.`,
          correlationId: req.correlationId
        });
        return;
      }

      res.json({
        success: true,
        data: obj,
        correlationId: req.correlationId
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: 'OBJECT_QUERY_FAILED',
        message: err.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * POST /api/v1/objects
   * Defines a brand new dynamic business object schema
   */
  public static async createObject(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId || 'tenant_enterprise_ultra_001';
      const parsed = CreateCustomObjectSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          issues: parsed.error.issues,
          correlationId: req.correlationId
        });
        return;
      }

      const created = await objectService.defineCustomObject({
        tenantId,
        name: parsed.data.name,
        apiName: parsed.data.apiName,
        description: parsed.data.description,
        icon: parsed.data.icon,
        primaryField: parsed.data.primaryField,
        fields: parsed.data.fields,
        actorId: req.user?.email || 'schema_admin'
      });

      res.status(201).json({
        success: true,
        data: created,
        correlationId: req.correlationId
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: 'SCHEMA_CREATION_FAILED',
        message: err.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * POST /api/v1/objects/:id/fields
   * Adds a new field definition to an existing custom object schema
   */
  public static async addField(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId || 'tenant_enterprise_ultra_001';
      const { id } = req.params;
      const parsed = AddFieldSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          issues: parsed.error.issues,
          correlationId: req.correlationId
        });
        return;
      }

      const updatedObj = await objectService.addFieldToObject(
        tenantId,
        id,
        parsed.data,
        req.user?.email || 'schema_admin'
      );

      res.status(200).json({
        success: true,
        data: updatedObj,
        correlationId: req.correlationId
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: 'FIELD_ADDITION_FAILED',
        message: err.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * GET /api/v1/objects/:id/records
   * Queries records for custom object with filtering, sorting, and pagination
   */
  public static async listRecords(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId || 'tenant_enterprise_ultra_001';
      const { id } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'asc';

      const result = objectService.queryRecords(tenantId, {
        customObjectId: id,
        limit,
        offset,
        sortBy,
        sortOrder
      });

      res.json({
        success: true,
        data: result.records,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        correlationId: req.correlationId
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: 'RECORD_QUERY_FAILED',
        message: err.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * POST /api/v1/objects/:id/records
   * Inserts a record validated against object's dynamic JSON schema
   */
  public static async createRecord(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId || 'tenant_enterprise_ultra_001';
      const { id } = req.params;
      const payload = req.body;

      if (!payload || typeof payload !== 'object') {
        res.status(400).json({
          success: false,
          error: 'INVALID_PAYLOAD',
          message: 'Record body must be a valid JSON key-value map.',
          correlationId: req.correlationId
        });
        return;
      }

      const record = await objectService.createRecord(
        tenantId,
        id,
        payload,
        req.user?.email || 'system_user'
      );

      res.status(201).json({
        success: true,
        data: record,
        correlationId: req.correlationId
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: 'RECORD_CREATION_FAILED',
        message: err.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * PUT /api/v1/objects/:id/records/:recordId
   * Updates an existing record with schema validation and diff audit logging
   */
  public static async updateRecord(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId || 'tenant_enterprise_ultra_001';
      const { recordId } = req.params;
      const payload = req.body;

      if (!payload || typeof payload !== 'object') {
        res.status(400).json({
          success: false,
          error: 'INVALID_PAYLOAD',
          message: 'Update payload must be a JSON object.',
          correlationId: req.correlationId
        });
        return;
      }

      const updated = await objectService.updateRecord(
        tenantId,
        recordId,
        payload,
        req.user?.email || 'system_user'
      );

      res.json({
        success: true,
        data: updated,
        correlationId: req.correlationId
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: 'RECORD_UPDATE_FAILED',
        message: err.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * DELETE /api/v1/objects/:id/records/:recordId
   * Deletes a dynamic record with audit trail
   */
  public static async deleteRecord(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId || 'tenant_enterprise_ultra_001';
      const { recordId } = req.params;

      const deleted = objectService.deleteRecord(tenantId, recordId, req.user?.email || 'system_user');
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'RECORD_NOT_FOUND',
          message: `Record '${recordId}' does not exist.`,
          correlationId: req.correlationId
        });
        return;
      }

      res.json({
        success: true,
        data: { deleted: true, recordId },
        correlationId: req.correlationId
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: 'RECORD_DELETION_FAILED',
        message: err.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * GET /api/v1/audit-logs
   * Retrieves immutable audit trail records
   */
  public static async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId || 'tenant_enterprise_ultra_001';
      const logs = db.getAuditLogs(tenantId);
      res.json({
        success: true,
        data: logs,
        total: logs.length,
        correlationId: req.correlationId
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: 'AUDIT_QUERY_FAILED',
        message: err.message,
        correlationId: req.correlationId
      });
    }
  }
}
