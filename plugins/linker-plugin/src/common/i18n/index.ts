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

export const useTranslation = (ns: string = 'linker-plugin') => {
  const locale = detectLocale();
  const translations = bundles[locale] ?? bundles.en;
  const t = (key: string, fallback?: string, options?: Record<string, unknown>) =>
    String(globalI18n.t(key, { ns, defaultValue: fallback ?? key, ...options }));
  return { t, translations, locale };
};

export type { SupportedLocale };
