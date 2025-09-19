// Minimal exports for ui-i18n package
// TODO: Re-enable when dependencies are resolved
// export { default as i18n } from './i18n/index.js';
// export { LanguageProvider, useLanguage } from './i18n/LanguageProvider.js';

// Re-export commonly used i18next hooks (when provider-i18next is available)
// export { useTranslation, Trans, Translation } from 'provider-i18next';

// Export i18n utilities
export * from './utils/i18nLogger.js';
export * from './i18n/index.js';
export * from './provider/LanguageProvider.js';
