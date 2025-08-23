/**
 * @file i18nLogger.ts
 * @description Internationalized logging utilities that work with i18next
 *
 * This utility extends the existing logger to support internationalized messages
 * for both console output and development feedback.
 */

// import i18n from '../i18n/index';

/**
 * Type for i18next interpolation options
 */
export interface I18nInterpolationOptions {
  [key: string]: string | number | boolean | Date | undefined;
}

// Safe environment check that works in both browser and Node.js contexts
let isDev: boolean;
try {
  const env = typeof process !== 'undefined' ? process.env.NODE_ENV : undefined;
  isDev =
    env === 'development' ||
    env === 'test' ||
    (typeof globalThis !== 'undefined' &&
      (globalThis as { import?: { meta?: { env?: { DEV?: boolean } } } })?.import?.meta?.env
        ?.DEV) ||
    false;
} catch {
  isDev = false;
}

// No-op function for production builds
const noop = (..._args: unknown[]): void => void 0;
const noopVoid = (): void => void 0;

// Translation helper with fallback (simplified without i18n dependency)
const t = (key: string, _options?: I18nInterpolationOptions): string => {
  // Simple fallback implementation - just return the key for now
  return key;
};

// Console logging with i18n support
export const i18nLog = isDev
  ? (key: string, options?: I18nInterpolationOptions, ...args: unknown[]) => {
      console.log(t(key, options), ...args);
    }
  : noop;

export const i18nWarn = isDev
  ? (key: string, options?: I18nInterpolationOptions, ...args: unknown[]) => {
      console.warn(t(key, options), ...args);
    }
  : noop;

export const i18nError = isDev
  ? (key: string, options?: I18nInterpolationOptions, ...args: unknown[]) => {
      console.error(t(key, options), ...args);
    }
  : noop;

export const i18nInfo = isDev
  ? (key: string, options?: I18nInterpolationOptions, ...args: unknown[]) => {
      console.info(t(key, options), ...args);
    }
  : noop;

export const i18nDebug = isDev
  ? (key: string, options?: I18nInterpolationOptions, ...args: unknown[]) => {
      console.debug(t(key, options), ...args);
    }
  : noop;

// Group logging for organized output
export const i18nGroup = isDev
  ? (key: string, options?: I18nInterpolationOptions) => {
      console.group(t(key, options));
    }
  : noop;

export const i18nGroupCollapsed = isDev
  ? (key: string, options?: I18nInterpolationOptions) => {
      console.groupCollapsed(t(key, options));
    }
  : noop;

export const i18nGroupEnd = isDev ? console.groupEnd.bind(console) : noopVoid;

// Timing utilities with i18n
export const i18nTime = isDev
  ? (key: string, options?: I18nInterpolationOptions) => {
      console.time(t(key, options));
    }
  : noop;

export const i18nTimeEnd = isDev
  ? (key: string, options?: I18nInterpolationOptions) => {
      console.timeEnd(t(key, options));
    }
  : noop;

// Performance logging with i18n
export const i18nPerf = (labelKey: string, fn: () => void, options?: I18nInterpolationOptions) => {
  if (!isDev) {
    fn();
    return;
  }
  const label = t(labelKey, options);
  console.time(label);
  fn();
  console.timeEnd(label);
};

// Async performance logging with i18n
export const i18nPerfAsync = async <T>(
  labelKey: string,
  fn: () => Promise<T>,
  options?: I18nInterpolationOptions
): Promise<T> => {
  if (!isDev) {
    return await fn();
  }
  const label = t(labelKey, options);
  console.time(label);
  const result = await fn();
  console.timeEnd(label);
  return result;
};

// Component lifecycle logging with i18n
export const i18nLifecycle = (componentName: string, phaseKey: string, data?: unknown) => {
  if (!isDev) return;
  const emoji =
    {
      mount: '🔄',
      unmount: '🗑️',
      update: '📝',
      render: '🎨',
      effect: '⚡',
    }[phaseKey] || '📍';

  const phase = t(`lifecycle.${phaseKey}`, { defaultValue: phaseKey });
  console.log(`${emoji} ${componentName}:${phase}`, data ? data : '');
};

// Type-safe assertion logging with i18n
export const i18nAssert = (
  condition: boolean,
  messageKey: string,
  options?: I18nInterpolationOptions,
  ...args: unknown[]
) => {
  if (!isDev) return;
  if (!condition) {
    console.error('❌ ' + t('errors.assertionFailed') + ':', t(messageKey, options), ...args);
  }
};

// Feature flag logging with i18n
export const i18nFeature = (featureName: string, enabled: boolean, ...args: unknown[]) => {
  if (!isDev) return;
  const status = enabled ? '✅' : '❌';
  const statusText = enabled ? t('common.enabled') : t('common.disabled');
  console.log(`${status} ${t('common.feature')} ${featureName}:`, statusText, ...args);
};

// API call logging with i18n
export const i18nAPI = {
  request: (url: string, options?: unknown) => {
    if (!isDev) return;
    console.log('🌐 ' + t('api.request') + ':', url, options);
  },
  response: (url: string, status: number, data?: unknown) => {
    if (!isDev) return;
    const emoji = status >= 200 && status < 300 ? '✅' : '❌';
    console.log(`${emoji} ${t('api.response')} [${status}]:`, url, data);
  },
  error: (url: string, error: unknown) => {
    if (!isDev) return;
    console.error('💥 ' + t('api.error') + ':', url, error);
  },
};

// Conditional logging with i18n
export const i18nLogIf = (condition: boolean, key: string, options?: I18nInterpolationOptions, ...args: unknown[]) => {
  if (isDev && condition) i18nLog(key, options, ...args);
};

export const i18nWarnIf = (condition: boolean, key: string, options?: I18nInterpolationOptions, ...args: unknown[]) => {
  if (isDev && condition) i18nWarn(key, options, ...args);
};

export const i18nErrorIf = (condition: boolean, key: string, options?: I18nInterpolationOptions, ...args: unknown[]) => {
  if (isDev && condition) i18nError(key, options, ...args);
};
