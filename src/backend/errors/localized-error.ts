/**
 * NewMark Platform Ultra: Localized RFC 7807 Problem Details Error Architecture
 * Formats backend exceptions into standardized, localized error envelopes.
 */

import { Response, Request } from 'express';
import { SupportedLocale } from '../../i18n/types';
import { enLocale } from '../../i18n/locales/en';
import { viLocale } from '../../i18n/locales/vi';

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'TOKEN_EXPIRED'
  | 'TENANT_BOUNDARY_VIOLATION'
  | 'INSUFFICIENT_STOCK'
  | 'CONCURRENCY_LOCK_FAILED'
  | 'RESOURCE_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_SERVER_ERROR'
  | 'INVALID_STATE_TRANSITION'
  | 'DISBURSEMENT_PREREQUISITE_FAILED';

const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  TOKEN_EXPIRED: 401,
  TENANT_BOUNDARY_VIOLATION: 403,
  INSUFFICIENT_STOCK: 400,
  CONCURRENCY_LOCK_FAILED: 409,
  RESOURCE_NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  INTERNAL_SERVER_ERROR: 500,
  INVALID_STATE_TRANSITION: 409,
  DISBURSEMENT_PREREQUISITE_FAILED: 400
};

export class LocalizedHttpError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;

  constructor(code: ErrorCode, message?: string, details?: Record<string, any>) {
    super(message || code);
    this.name = 'LocalizedHttpError';
    this.code = code;
    this.statusCode = ERROR_STATUS_MAP[code] || 500;
    this.details = details;
  }
}

/**
 * Returns localized error message based on locale
 */
export function getLocalizedErrorMessage(code: ErrorCode, locale: SupportedLocale = 'en-US'): string {
  const dict = locale === 'vi-VN' ? viLocale.errors : enLocale.errors;

  switch (code) {
    case 'UNAUTHORIZED':
      return dict.unauthorized;
    case 'FORBIDDEN':
      return dict.forbidden;
    case 'TOKEN_EXPIRED':
      return dict.tokenExpired;
    case 'TENANT_BOUNDARY_VIOLATION':
      return dict.tenantBoundaryViolation;
    case 'INSUFFICIENT_STOCK':
      return dict.insufficientStock;
    case 'CONCURRENCY_LOCK_FAILED':
      return dict.concurrencyLockFailed;
    case 'RESOURCE_NOT_FOUND':
      return dict.resourceNotFound;
    case 'VALIDATION_ERROR':
      return dict.validationError;
    case 'INTERNAL_SERVER_ERROR':
      return dict.internalServerError;
    case 'INVALID_STATE_TRANSITION':
      return dict.invalidStateTransition;
    case 'DISBURSEMENT_PREREQUISITE_FAILED':
      return dict.disbursementPrerequisiteFailed;
    default:
      return dict.internalServerError;
  }
}

/**
 * RFC 7807 Problem Details Response Formatter
 */
export function sendLocalizedProblemDetails(
  res: Response,
  req: Request,
  code: ErrorCode,
  overrideDetail?: string,
  extraPayload?: Record<string, any>
): void {
  const locale: SupportedLocale = (req as any).locale || 'en-US';
  const statusCode = ERROR_STATUS_MAP[code] || 500;
  const localizedMessage = getLocalizedErrorMessage(code, locale);

  const problemDetails = {
    type: `https://newmark.ultra/errors/${code.toLowerCase()}`,
    title: code,
    status: statusCode,
    detail: overrideDetail || localizedMessage,
    instance: req.originalUrl,
    locale,
    correlationId: req.correlationId || `corr_${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...extraPayload
  };

  res.status(statusCode).json(problemDetails);
}
