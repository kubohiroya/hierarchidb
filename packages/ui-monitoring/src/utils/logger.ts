/**
 * Simple logger utility for monitoring components
 */

const isDev = process.env.NODE_ENV === 'development';

export const devLog = (...args: any[]) => {
  if (isDev) {
    console.log('[Monitor]', ...args);
  }
};

export const devError = (...args: any[]) => {
  if (isDev) {
    console.error('[Monitor Error]', ...args);
  }
};

export const devWarn = (...args: any[]) => {
  if (isDev) {
    console.warn('[Monitor Warning]', ...args);
  }
};
