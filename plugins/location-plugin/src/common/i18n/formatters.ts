import { i18n as globalI18n } from '@hierarchidb/ui-i18n';

export type SupportedLocale = 'en' | 'ja';

const detectLocale = (): SupportedLocale => {
  const lng = globalI18n.language || 'en';
  if (lng.toLowerCase().startsWith('ja')) return 'ja';
  return 'en';
};

export const formatBytes = (bytes: number, locale: SupportedLocale = detectLocale()): string => {
  if (!Number.isFinite(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  return `${formatter.format(value)} ${units[unitIndex]}`;
};

export const formatNumber = (value: number, locale: SupportedLocale = detectLocale()): string => {
  return new Intl.NumberFormat(locale).format(value);
};
