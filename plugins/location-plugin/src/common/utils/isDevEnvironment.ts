/**
 * Helper to detect dev-mode in environments where import.meta.env might be undefined
 * (e.g., during DTS generation).
 */
export const isDevEnvironment =
  typeof import.meta !== 'undefined' &&
  ((import.meta as { env?: { DEV?: boolean } }).env?.DEV ?? false);
