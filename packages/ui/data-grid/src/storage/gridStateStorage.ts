export type GridStateValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

const canUseLocalStorage = (): boolean => {
  if (typeof window === 'undefined') return false;
  return typeof window.localStorage !== 'undefined';
};

export const buildGridStateKey = (baseKey: string, segment: string): string => (
  `${baseKey}:${segment}`
);

export const loadGridStateValue = <T extends GridStateValue>(key: string): T | undefined => {
  if (!canUseLocalStorage()) return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn('[ui-grid] Failed to load grid state:', error);
    return undefined;
  }
};

export const saveGridStateValue = (key: string, value: GridStateValue): void => {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('[ui-grid] Failed to persist grid state:', error);
  }
};
