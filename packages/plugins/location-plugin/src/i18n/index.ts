/**
  * i18n utilities for Location Plugin
 * i18n
  */

import { useMemo } from 'react';
import type { LocationPluginTranslations, SupportedLocale } from './types.js';
import { ja } from './ja.js';
import { en } from './en.js';

const translations: Record<SupportedLocale, LocationPluginTranslations> = {
  ja,
  en,
};

const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
    */
export function detectLocale(): SupportedLocale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  const browserLocale = navigator.language.toLowerCase();

  if (browserLocale.startsWith('ja')) {
    return 'ja';
  } else if (browserLocale.startsWith('en')) {
    return 'en';
  }

  return DEFAULT_LOCALE;
}

/**
    */
export function getTranslation(
  locale: SupportedLocale,
  key: string,
  fallback?: string,
): string {
  const translation = translations[locale] || translations[DEFAULT_LOCALE];

  const keys = key.split('.');
  let value: any = translation;

  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) break;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (fallback) {
    return fallback;
  }

  if (locale !== DEFAULT_LOCALE) {
    return getTranslation(DEFAULT_LOCALE, key, key);
  }

  return key;
}

/**
    */
export function useTranslation(locale?: SupportedLocale) {
  const currentLocale = locale || detectLocale();

  const t = useMemo(() => {
    return (key: string, fallback?: string) =>
      getTranslation(currentLocale, key, fallback);
  }, [currentLocale]);

  const translation = useMemo(() =>
      translations[currentLocale] || translations[DEFAULT_LOCALE],
    [currentLocale],
  );

  return {
    t,
    locale: currentLocale,
    translations: translation,
  };
}

/**
    */
export function getLocationTypeName(
  type: string,
  locale: SupportedLocale = detectLocale(),
): string {
  return getTranslation(locale, `locationTypes.${type}`, type);
}

/**
    */
export function getCategoryName(
  category: string,
  locale: SupportedLocale = detectLocale(),
): string {
  return getTranslation(locale, `categories.${category}`, category);
}

/**
    */
export function formatBytes(
  bytes: number,
  locale: SupportedLocale = detectLocale(),
): string {
  const units = locale === 'ja'
    ? ['バイト', 'KB', 'MB', 'GB', 'TB']
    : ['bytes', 'KB', 'MB', 'GB', 'TB'];

  if (bytes === 0) return `0 ${units[0]}`;

  const k = 1024;
  const dm = 2;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / k ** i).toFixed(dm))} ${units[i]}`;
}

/**
    */
export function formatNumber(
  num: number,
  locale: SupportedLocale = detectLocale(),
): string {
  return new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'en-US').format(num);
}

export type { SupportedLocale, LocationPluginTranslations } from './types.js';
export { translations };
