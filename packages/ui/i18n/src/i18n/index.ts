/**
 * i18next Configuration
 *
 * This file contains the i18next configuration for the Eria Cartograph application.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';


const isDevelopment = ((import.meta as any)?.env?.MODE as string) === 'development';

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

// Compute absolute base path under which the app is served (e.g. "/hierarchidb/")
// SSOT: app provides window.__HDB_APP_BASE__ (= import.meta.env.BASE_URL)
function computeBasePath(): string {
  const toAbs = (v: string) => {
    if (!v) return '/';
    // Ensure trailing slash
    const withSlash = v.endsWith('/') ? v : v + '/';
    if (/^https?:\/\//i.test(withSlash)) return withSlash;
    if (typeof window !== 'undefined') {
      if (withSlash.startsWith('/')) return `${window.location.origin}${withSlash}`;
      return `${window.location.origin}/${withSlash}`;
    }
    return withSlash;
  };

  // 1) Prefer explicit global hint set by the app to avoid bundler differences in import.meta.env handling
  try {
    if (typeof window !== 'undefined') {
      const hinted = (window as any)?.__HDB_APP_BASE__ as string | undefined;
      if (typeof hinted === 'string') return toAbs(hinted as string);
    }
  } catch {}
  try {
    // SSOT: Vite BASE_URL from the consuming app
    const envBase = ((import.meta as any)?.env?.BASE_URL as string) || '';
    if (envBase) return toAbs(envBase);
  } catch {}

  // Last resort: <base href> if present
  try {
    if (typeof document !== 'undefined') {
      const baseEl = document.querySelector('base');
      const href = baseEl?.getAttribute('href');
      if (href) {
        const u = new URL(href, window.location.origin);
        const p = u.pathname || '/';
        return toAbs(p);
      }
      // If no <base>, derive from current script src (works on GitHub Pages)
      // Example: https://user.github.io/repo-name/assets/entry.client.js -> /repo-name/
      const scripts = document.getElementsByTagName('script');
      const last = scripts[scripts.length - 1] as HTMLScriptElement | undefined;
      const src = last?.src || '';
      if (src) {
        try {
          const u = new URL(src, window.location.origin);
          const path = u.pathname;
          const i = path.lastIndexOf('/assets/');
          if (i > 0) {
            const prefix = path.slice(0, i + 1); // keep trailing '/'
            return toAbs(prefix);
          }
        } catch {}
      }

      // Dev fallback: detect first path segment as base (e.g., /hierarchidb/...) when Vite serves under a subpath
      try {
        const pathname = window.location.pathname || '/';
        const parts = pathname.split('/').filter(Boolean);
        if (parts.length > 0) {
          const seg = parts[0] ?? '';
          // Ignore technical segments that should not be treated as base
          if (!['node_modules', 'assets', 'locales'].includes(String(seg))) {
            return toAbs(`/${seg}/`);
          }
        }
      } catch {}
    }
  } catch {}

  return toAbs('/');
}

// Backend configuration for loading translation files (absolute path under app base)
const backendOptions = {
  loadPath: (languages: string[], namespaces: string[]) => {
    const base = computeBasePath();
    const lng = Array.isArray(languages) && languages.length ? languages[0] : 'en';
    const ns = Array.isArray(namespaces) && namespaces.length ? namespaces[0] : 'common';
    return `${base}locales/${lng}/${ns}.json`;
  },
  crossDomain: false,
  withCredentials: false,
  customHeaders: {},
  reloadInterval: isDevelopment ? 60000 : false, // 1 minute in dev mode
} as any;

// Initialize i18n only on client side
const initializeI18n = () => {
  if (typeof window === 'undefined') return;

  i18n
    // Load translation using http -> see /public/locales
    .use(HttpBackend)
    // Detect user language
    .use(LanguageDetector)
    // Pass the i18n instance to provider-i18next
    .use(initReactI18next)
    // Initialize i18next
    .init({
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
      //  i18next v25 formatters
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
      } as any,

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
          if ((import.meta as any)?.env?.DEV) {

            console.warn(`Missing translation key: ${key}`);

          }
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

      // Additional options for provider-i18next
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
  //  SSRwindow
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
    } as any,
    react: {
      useSuspense: false,
    },
  });
}

export default i18n;
