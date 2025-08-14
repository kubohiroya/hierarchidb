/**
 * Simple logger utility for file components
 */

const isDev = process.env.NODE_ENV === 'development';

export const devLog = (...args: any[]) => {
  if (isDev) {
    console.log('[File]', ...args);
  }
};

export const devError = (...args: any[]) => {
  if (isDev) {
    console.error('[File Error]', ...args);
  }
};

export const devWarn = (...args: any[]) => {
  if (isDev) {
    console.warn('[File Warning]', ...args);
  }
};
