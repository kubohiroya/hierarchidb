/**
 * Language Provider Component
 *
 * This component provides language switching functionality and integrates
 * with the Material-UI theme system for locale-aware formatting.
 */

import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enUS, ja } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { devError, devWarn } from "@hierarchidb/common-core";

// Language configuration
export interface LanguageConfig {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  direction: 'ltr' | 'rtl';
  dateLocale: Locale;
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

// Language theme
interface LanguageContextType {
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

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Default theme value for SSR
const defaultContextValue: LanguageContextType = {
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

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);

  // During SSR or when provider is not available, return default values
  if (!context) {
    if (typeof window === 'undefined') {
      return defaultContextValue;
    }
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Language Provider Props
interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // During SSR, provide default theme
  if (!isMounted) {
    return (
      <LanguageContext.Provider value={defaultContextValue}>{children}</LanguageContext.Provider>
    );
  }

  return <LanguageProviderClient>{children}</LanguageProviderClient>;
};

const LanguageProviderClient: React.FC<LanguageProviderProps> = ({ children }) => {
  const [isI18nReady, setIsI18nReady] = useState(false);

  // Ensure i18n is loaded
  useEffect(() => {
    // Delay i18n initialization to ensure React is ready
    const timer = setTimeout(() => {
      import('../i18n/index').then(() => {
        setIsI18nReady(true);
      });
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  if (!isI18nReady) {
    return (
      <LanguageContext.Provider value={defaultContextValue}>{children}</LanguageContext.Provider>
    );
  }

  return <LanguageProviderInner>{children}</LanguageProviderInner>;
};

const LanguageProviderInner: React.FC<LanguageProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  // Get current language configuration
  const getCurrentLanguage = (): LanguageConfig => {
    const fallbackLng = i18n.options?.fallbackLng;
    const currentLang =
      i18n.language ||
      (Array.isArray(fallbackLng)
        ? fallbackLng[0]
        : typeof fallbackLng === 'string'
          ? fallbackLng
          : 'en');
    const foundLang = SUPPORTED_LANGUAGES.find((lang) => lang.code === currentLang);
    // Always return a valid LanguageConfig, defaulting to English
    return (
      foundLang ||
      SUPPORTED_LANGUAGES[0] || {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        flag: '🇺🇸',
        direction: 'ltr' as const,
        dateLocale: enUS,
      }
    );
  };

  const [currentLanguage, setCurrentLanguage] = useState<LanguageConfig>(getCurrentLanguage);

  // Create locale-aware formatters
  const createFormatters = (locale: string) => ({
    number: new Intl.NumberFormat(locale),
    currency: new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD', // Default currency, can be made configurable
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

  const [formatters, setFormatters] = useState(() => createFormatters(currentLanguage.code));

  // Change language function
  const changeLanguage = async (languageCode: string): Promise<void> => {
    const targetLanguage = SUPPORTED_LANGUAGES.find((lang) => lang.code === languageCode);
    if (!targetLanguage) {
      devWarn(`Language ${languageCode} not supported`);
      return;
    }

    setIsLoading(true);
    try {
      await i18n.changeLanguage(languageCode);
      setCurrentLanguage(targetLanguage);
      setFormatters(createFormatters(languageCode));

      // Update document language and direction (only on client)
      if (typeof document !== 'undefined') {
        document.documentElement.lang = languageCode;
        document.documentElement.dir = targetLanguage.direction;
      }

      // Store preference (only on client)
      if (typeof window !== 'undefined') {
        localStorage.setItem('preferred-language', languageCode);
      }
    } catch (error) {
      devError('Failed to change language:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Listen for i18n language changes
  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      const newLanguage = SUPPORTED_LANGUAGES.find((lang) => lang.code === lng);
      if (newLanguage && newLanguage.code !== currentLanguage.code) {
        setCurrentLanguage(newLanguage);
        setFormatters(createFormatters(lng));
        if (typeof document !== 'undefined') {
          document.documentElement.lang = lng;
          document.documentElement.dir = newLanguage.direction;
        }
      }
    };

    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n, currentLanguage.code]);

  // Context value
  const contextValue: LanguageContextType = {
    currentLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
    changeLanguage,
    isLoading,
    formatters,
  };

  return (
    <LanguageContext.Provider value={contextValue}>
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={currentLanguage.dateLocale}>
        {children}
      </LocalizationProvider>
    </LanguageContext.Provider>
  );
};

// Utility function to detect user's preferred language
export const detectUserLanguage = (): string => {
  // Check localStorage first
  const stored = typeof window !== 'undefined' ? localStorage.getItem('preferred-language') : null;
  if (stored && SUPPORTED_LANGUAGES.some((lang) => lang.code === stored)) {
    return stored;
  }

  // Check browser language
  const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
  const foundLang = SUPPORTED_LANGUAGES.find((lang) => lang.code === browserLang);
  if (foundLang) {
    return foundLang.code;
  }

  // Fallback to English
  return 'en';
};
