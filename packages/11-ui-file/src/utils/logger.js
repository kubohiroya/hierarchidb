/**
 * Simple logger utility for file containers
 */
const isDev = process.env.NODE_ENV === 'development';
export const devLog = (...args) => {
  if (isDev) {
    console.log('[File]', ...args);
  }
};
export const devError = (...args) => {
  if (isDev) {
    console.error('[File Error]', ...args);
  }
};
export const devWarn = (...args) => {
  if (isDev) {
    console.warn('[File Warning]', ...args);
  }
};
//# sourceMappingURL=logger.js.map
