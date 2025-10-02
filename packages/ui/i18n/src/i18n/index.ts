/**
 * i18next Configuration
 *
 * This file contains the i18next configuration for the Eria Cartograph application.
 */

import i18n, { type InitOptions, type InterpolationOptions } from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';
import type { HttpBackendOptions } from 'i18next-http-backend';
import { getEnvString, isDevEnv } from '../utils/env.js';

interface AppWindow extends Window {
  __HDB_APP_BASE__?: unknown;
}

const logI18nWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[ui-i18n]', message, error);
};

const isDevelopment = isDevEnv();

// Language detection configuration
const detectionOptions = {
  // Order and from where user language should be detected
  order: ['localStorage', 'cookie', 'navigator'] as string[],

  // Keys or params to lookup language from
  lookupQuerystring: 'lng',
  lookupCookie: 'i18next',
  lookupLocalStorage: 'i18nextLng',
  lookupSessionStorage: 'i18nextLng',

  // Cache user language
  caches: ['localStorage'] as string[],
  excludeCacheFor: ['cimode'] as string[], // Languages to not persist
};

const backendOptions: HttpBackendOptions = {
  loadPath: (languages, namespaces) => {
    const base = computeBasePath();
    const lng = Array.isArray(languages) && languages.length ? languages[0] : 'en';
    const ns = Array.isArray(namespaces) && namespaces.length ? namespaces[0] : 'common';
    return `${base}locales/${lng}/${ns}.json`;
  },
  crossDomain: false,
  withCredentials: false,
  customHeaders: {},
  reloadInterval: isDevelopment ? 60_000 : undefined,
};

interface ReactI18nOptions {
  useSuspense?: boolean;
  bindI18n?: string;
  bindI18nStore?: string;
  transSupportBasicHtmlNodes?: boolean;
  transKeepBasicHtmlNodesFor?: string[];
  unescape?: (value: string) => string;
}

const reactOptions: ReactI18nOptions = {
  useSuspense: false,
  bindI18n: 'languageChanged',
  bindI18nStore: '',
  transSupportBasicHtmlNodes: true,
  transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'em'],
  unescape: (str) => {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(str, 'text/html');
      return doc.documentElement.textContent || str;
    }
    return str;
  },
};

const interpolationOptions: InterpolationOptions = {
  escapeValue: false,
};

const formatterEntries: Array<[string, (value: unknown, lng?: string) => string]> = [
  ['uppercase', (value) => (typeof value === 'string' ? value.toUpperCase() : String(value))],
  ['lowercase', (value) => (typeof value === 'string' ? value.toLowerCase() : String(value))],
  [
    'date',
    (value, lng) => {
      const dateValue = value instanceof Date ? value : new Date(String(value));
      return new Intl.DateTimeFormat(lng).format(dateValue);
    },
  ],
  [
    'number',
    (value, lng) =>
      typeof value === 'number' ? new Intl.NumberFormat(lng).format(value) : String(value),
  ],
  [
    'currency',
    (value, lng) =>
      typeof value === 'number'
        ? new Intl.NumberFormat(lng, {
          style: 'currency',
          currency: 'USD',
        }).format(value)
        : String(value),
  ],
];

const baseInitOptions: InitOptions = {
  fallbackLng: 'en',
  supportedLngs: ['en', 'ja'],
  load: 'languageOnly',
  defaultNS: 'common',
  ns: ['guidedTour', 'common'],
  debug: false,
  interpolation: interpolationOptions,
  react: reactOptions,
  parseMissingKeyHandler: (key: string, defaultValue?: string) => {
    if (isDevelopment) {
      console.warn(`[ui-i18n] Missing translation key: ${key}`);
    }
    return defaultValue ?? key;
  },
  saveMissing: false,
  saveMissingTo: 'fallback',
  cleanCode: true,
  postProcess: false,
  initImmediate: false,
};

interface FormatterService {
  add: (name: string, callback: (value: unknown, lng?: string) => string) => void;
}

const getFormatterService = (): FormatterService | undefined => {
  const services = (i18n as unknown as { services?: { formatter?: FormatterService } }).services;
  return services?.formatter;
};

const registerFormatters = (): void => {
  const formatter = getFormatterService();
  if (!formatter) return;
  formatterEntries.forEach(([name, fn]) => {
    formatter.add(name, fn);
  });
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
      const hinted = (window as AppWindow).__HDB_APP_BASE__;
      if (typeof hinted === 'string') return toAbs(hinted);
    }
  } catch (error) {
    logI18nWarning('Failed to read __HDB_APP_BASE__ hint', error);
  }
  try {
    const envBase = getEnvString('BASE_URL') ?? '';
    if (envBase) return toAbs(envBase);
  } catch (error) {
    logI18nWarning('Failed to read import.meta.env.BASE_URL', error);
  }

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
        } catch (error) {
          logI18nWarning('Failed to derive base from script src', error);
        }
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
      } catch (error) {
        logI18nWarning('Failed to derive base path from window.location', error);
      }
    }
  } catch (error) {
    logI18nWarning('Failed to compute base path from document context', error);
  }

  return toAbs('/');
}

// Initialize i18n only on client side
const initializeI18n = () => {
  if (typeof window === 'undefined') return;

  const browserInitOptions: InitOptions = {
    ...baseInitOptions,
    detection: detectionOptions,
    backend: backendOptions,
  };

  i18n
    // Load translation using http -> see /public/locales
    .use(HttpBackend)
    // Detect user language
    .use(LanguageDetector)
    // Pass the i18n instance to provider-i18next
    .use(initReactI18next)
    // Initialize i18next
    .init(browserInitOptions)
    .then(registerFormatters)
    .catch((error) => {
      logI18nWarning('Failed to initialize i18n', error);
    });
};

// Initialize i18n on client side
if (typeof window !== 'undefined') {
  initializeI18n();
} else {
  const ssrInitOptions: InitOptions = {
    ...baseInitOptions,
  };
  i18n
    .use(initReactI18next)
    .init(ssrInitOptions)
    .then(registerFormatters)
    .catch((error) => {
      logI18nWarning('Failed to initialize i18n (SSR)', error);
    });
}

export { i18n };
