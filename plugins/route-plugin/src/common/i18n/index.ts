import { i18n as globalI18n } from '@hierarchidb/ui-i18n';

type SupportedLocale = 'en' | 'ja';

const detectLocale = (): SupportedLocale => {
  const lng = globalI18n.language || 'en';
  if (lng.toLowerCase().startsWith('ja')) return 'ja';
  return 'en';
};

// Custom useTranslation removed — use { useTranslation } from '@hierarchidb/ui-i18n' instead.
// Resource registration is handled by ~/ui/i18n.ts (addResourceBundle).

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
