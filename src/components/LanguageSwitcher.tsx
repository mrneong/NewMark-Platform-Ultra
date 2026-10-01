/**
 * NewMark Platform Ultra: Language Switcher Dropdown
 * Provides interactive locale switching between English (en-US) and Tiếng Việt (vi-VN),
 * with flag visual cues, active indicator, and smooth transition.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useLanguage } from '../i18n/context';
import { SupportedLocale } from '../i18n/types';

interface LocaleOption {
  code: SupportedLocale;
  label: string;
  nativeLabel: string;
  flag: string;
}

const LOCALE_OPTIONS: LocaleOption[] = [
  {
    code: 'en-US',
    label: 'English (US)',
    nativeLabel: 'English',
    flag: '🇺🇸'
  },
  {
    code: 'vi-VN',
    label: 'Tiếng Việt (VN)',
    nativeLabel: 'Tiếng Việt',
    flag: '🇻🇳'
  }
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeOption = LOCALE_OPTIONS.find(o => o.code === locale) || LOCALE_OPTIONS[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-xs font-mono text-slate-200 transition-all shadow-sm hover:border-cyan-500/50"
        title="Switch Language / Chuyển Đổi Ngôn Ngữ"
      >
        <span className="text-sm leading-none">{activeOption.flag}</span>
        <span className="font-semibold">{activeOption.code === 'en-US' ? 'EN' : 'VI'}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden font-mono text-xs animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-2 border-b border-slate-800/80 bg-slate-900/50 flex items-center gap-1.5 text-slate-400 text-[10px] uppercase tracking-wider">
            <Globe className="w-3 h-3 text-cyan-400" />
            <span>Select Locale / Ngôn Ngữ</span>
          </div>

          <div className="p-1 space-y-0.5">
            {LOCALE_OPTIONS.map((opt) => {
              const isSelected = opt.code === locale;
              return (
                <button
                  key={opt.code}
                  onClick={() => {
                    setLocale(opt.code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                    isSelected
                      ? 'bg-cyan-950/60 text-cyan-300 font-bold border border-cyan-800/50'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{opt.flag}</span>
                    <div>
                      <div className="text-xs">{opt.label}</div>
                      <div className="text-[10px] text-slate-500 font-normal">{opt.nativeLabel}</div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
