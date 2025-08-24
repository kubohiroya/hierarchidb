// Minimal exports for ui-i18n package
// TODO: Re-enable when dependencies are resolved
// export { default as i18n } from './i18n';
// export { LanguageProvider, useLanguage } from './i18n/LanguageProvider';

// Re-export commonly used i18next hooks (when react-i18next is available)
// export { useTranslation, Trans, Translation } from 'react-i18next';

// Export i18n utilities
export * from './utils/i18nLogger';
export * from './i18n';
export * from './provider/LanguageProvider';
