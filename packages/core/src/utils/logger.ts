/**
 * @file logger.ts
 * @description Development logging utilities that preserve source location
 *
 * This utility solves the common problem where wrapped console.log functions
 * show the wrapper location instead of the actual call site in the browser console.
 *
 * Using console.log.bind(console) preserves the original file and line numbers
 * while still allowing conditional logging based on environment.
 */

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

// Basic logging functions that preserve source location
export const devLog = isDev ? console.log.bind(console) : noop;
export const devWarn = isDev ? console.warn.bind(console) : noop;
export const devError = isDev ? (...args: unknown[]) => console.error(...args) : noop;
export const devInfo = isDev ? console.info.bind(console) : noop;
export const devDebug = isDev ? console.debug.bind(console) : noop;

// Table logging for structured data
export const devTable = isDev ? console.table.bind(console) : noop;

// Group logging for organized output
export const devGroup = isDev ? console.group.bind(console) : noop;
export const devGroupCollapsed = isDev ? console.groupCollapsed.bind(console) : noop;
export const devGroupEnd = isDev ? console.groupEnd.bind(console) : noopVoid;

// Timing utilities
export const devTime = isDev ? console.time.bind(console) : noop;
export const devTimeEnd = isDev ? console.timeEnd.bind(console) : noop;
export const devTimeLog = isDev ? console.timeLog.bind(console) : noop;

// Conditional logging utilities
export const devLogIf = (condition: boolean, ...args: unknown[]) => {
  if (isDev && condition) devLog(...args);
};

export const devWarnIf = (condition: boolean, ...args: unknown[]) => {
  if (isDev && condition) devWarn(...args);
};

export const devErrorIf = (condition: boolean, ...args: unknown[]) => {
  if (isDev && condition) devError(...args);
};

// Object inspection with custom formatting
export const devInspect = (obj: unknown, label?: string) => {
  if (!isDev) return;
  if (label) {
    devLog(`🔍 ${label}:`, obj);
  } else {
    devLog('🔍 Object:', obj);
  }
};

// Performance logging
export const devPerf = (label: string, fn: () => void) => {
  if (!isDev) {
    fn();
    return;
  }
  devTime(label);
  fn();
  devTimeEnd(label);
};

// Async performance logging
export const devPerfAsync = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  if (!isDev) {
    return await fn();
  }
  devTime(label);
  const result = await fn();
  devTimeEnd(label);
  return result;
};

// Component lifecycle logging (for React components)
export const devLifecycle = (componentName: string, phase: string, data?: unknown) => {
  if (!isDev) return;
  const emoji =
    {
      mount: '🔄',
      unmount: '🗑️',
      update: '📝',
      render: '🎨',
      effect: '⚡',
    }[phase] || '📍';

  devLog(`${emoji} ${componentName}:${phase}`, data ? data : '');
};

// Type-safe assertion logging
export const devAssert = (condition: boolean, message: string, ...args: unknown[]) => {
  if (!isDev) return;
  if (!condition) {
    devError('❌ Assertion failed:', message, ...args);
  }
};

// Feature flag logging
export const devFeature = (featureName: string, enabled: boolean, ...args: unknown[]) => {
  if (!isDev) return;
  const status = enabled ? '✅' : '❌';
  devLog(`${status} Feature ${featureName}:`, enabled ? 'ENABLED' : 'DISABLED', ...args);
};

// API call logging
export const devAPI = {
  request: (url: string, options?: unknown) => {
    if (!isDev) return;
    devLog('🌐 API Request:', url, options);
  },
  response: (url: string, status: number, data?: unknown) => {
    if (!isDev) return;
    const emoji = status >= 200 && status < 300 ? '✅' : '❌';
    devLog(`${emoji} API Response [${status}]:`, url, data);
  },
  error: (url: string, error: unknown) => {
    if (!isDev) return;
    devError('💥 API Error:', url, error);
  },
};

// Migration helper - marks old logging patterns for replacement
export const deprecatedLog = (...args: unknown[]) => {
  if (!isDev) return;
  devWarn('⚠️ DEPRECATED: Use devLog instead of wrapped console.log', ...args);
};