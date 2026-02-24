/**
 * i18next Configuration
 *
 * This file contains the i18next configuration for the Eria Cartograph application.
 */

import i18next, {
  type i18n as I18nInstance,
  type InitOptions,
  type InterpolationOptions,
  type ThirdPartyModule,
} from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import type { HttpBackendOptions } from 'i18next-http-backend';
import HttpBackend from 'i18next-http-backend';
import * as ReactI18NextModule from 'react-i18next';
import { getEnvString, isDevEnv } from '~/utils/env';

interface AppWindow extends Window {
  __HDB_APP_BASE__?: unknown;
}

const logI18nWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[ui-i18n]', message, error);
};

const initReactI18nextModule = (ReactI18NextModule as { initReactI18next?: ThirdPartyModule })
  .initReactI18next;

const i18n: I18nInstance =
  (i18next as { default?: I18nInstance }).default ??
  (i18next as I18nInstance);

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
  ns: ['common', 'guidedTour'],
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
  const services = (i18n as { services?: { formatter?: FormatterService } }).services;
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
    const withSlash = v.endsWith('/') ? v : `${v}/`;
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

      // In development, avoid deriving base path from current route
      // because auth and other top-level routes can be mistaken as app base.
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

  const instance = i18n
    // Load translation using http -> see /public/locales
    .use(HttpBackend)
    // Detect user language
    .use(LanguageDetector);

  if (initReactI18nextModule) {
    try {
      instance.use(initReactI18nextModule);
    } catch (error) {
      logI18nWarning('Failed to attach initReactI18next', error);
    }
  } else {
    logI18nWarning('initReactI18next is unavailable; skipping React binding', 'mocked');
  }

  instance
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
  try {
    (window as typeof window & { i18next?: typeof i18n }).i18next = i18n;
  } catch (error) {
    logI18nWarning('Failed to expose i18next on window', error);
  }
} else {
  const ssrInitOptions: InitOptions = {
    ...baseInitOptions,
  };
  const instance = i18n;
  if (initReactI18nextModule) {
    try {
      instance.use(initReactI18nextModule);
    } catch (error) {
      logI18nWarning('Failed to attach initReactI18next (SSR)', error);
    }
  }

  instance
    .init(ssrInitOptions)
    .then(registerFormatters)
    .catch((error) => {
      logI18nWarning('Failed to initialize i18n (SSR)', error);
    });
}

try {
  (globalThis as typeof globalThis & { i18next?: typeof i18n }).i18next = i18n;
} catch (error) {
  logI18nWarning('Failed to expose i18next on globalThis', error);
}

export { i18n };
