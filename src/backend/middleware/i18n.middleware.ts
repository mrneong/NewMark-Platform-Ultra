/**
 * NewMark Platform Ultra: Backend i18n & Locale Extraction Middleware
 * Inspects Accept-Language header, cookies, and query params to establish request locale,
 * attaches localized translator helpers, and sets Content-Language response headers.
 */

import { Request, Response, NextFunction } from 'express';
import { SupportedLocale } from '../../i18n/types';
import { enLocale } from '../../i18n/locales/en';
import { viLocale } from '../../i18n/locales/vi';

declare global {
  namespace Express {
    interface Request {
      locale?: SupportedLocale;
      t?: (keyPath: string, params?: Record<string, string | number>) => string;
    }
  }
}

export function i18nMiddleware(req: Request, res: Response, next: NextFunction): void {
  let detectedLocale: SupportedLocale = 'en-US';

  // 1. Query parameter override (?lang=vi or ?locale=vi-VN)
  const queryLang = (req.query.lang as string) || (req.query.locale as string);
  if (queryLang) {
    if (queryLang.toLowerCase().startsWith('vi')) {
      detectedLocale = 'vi-VN';
    } else if (queryLang.toLowerCase().startsWith('en')) {
      detectedLocale = 'en-US';
    }
  } else {
    // 2. Cookie extraction
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const match = cookieHeader.match(/newmark_locale=([^;]+)/);
      if (match && (match[1] === 'vi-VN' || match[1] === 'en-US')) {
        detectedLocale = match[1] as SupportedLocale;
      }
    }

    // 3. Accept-Language header extraction if cookie not matched
    if (detectedLocale === 'en-US' && req.headers['accept-language']) {
      const acceptLang = req.headers['accept-language'].toLowerCase();
      // Look for vi-VN or vi preference
      if (acceptLang.startsWith('vi') || acceptLang.includes(',vi') || acceptLang.includes('vi-vn')) {
        detectedLocale = 'vi-VN';
      }
    }
  }

  req.locale = detectedLocale;
  res.setHeader('Content-Language', detectedLocale);

  // Attach server-side translation helper
  const dictionary = detectedLocale === 'vi-VN' ? viLocale : enLocale;
  req.t = (keyPath: string, params?: Record<string, string | number>): string => {
    const keys = keyPath.split('.');
    let current: any = dictionary;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return keyPath;
      }
    }

    if (typeof current !== 'string') return keyPath;

    if (params) {
      return Object.entries(params).reduce((str, [pKey, val]) => {
        return str.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(val));
      }, current);
    }

    return current;
  };

  next();
}
