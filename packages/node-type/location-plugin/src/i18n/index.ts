/**
 * i18n utilities for Location Plugin
 * ロケーションプラグインのi18nユーティリティ
 */

import { useMemo } from 'react';
import type { SupportedLocale, LocationPluginTranslations } from './types';
import { ja } from './ja';
import { en } from './en';

// 翻訳データ
const translations: Record<SupportedLocale, LocationPluginTranslations> = {
  ja,
  en,
};

// デフォルトロケール
const DEFAULT_LOCALE: SupportedLocale = 'ja';

/**
 * ブラウザの言語設定から適切なロケールを取得
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
 * 翻訳テキストを取得する関数
 */
export function getTranslation(
  locale: SupportedLocale, 
  key: string, 
  fallback?: string
): string {
  const translation = translations[locale] || translations[DEFAULT_LOCALE];
  
  // キーをドット記法で分解
  const keys = key.split('.');
  let value: any = translation;
  
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) break;
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  // フォールバック
  if (fallback) {
    return fallback;
  }
  
  // デフォルトロケールでリトライ
  if (locale !== DEFAULT_LOCALE) {
    return getTranslation(DEFAULT_LOCALE, key, key);
  }
  
  return key;
}

/**
 * 翻訳フック
 */
export function useTranslation(locale?: SupportedLocale) {
  const currentLocale = locale || detectLocale();
  
  const t = useMemo(() => {
    return (key: string, fallback?: string) => 
      getTranslation(currentLocale, key, fallback);
  }, [currentLocale]);
  
  const translation = useMemo(() => 
    translations[currentLocale] || translations[DEFAULT_LOCALE], 
    [currentLocale]
  );
  
  return {
    t,
    locale: currentLocale,
    translations: translation,
  };
}

/**
 * ヘルパー関数：地点タイプ名を取得
 */
export function getLocationTypeName(
  type: string, 
  locale: SupportedLocale = detectLocale()
): string {
  return getTranslation(locale, `locationTypes.${type}`, type);
}

/**
 * ヘルパー関数：カテゴリ名を取得
 */
export function getCategoryName(
  category: string, 
  locale: SupportedLocale = detectLocale()
): string {
  return getTranslation(locale, `categories.${category}`, category);
}

/**
 * ヘルパー関数：バイト数をローカライズされた形式でフォーマット
 */
export function formatBytes(
  bytes: number, 
  locale: SupportedLocale = detectLocale()
): string {
  const units = locale === 'ja' 
    ? ['バイト', 'KB', 'MB', 'GB', 'TB']
    : ['bytes', 'KB', 'MB', 'GB', 'TB'];
    
  if (bytes === 0) return `0 ${units[0]}`;
  
  const k = 1024;
  const dm = 2;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${units[i]}`;
}

/**
 * ヘルパー関数：数値をローカライズされた形式でフォーマット
 */
export function formatNumber(
  num: number, 
  locale: SupportedLocale = detectLocale()
): string {
  return new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'en-US').format(num);
}

// エクスポート
export type { SupportedLocale, LocationPluginTranslations } from './types';
export { translations };