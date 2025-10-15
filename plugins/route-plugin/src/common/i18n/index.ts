/**
  * i18n utilities for Route Plugin
 * i18n
  */

import { useMemo } from 'react';
import type { RoutePluginTranslations, SupportedLocale } from './types.js';
import { ja } from './ja.js';
import { en } from './en.js';

const translations: Record<SupportedLocale, RoutePluginTranslations> = {
  ja,
  en,
};

const DEFAULT_LOCALE: SupportedLocale = 'ja';

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
export function getRouteTypeName(
  type: string,
  locale: SupportedLocale = detectLocale(),
): string {
  return getTranslation(locale, `routeTypes.${type}`, type);
}

/**
    */
export function getTransportModeName(
  mode: string,
  locale: SupportedLocale = detectLocale(),
): string {
  return getTranslation(locale, `transportModes.${mode}`, mode);
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
export function formatDistance(
  meters: number,
  locale: SupportedLocale = detectLocale(),
): string {
  if (meters < 1000) {
    return locale === 'ja' ? `${meters}m` : `${meters}m`;
  } else {
    const km = Math.round(meters / 100) / 10;
    return locale === 'ja' ? `${km}km` : `${km}km`;
  }
}

/**
    */
export function formatDuration(
  seconds: number,
  locale: SupportedLocale = detectLocale(),
): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (locale === 'ja') {
    if (hours > 0) {
      return `${hours}時間${minutes}分`;
    } else {
      return `${minutes}分`;
    }
  } else {
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    } else {
      return `${minutes}min`;
    }
  }
}

export type { SupportedLocale, RoutePluginTranslations } from './types.js';
export { translations };