// Minimal exports for ui-i18n package
// TODO: Re-enable when dependencies are resolved
// export { default as i18n } from './i18n/index.ts';
// export { LanguageProvider, useLanguage } from './i18n/LanguageProvider.js';

// Re-export commonly used i18next hooks so downstream packages share the configured instance
export { useTranslation, Trans, Translation, I18nextProvider } from 'react-i18next';

// Export i18n utilities
export * from './utils/i18nLogger.js';
export * from './i18n/index.js';
export * from './provider/LanguageProvider.js';
export * from './hooks/useGlobalI18nTranslator.js';
