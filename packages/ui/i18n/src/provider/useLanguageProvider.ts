import { enUS, ja } from 'date-fns/locale';
import { useCallback, useEffect, useState } from 'react';
import type { i18n as I18nInstance } from 'i18next';
import { isDevEnv } from '~/utils/env';

// Avoid hard type dependency on date-fns types during DTS stage
type Locale = unknown;

export interface LanguageConfig {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  direction: 'ltr' | 'rtl';
  dateLocale: Locale;
}

export interface LanguageContextType {
  currentLanguage: LanguageConfig;
  supportedLanguages: LanguageConfig[];
  changeLanguage: (languageCode: string) => Promise<void>;
  isLoading: boolean;
  formatters: {
    number: Intl.NumberFormat;
    currency: Intl.NumberFormat;
    date: Intl.DateTimeFormat;
    time: Intl.DateTimeFormat;
    relativeTime: Intl.RelativeTimeFormat;
  };
}

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    direction: 'ltr',
    dateLocale: enUS,
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    direction: 'ltr',
    dateLocale: ja,
  },
];

export const defaultContextValue: LanguageContextType = {
  currentLanguage: SUPPORTED_LANGUAGES[0] || {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    direction: 'ltr',
    dateLocale: enUS,
  },
  supportedLanguages: SUPPORTED_LANGUAGES,
  changeLanguage: async () => {
    /* no-op for SSR */
  },
  isLoading: false,
  formatters: {
    number: { format: (n: number) => n.toString() } as Intl.NumberFormat,
    currency: { format: (n: number) => `$${n}` } as Intl.NumberFormat,
    date: {
      format: (d: Date) => d.toLocaleDateString(),
    } as Intl.DateTimeFormat,
    time: {
      format: (d: Date) => d.toLocaleTimeString(),
    } as Intl.DateTimeFormat,
    relativeTime: {
      format: (value: number, unit: Intl.RelativeTimeFormatUnit) => `${value} ${unit}s ago`,
    } as Intl.RelativeTimeFormat,
  },
};

const fallbackLanguage: LanguageConfig = {
  code: 'en',
  name: 'English',
  nativeName: 'English',
  flag: '🇺🇸',
  direction: 'ltr',
  dateLocale: enUS,
};

const createFormatters = (locale: string) => ({
  number: new Intl.NumberFormat(locale),
  currency: new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
  }),
  date: new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }),
  time: new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }),
  relativeTime: new Intl.RelativeTimeFormat(locale, {
    numeric: 'auto',
  }),
});

const resolveCurrentLanguage = (i18n: I18nInstance): LanguageConfig => {
  const fallbackLng = i18n.options?.fallbackLng;
  const currentLang =
    i18n.language ||
    (Array.isArray(fallbackLng)
      ? fallbackLng[0]
      : typeof fallbackLng === 'string'
        ? fallbackLng
        : 'en');

  return (
    SUPPORTED_LANGUAGES.find((lang) => lang.code === currentLang) ||
    SUPPORTED_LANGUAGES[0] ||
    fallbackLanguage
  );
};

export function useLanguageProviderMountState(): boolean {
  const [isMounted, setIsMounted] = useState<boolean>(
    typeof window === 'undefined',
  );

  useEffect(() => {
    if (!isMounted) {
      setIsMounted(true);
    }
  }, [isMounted]);

  return isMounted;
}

export interface UseLanguageProviderStateResult {
  contextValue: LanguageContextType;
  adapterLocale: LanguageConfig['dateLocale'];
}

export function useLanguageProviderState(
  i18n: I18nInstance,
): UseLanguageProviderStateResult {
  const [isLoading, setIsLoading] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<LanguageConfig>(() =>
    resolveCurrentLanguage(i18n),
  );
  const [formatters, setFormatters] = useState(() =>
    createFormatters(currentLanguage.code),
  );

  const changeLanguage = useCallback(
    async (languageCode: string): Promise<void> => {
      const targetLanguage = SUPPORTED_LANGUAGES.find(
        (lang) => lang.code === languageCode,
      );
      if (!targetLanguage) {
        if (isDevEnv()) {
          console.warn(`Language ${languageCode} not supported`);
        }
        return;
      }

      setIsLoading(true);
      try {
        await i18n.changeLanguage(languageCode);
        setCurrentLanguage(targetLanguage);
        setFormatters(createFormatters(languageCode));

        if (typeof document !== 'undefined') {
          document.documentElement.lang = languageCode;
          document.documentElement.dir = targetLanguage.direction;
        }

        if (typeof window !== 'undefined') {
          localStorage.setItem('preferred-language', languageCode);
        }
      } catch (error) {
        if (isDevEnv()) {
          console.error('Failed to change language:', error);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [i18n],
  );

  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      const newLanguage = SUPPORTED_LANGUAGES.find((lang) => lang.code === lng);
      if (!newLanguage || newLanguage.code === currentLanguage.code) {
        return;
      }

      setCurrentLanguage(newLanguage);
      setFormatters(createFormatters(lng));
      if (typeof document !== 'undefined') {
        document.documentElement.lang = lng;
        document.documentElement.dir = newLanguage.direction;
      }
    };

    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [currentLanguage.code, i18n]);

  return {
    contextValue: {
      currentLanguage,
      supportedLanguages: SUPPORTED_LANGUAGES,
      changeLanguage,
      isLoading,
      formatters,
    },
    adapterLocale: currentLanguage.dateLocale,
  };
}

export const detectUserLanguage = (): string => {
  const stored =
    typeof window !== 'undefined'
      ? localStorage.getItem('preferred-language')
      : null;
  if (stored && SUPPORTED_LANGUAGES.some((lang) => lang.code === stored)) {
    return stored;
  }

  const browserLang =
    typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
  const foundLang = SUPPORTED_LANGUAGES.find((lang) => lang.code === browserLang);
  if (foundLang) {
    return foundLang.code;
  }

  return 'en';
};
