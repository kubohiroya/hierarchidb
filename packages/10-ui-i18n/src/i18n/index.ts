/**
 * i18next Configuration
 *
 * This file contains the i18next configuration for the Eria Cartograph application.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';
const devWarn = (msg: string) => console.warn(msg);

const isDevelopment = import.meta.env.MODE === 'development';
const APP_PREFIX = import.meta.env.VITE_APP_PREFIX || '';
const prefix = APP_PREFIX.startsWith('/') ? APP_PREFIX : `/${APP_PREFIX}`;

// Language detection configuration
const detectionOptions = {
  // Order and from where user language should be detected
  order: ['localStorage', 'cookie', 'navigator'],

  // Keys or params to lookup language from
  lookupQuerystring: 'lng',
  lookupCookie: 'i18next',
  lookupLocalStorage: 'i18nextLng',
  lookupSessionStorage: 'i18nextLng',

  // Cache user language
  caches: ['localStorage'],
  excludeCacheFor: ['cimode'], // Languages to not persist

  // Only detect languages that are in the whitelist
  checkAllowlist: true,
};

// Backend configuration for loading translation files
const backendOptions = {
  loadPath: `${prefix}/locales/{{lng}}/{{ns}}.json`,
  // Allow cross domain requests
  crossDomain: false,
  // Allow credentials on cross domain requests
  withCredentials: false,
  // Define which headers will be set
  customHeaders: {},
  // Can be used to reload resources in a specific interval (useful in dev mode)
  reloadInterval: isDevelopment ? 60000 : false, // 1 minute in dev mode
};

// Initialize i18n only on client side
const initializeI18n = () => {
  if (typeof window === 'undefined') return;

  i18n
    // Load translation using http -> see /public/locales
    .use(HttpBackend)
    // Detect user language
    .use(LanguageDetector)
    // Pass the i18n instance to react-i18next
    .use(initReactI18next)
    // Initialize i18next
    .init<{
      loadPath: string;
      crossDomain: boolean;
      withCredentials: boolean;
      customHeaders: Record<string, string>;
      reloadInterval: number | boolean;
    }>({
      // Fallback language
      fallbackLng: 'en',

      // Allowed languages
      supportedLngs: ['en', 'ja'],

      // Enable to check if language is in supported languages
      load: 'languageOnly', // Remove region code (e.g., en-US -> en)

      // Default namespace
      defaultNS: 'common',

      // Namespaces to load on init
      ns: ['guidedTour', 'common'],

      // Disable debug mode to reduce console noise
      debug: false,

      // Interpolation options
      interpolation: {
        escapeValue: false,
        formatters: {
          uppercase: (value: unknown) => (typeof value === 'string' ? value.toUpperCase() : value),
          lowercase: (value: unknown) => (typeof value === 'string' ? value.toLowerCase() : value),
          date: (value: unknown, lng?: string) => {
            const dateValue = value instanceof Date ? value : new Date(String(value));
            return new Intl.DateTimeFormat(lng).format(dateValue);
          },
          number: (value: unknown, lng?: string) =>
            typeof value === 'number' ? new Intl.NumberFormat(lng).format(value) : value,
          currency: (value: unknown, lng?: string) =>
            typeof value === 'number'
              ? new Intl.NumberFormat(lng, {
                  style: 'currency',
                  currency: 'USD',
                }).format(value)
              : value,
        },
      },

      // React options
      react: {
        // Wait for translation to be loaded before rendering
        useSuspense: false,
        // Bind the t function to a specific component
        bindI18n: 'languageChanged',
        // Bind the t function to the i18next store events
        bindI18nStore: '',
        // Set to false if you prefer to manage loading states manually
        transSupportBasicHtmlNodes: true,
        transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'em'],
        // Unescape HTML entities
        unescape: (str: string) => {
          if (typeof DOMParser !== 'undefined') {
            const doc = new DOMParser().parseFromString(str, 'text/html');
            return doc.documentElement.textContent || str;
          }
          return str;
        },
      },

      // Parser options
      parseMissingKeyHandler: (key: string, defaultValue?: string) => {
        if (isDevelopment) {
          devWarn(`Missing translation key: ${key}`);
        }
        return defaultValue || key;
      },

      // Save missing translations - disabled to prevent 404 errors
      saveMissing: false,
      saveMissingTo: 'fallback',

      // Cleanup options
      cleanCode: true,

      // Post processor options
      postProcess: false,

      // Additional options for react-i18next
      initImmediate: false,

      // Language detection configuration (for LanguageDetector plugin)
      detection: detectionOptions,

      // Backend configuration (for HttpBackend plugin)
      backend: backendOptions,
    });
};

// Initialize i18n on client side
if (typeof window !== 'undefined') {
  initializeI18n();
} else {
  // SSRではwindow依存のプラグインを使わず、最低限の設定のみ
  i18n.use(initReactI18next).init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'ja'],
    defaultNS: 'common',
    ns: ['guidedTour', 'common'],
    interpolation: {
      escapeValue: false,
      formatters: {
        uppercase: (value: unknown) => (typeof value === 'string' ? value.toUpperCase() : value),
        lowercase: (value: unknown) => (typeof value === 'string' ? value.toLowerCase() : value),
        date: (value: unknown, lng?: string) => {
          const dateValue = value instanceof Date ? value : new Date(String(value));
          return new Intl.DateTimeFormat(lng).format(dateValue);
        },
        number: (value: unknown, lng?: string) =>
          typeof value === 'number' ? new Intl.NumberFormat(lng).format(value) : value,
        currency: (value: unknown, lng?: string) =>
          typeof value === 'number'
            ? new Intl.NumberFormat(lng, {
                style: 'currency',
                currency: 'USD',
              }).format(value)
            : value,
      },
    },
    react: {
      useSuspense: false,
    },
  });
}

export default i18n;
