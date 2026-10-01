/**
 * NewMark Platform Ultra: Dynamic Schema & Object Manager Service
 * Implements schema definition, field constraint validation, dynamic record CRUD,
 * row-level security (RLS), and comprehensive enterprise audit trails.
 */

import { db, CustomObjectDefinition, CustomFieldDefinition, DynamicRecord } from '../lib/db';
import { redis } from '../lib/redis';

export interface CreateObjectInput {
  tenantId: string;
  name: string;
  apiName: string;
  description: string;
  icon?: string;
  primaryField?: string;
  fields: Omit<CustomFieldDefinition, 'id' | 'customObjectId'>[];
  actorId?: string;
}

export interface ValidationIssue {
  field: string;
  rule: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  sanitizedData: Record<string, any>;
}

export interface QueryRecordsOptions {
  customObjectId?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export class ObjectService {
  /**
   * Registers a new custom object schema with fields and validation rules
   */
  public async defineCustomObject(input: CreateObjectInput): Promise<CustomObjectDefinition> {
    const { tenantId, name, apiName, description, icon = 'Box', fields, actorId = 'system_architect' } = input;

    // Validate API name format (lowercase alphanumeric and underscores)
    if (!/^[a-z0-9_]{2,64}$/.test(apiName)) {
      throw new Error(`Invalid API Name '${apiName}'. Must be 2-64 lowercase alphanumeric characters and underscores.`);
    }

    const existing = db.getCustomObjectByApiName(tenantId, apiName);
    if (existing) {
      throw new Error(`Custom object with API name '${apiName}' already exists in tenant [${tenantId}].`);
    }

    const objectId = `obj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fieldsWithIds: CustomFieldDefinition[] = fields.map((f, idx) => {
      if (!/^[a-zA-Z0-9_]{1,64}$/.test(f.apiName)) {
        throw new Error(`Invalid field apiName '${f.apiName}'. Must be alphanumeric with underscores.`);
      }
      return {
        ...f,
        id: `fld_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        customObjectId: objectId
      };
    });

    const newObj: CustomObjectDefinition = {
      id: objectId,
      tenantId,
      name: name.trim(),
      apiName: apiName.trim(),
      description: description.trim(),
      icon,
      primaryField: input.primaryField || (fieldsWithIds[0]?.apiName || 'id'),
      fields: fieldsWithIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.saveCustomObject(newObj);

    db.logAudit({
      tenantId,
      actorId,
      action: 'SCHEMA_CREATED',
      entityType: 'CUSTOM_OBJECT',
      entityId: newObj.id,
      payloadAfter: newObj
    });

    redis.publish('schema.object.created', tenantId, 'ObjectService.defineCustomObject', {
      objectId: newObj.id,
      apiName: newObj.apiName,
      fieldCount: newObj.fields.length
    });

    return newObj;
  }

  /**
   * Appends a new field definition to an existing custom object schema
   */
  public async addFieldToObject(
    tenantId: string,
    objectId: string,
    fieldInput: Omit<CustomFieldDefinition, 'id' | 'customObjectId'>,
    actorId: string = 'system_architect'
  ): Promise<CustomObjectDefinition> {
    const obj = db.getCustomObjectById(objectId);
    if (!obj || obj.tenantId !== tenantId) {
      throw new Error(`Custom object '${objectId}' not found.`);
    }

    const existingField = obj.fields.find(f => f.apiName === fieldInput.apiName);
    if (existingField) {
      throw new Error(`Field with API name '${fieldInput.apiName}' already exists on object '${obj.name}'.`);
    }

    const newField: CustomFieldDefinition = {
      ...fieldInput,
      id: `fld_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      customObjectId: objectId
    };

    obj.fields.push(newField);
    obj.updatedAt = new Date().toISOString();

    db.saveCustomObject(obj);

    db.logAudit({
      tenantId,
      actorId,
      action: 'SCHEMA_FIELD_ADDED',
      entityType: 'CUSTOM_OBJECT',
      entityId: obj.id,
      payloadAfter: newField
    });

    redis.publish('schema.field.added', tenantId, 'ObjectService.addFieldToObject', {
      objectId: obj.id,
      fieldApiName: newField.apiName,
      fieldType: newField.type
    });

    return obj;
  }

  /**
   * Dynamic schema payload validator with type coercion and constraint checks
   */
  public validateRecordPayload(
    customObject: CustomObjectDefinition,
    payload: Record<string, any>
  ): ValidationResult {
    const errors: ValidationIssue[] = [];
    const sanitized: Record<string, any> = {};

    for (const field of customObject.fields) {
      const rawVal = payload[field.apiName];

      // Required field check
      if (field.isRequired && (rawVal === undefined || rawVal === null || rawVal === '')) {
        errors.push({
          field: field.apiName,
          rule: 'REQUIRED',
          message: `Field '${field.name}' (${field.apiName}) is mandatory and cannot be empty.`
        });
        continue;
      }

      // Handle undefined / null non-required values with defaults
      if (rawVal === undefined || rawVal === null || rawVal === '') {
        if (field.defaultValue !== undefined) {
          sanitized[field.apiName] = field.defaultValue;
        }
        continue;
      }

      // Type-specific validation and conversion
      switch (field.type) {
        case 'STRING':
          if (typeof rawVal !== 'string' && typeof rawVal !== 'number') {
            errors.push({
              field: field.apiName,
              rule: 'TYPE_MISMATCH',
              message: `Field '${field.apiName}' requires string value, received ${typeof rawVal}.`
            });
          } else {
            const strVal = String(rawVal).trim();
            if (field.validationRules?.regex) {
              const regex = new RegExp(field.validationRules.regex);
              if (!regex.test(strVal)) {
                errors.push({
                  field: field.apiName,
                  rule: 'REGEX_PATTERN_MISMATCH',
                  message: `Field '${field.apiName}' value '${strVal}' does not match pattern ${field.validationRules.regex}.`
                });
              }
            }
            sanitized[field.apiName] = strVal;
          }
          break;

        case 'NUMBER':
          const num = Number(rawVal);
          if (isNaN(num)) {
            errors.push({
              field: field.apiName,
              rule: 'TYPE_MISMATCH',
              message: `Field '${field.apiName}' must be a valid numeric value, received '${rawVal}'.`
            });
          } else {
            if (field.validationRules?.min !== undefined && num < field.validationRules.min) {
              errors.push({
                field: field.apiName,
                rule: 'MIN_VALUE_VIOLATION',
                message: `Field '${field.apiName}' value (${num}) cannot be less than minimum allowed (${field.validationRules.min}).`
              });
            }
            if (field.validationRules?.max !== undefined && num > field.validationRules.max) {
              errors.push({
                field: field.apiName,
                rule: 'MAX_VALUE_VIOLATION',
                message: `Field '${field.apiName}' value (${num}) cannot exceed maximum allowed (${field.validationRules.max}).`
              });
            }
            sanitized[field.apiName] = num;
          }
          break;

        case 'BOOLEAN':
          sanitized[field.apiName] = typeof rawVal === 'boolean'
            ? rawVal
            : rawVal === 'true' || rawVal === 1 || rawVal === '1';
          break;

        case 'DATE':
          const parsedDate = new Date(rawVal);
          if (isNaN(parsedDate.getTime())) {
            errors.push({
              field: field.apiName,
              rule: 'INVALID_DATE_FORMAT',
              message: `Field '${field.apiName}' must be a valid ISO-8601 date string.`
            });
          } else {
            sanitized[field.apiName] = parsedDate.toISOString();
          }
          break;

        case 'ENUM':
          const allowed = field.validationRules?.allowedValues || [];
          const strEnumVal = String(rawVal);
          if (allowed.length > 0 && !allowed.includes(strEnumVal)) {
            errors.push({
              field: field.apiName,
              rule: 'ENUM_VALUE_DISALLOWED',
              message: `Field '${field.apiName}' value '${strEnumVal}' is not valid. Allowed options: [${allowed.join(', ')}].`
            });
          } else {
            sanitized[field.apiName] = strEnumVal;
          }
          break;

        case 'JSON':
          try {
            sanitized[field.apiName] = typeof rawVal === 'string' ? JSON.parse(rawVal) : rawVal;
          } catch (e) {
            errors.push({
              field: field.apiName,
              rule: 'INVALID_JSON',
              message: `Field '${field.apiName}' must be valid JSON object or array.`
            });
          }
          break;

        default:
          sanitized[field.apiName] = rawVal;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitizedData: sanitized
    };
  }

  /**
   * Creates a validated dynamic record with audit trail
   */
  public async createRecord(
    tenantId: string,
    customObjectId: string,
    data: Record<string, any>,
    actorId: string = 'system_user'
  ): Promise<DynamicRecord> {
    const customObj = db.getCustomObjectById(customObjectId);
    if (!customObj || customObj.tenantId !== tenantId) {
      throw new Error(`Custom object with ID '${customObjectId}' not found in tenant [${tenantId}].`);
    }

    const validation = this.validateRecordPayload(customObj, data);
    if (!validation.valid) {
      const errSummary = validation.errors.map(e => `${e.field}: ${e.message}`).join('; ');
      throw new Error(`Dynamic Record Validation Failed: ${errSummary}`);
    }

    const newRecord: DynamicRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tenantId,
      customObjectId,
      data: validation.sanitizedData,
      createdBy: actorId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.saveRecord(newRecord);

    db.logAudit({
      tenantId,
      actorId,
      action: 'RECORD_CREATED',
      entityType: 'DYNAMIC_RECORD',
      entityId: newRecord.id,
      payloadAfter: newRecord.data
    });

    redis.publish('record.created', tenantId, 'ObjectService.createRecord', {
      recordId: newRecord.id,
      customObjectId,
      objectApiName: customObj.apiName
    });

    return newRecord;
  }

  /**
   * Queries records with sorting, filtering, and pagination
   */
  public queryRecords(tenantId: string, options: QueryRecordsOptions = {}): {
    records: DynamicRecord[];
    total: number;
    limit: number;
    offset: number;
  } {
    let records = db.getRecords(tenantId, options.customObjectId);

    // Apply Filters
    if (options.filters) {
      records = records.filter(r => {
        return Object.entries(options.filters!).every(([key, expected]) => {
          const val = r.data[key];
          if (expected === undefined || expected === null) return true;
          return String(val).toLowerCase().includes(String(expected).toLowerCase());
        });
      });
    }

    // Apply Sorting
    if (options.sortBy) {
      const sortKey = options.sortBy;
      const order = options.sortOrder === 'desc' ? -1 : 1;
      records.sort((a, b) => {
        const valA = a.data[sortKey] ?? a[sortKey as keyof DynamicRecord];
        const valB = b.data[sortKey] ?? b[sortKey as keyof DynamicRecord];
        if (valA === valB) return 0;
        if (valA === undefined) return 1;
        if (valB === undefined) return -1;
        return valA > valB ? order : -order;
      });
    }

    const total = records.length;
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    const paginated = records.slice(offset, offset + limit);

    return {
      records: paginated,
      total,
      limit,
      offset
    };
  }

  /**
   * Updates an existing record with schema validation and before/after diff logging
   */
  public async updateRecord(
    tenantId: string,
    recordId: string,
    updates: Record<string, any>,
    actorId: string = 'system_user'
  ): Promise<DynamicRecord> {
    const existing = db.getRecordById(recordId);
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error(`Record with ID '${recordId}' not found in tenant [${tenantId}].`);
    }

    const customObj = db.getCustomObjectById(existing.customObjectId);
    if (!customObj) {
      throw new Error(`Custom object schema not found for record '${recordId}'.`);
    }

    const merged = { ...existing.data, ...updates };
    const validation = this.validateRecordPayload(customObj, merged);
    if (!validation.valid) {
      const errSummary = validation.errors.map(e => `${e.field}: ${e.message}`).join('; ');
      throw new Error(`Record Update Validation Failed: ${errSummary}`);
    }

    const payloadBefore = { ...existing.data };
    existing.data = validation.sanitizedData;
    existing.updatedAt = new Date().toISOString();

    db.saveRecord(existing);

    db.logAudit({
      tenantId,
      actorId,
      action: 'RECORD_UPDATED',
      entityType: 'DYNAMIC_RECORD',
      entityId: existing.id,
      payloadBefore,
      payloadAfter: existing.data
    });

    redis.publish('record.updated', tenantId, 'ObjectService.updateRecord', {
      recordId: existing.id,
      customObjectId: existing.customObjectId
    });

    return existing;
  }

  /**
   * Deletes a dynamic record with audit logging
   */
  public deleteRecord(tenantId: string, recordId: string, actorId: string = 'system_user'): boolean {
    const existing = db.getRecordById(recordId);
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error(`Record with ID '${recordId}' not found.`);
    }

    const deleted = db.deleteRecord(tenantId, recordId);
    if (deleted) {
      db.logAudit({
        tenantId,
        actorId,
        action: 'RECORD_DELETED',
        entityType: 'DYNAMIC_RECORD',
        entityId: recordId,
        payloadBefore: existing.data
      });

      redis.publish('record.deleted', tenantId, 'ObjectService.deleteRecord', {
        recordId,
        customObjectId: existing.customObjectId
      });
    }

    return deleted;
  }
}

export const objectService = new ObjectService();
