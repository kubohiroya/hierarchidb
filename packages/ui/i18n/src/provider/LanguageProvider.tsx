/**
 * Language Provider Component
 *
 * This component provides language switching functionality and integrates
 * with the Material-UI theme system for locale-aware formatting.
 */

import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import type { i18n as I18nInstance } from 'i18next';
import { createContext, type ReactNode, useContext } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { i18n as configuredI18n } from '~/i18n/index';
import {
  defaultContextValue,
  detectUserLanguage,
  SUPPORTED_LANGUAGES,
  type LanguageConfig,
  type LanguageContextType,
  useLanguageProviderMountState,
  useLanguageProviderState,
} from './useLanguageProvider.js';

const sharedI18n = configuredI18n as I18nInstance;

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

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
  const isMounted = useLanguageProviderMountState();

  if (!isMounted) {
    return (
      <I18nextProvider i18n={sharedI18n}>
        <LanguageContext.Provider value={defaultContextValue}>
          <LocalizationProvider
            dateAdapter={AdapterDateFns}
            adapterLocale={defaultContextValue.currentLanguage.dateLocale}
          >
            {children}
          </LocalizationProvider>
        </LanguageContext.Provider>
      </I18nextProvider>
    );
  }

  return (
    <I18nextProvider i18n={sharedI18n}>
      <LanguageProviderInner>{children}</LanguageProviderInner>
    </I18nextProvider>
  );
};

const LanguageProviderInner: React.FC<LanguageProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const { contextValue, adapterLocale } = useLanguageProviderState(i18n);

  return (
    <LanguageContext.Provider value={contextValue}>
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={adapterLocale}>
        {children}
      </LocalizationProvider>
    </LanguageContext.Provider>
  );
};

export { detectUserLanguage, SUPPORTED_LANGUAGES };
export type { LanguageConfig, LanguageContextType };
