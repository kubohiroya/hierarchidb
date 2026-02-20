import { i18n as globalI18n } from '@hierarchidb/ui-i18n';
import en from '~/ui/locales/en.json' with { type: 'json' };
import ja from '~/ui/locales/ja.json' with { type: 'json' };

type SupportedLocale = 'en' | 'ja';
const bundles: Record<SupportedLocale, any> = { en, ja };

const detectLocale = (): SupportedLocale => {
  const lng = globalI18n.language || 'en';
  if (lng.toLowerCase().startsWith('ja')) return 'ja';
  return 'en';
};

export const useTranslation = (ns: string = 'route-plugin') => {
  const locale = detectLocale();
  const translations = bundles[locale] ?? bundles.en;
  const t = (key: string, fallback?: string) =>
    String(globalI18n.t(key, { ns, defaultValue: fallback ?? key }));
  return { t, translations, locale };
};

export const getRouteTypeName = (
  type: string,
  locale: SupportedLocale = detectLocale(),
): string => {
  return String(globalI18n.t(`routeTypes.${type}`, { ns: 'route-plugin', lng: locale, defaultValue: type }));
};

export const getTransportModeName = (
  mode: string,
  locale: SupportedLocale = detectLocale(),
): string => {
  return String(globalI18n.t(`transportModes.${mode}`, { ns: 'route-plugin', lng: locale, defaultValue: mode }));
};

export const getCategoryName = (
  category: string,
  locale: SupportedLocale = detectLocale(),
): string => {
  return String(globalI18n.t(`categories.${category}`, { ns: 'route-plugin', lng: locale, defaultValue: category }));
};

export const formatDistance = (
  meters: number,
  locale: SupportedLocale = detectLocale(),
): string => {
  if (!Number.isFinite(meters)) return '0 km';
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return `${formatter.format(km)} km`;
};

export const formatDuration = (
  seconds: number,
  locale: SupportedLocale = detectLocale(),
): string => {
  if (!Number.isFinite(seconds)) return '0 min';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(hours) + (locale === 'ja' ? '時間' : 'h')
      + ` ${minutes}${locale === 'ja' ? '分' : 'min'}`;
  }
  return `${minutes}${locale === 'ja' ? '分' : 'min'}`;
};

export type { SupportedLocale };
