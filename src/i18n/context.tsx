/**
 * NewMark Platform Ultra: Enterprise Internationalization Context
 * Provides active locale state, persistence, deep-key translation hook with interpolation,
 * and locale-tailored Currency, Number, and DateTime formatters.
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { SupportedLocale, TranslationDictionary } from './types';
import { enLocale } from './locales/en';
import { viLocale } from './locales/vi';

interface LanguageContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  dictionary: TranslationDictionary;
  t: (keyPath: string, params?: Record<string, string | number>) => string;
  formatCurrency: (amount: number, currency?: string) => string;
  formatDateTime: (date: string | Date | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}

const dictionaries: Record<SupportedLocale, TranslationDictionary> = {
  'en-US': enLocale,
  'vi-VN': viLocale
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    // 1. Check localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('newmark_locale') as SupportedLocale | null;
      if (stored && (stored === 'en-US' || stored === 'vi-VN')) {
        return stored;
      }
      // 2. Check navigator language
      if (navigator.language && navigator.language.toLowerCase().startsWith('vi')) {
        return 'vi-VN';
      }
    }
    return 'en-US';
  });

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('newmark_locale', newLocale);
      document.cookie = `newmark_locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, []);

  const dictionary = useMemo(() => dictionaries[locale] || enLocale, [locale]);

  // Deep-key translation function with parameter interpolation
  const t = useCallback((keyPath: string, params?: Record<string, string | number>): string => {
    const keys = keyPath.split('.');
    let current: any = dictionary;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        // Fallback to English dictionary
        let fallback: any = enLocale;
        for (const fbKey of keys) {
          if (fallback && typeof fallback === 'object' && fbKey in fallback) {
            fallback = fallback[fbKey];
          } else {
            return keyPath; // Key not found
          }
        }
        current = fallback;
        break;
      }
    }

    if (typeof current !== 'string') {
      return keyPath;
    }

    // Interpolation {param}
    if (params) {
      return Object.entries(params).reduce((str, [paramKey, val]) => {
        return str.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
      }, current);
    }

    return current;
  }, [dictionary]);

  // Currency Formatter
  const formatCurrency = useCallback((amount: number, currency: string = 'USD'): string => {
    try {
      if (locale === 'vi-VN') {
        // If USD, format with USD symbol, if VND format with ₫
        return new Intl.NumberFormat('vi-VN', {
          style: 'currency',
          currency,
          maximumFractionDigits: currency === 'VND' ? 0 : 2
        }).format(amount);
      }
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2
      }).format(amount);
    } catch {
      return `${amount} ${currency}`;
    }
  }, [locale]);

  // DateTime Formatter
  const formatDateTime = useCallback((date: string | Date | number, options?: Intl.DateTimeFormatOptions): string => {
    try {
      const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
      const defaultOpts: Intl.DateTimeFormatOptions = options || {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      };
      return new Intl.DateTimeFormat(locale, defaultOpts).format(d);
    } catch {
      return String(date);
    }
  }, [locale]);

  // Number Formatter
  const formatNumber = useCallback((value: number, options?: Intl.NumberFormatOptions): string => {
    try {
      return new Intl.NumberFormat(locale, options).format(value);
    } catch {
      return String(value);
    }
  }, [locale]);

  const value = useMemo(() => ({
    locale,
    setLocale,
    dictionary,
    t,
    formatCurrency,
    formatDateTime,
    formatNumber
  }), [locale, setLocale, dictionary, t, formatCurrency, formatDateTime, formatNumber]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
