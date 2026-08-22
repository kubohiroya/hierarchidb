// Minimal exports for ui-i18n package
// TODO: Re-enable when dependencies are resolved
// export { default as i18n } from './i18n/index.ts';
// export { LanguageProvider, useLanguage } from './i18n/LanguageProvider.js';

export type { i18n as I18nInstance, TFunction, TOptions } from 'i18next';
// Re-export commonly used i18next hooks so downstream packages share the configured instance
export { I18nextProvider, Trans, Translation, useTranslation } from 'react-i18next';
export * from './hooks/useGlobalI18nTranslator.js';

import { i18n as i18nInstance } from './i18n/index.js';

export const i18n = i18nInstance;
export * from './i18n/index.js';
export * from './provider/LanguageProvider.js';
// Export i18n utilities
export * from './utils/i18nLogger.js';
