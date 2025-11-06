import type { i18n as I18nInstance } from 'i18next';

const DEFAULT_MESSAGES = {
  start: 'Starting worker initialization…',
  complete: 'Worker initialization complete',
  fallback: 'Worker initializing',
} as const;

type GlobalWithI18n = typeof globalThis & { i18next?: I18nInstance };

const resolveI18nInstance = (): I18nInstance | null => {
  try {
    const globalCandidate = (globalThis as GlobalWithI18n).i18next;
    if (globalCandidate && typeof globalCandidate.t === 'function') {
      return globalCandidate;
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof window !== 'undefined') {
      const win = window as unknown as GlobalWithI18n;
      if (win.i18next && typeof win.i18next.t === 'function') {
        return win.i18next;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
};

const translateOrFallback = (key: string, defaultValue: string): string => {
  try {
    const instance = resolveI18nInstance();
    const translated = instance?.t?.(key, { defaultValue }) ?? undefined;
    if (typeof translated === 'string' && translated.trim().length > 0 && translated !== key) {
      return translated;
    }
  } catch {
    // Swallow translation errors and fall back to the provided default.
  }
  return defaultValue;
};

export const getWorkerInitStartMessage = (): string =>
  translateOrFallback('workerInit.messages.start', DEFAULT_MESSAGES.start);

export const getWorkerInitCompleteMessage = (): string =>
  translateOrFallback('workerInit.messages.complete', DEFAULT_MESSAGES.complete);

export const getWorkerInitFallbackMessage = (): string =>
  translateOrFallback('workerInit.progressFallback', DEFAULT_MESSAGES.fallback);
