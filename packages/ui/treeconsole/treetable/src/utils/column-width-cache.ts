/**
 * column-width-cache.ts - Centralize TreeTable column width caching to avoid first paint flicker.
 */

export type ColumnWidthMap = Record<string, number>;

export const DEFAULT_COLUMN_WIDTHS: ColumnWidthMap = Object.freeze({
  selection: 49,
  name: 350,
  description: 400,
  createdAt: 150,
  updatedAt: 150,
  removedAt: 150,
});

const memoryCache = new Map<string, ColumnWidthMap>();
const STORAGE_PREFIX = 'hdb:treetable:column-widths:';

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window?.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined') {
    try {
      const candidate = (globalThis as { localStorage?: Storage }).localStorage;
      return candidate ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

function cacheKey(pageNodeId: string): string {
  return `${STORAGE_PREFIX}${pageNodeId}`;
}

function sanitizeColumnWidths(input: unknown): ColumnWidthMap | null {
  if (!input || typeof input !== 'object') return null;
  const next: ColumnWidthMap = {};
  let hasValue = false;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      next[key] = Math.round(value);
      hasValue = true;
    }
  }
  return hasValue ? next : null;
}

function safeRemoveItem(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Silently ignore storage removal errors (e.g. quota/sandbox restrictions)
  }
}

export function mergeWithDefaults(overrides: Record<string, unknown> | null | undefined): ColumnWidthMap {
  const sanitized = sanitizeColumnWidths(overrides);
  return sanitized ? { ...DEFAULT_COLUMN_WIDTHS, ...sanitized } : { ...DEFAULT_COLUMN_WIDTHS };
}

export function columnWidthsEqual(a: ColumnWidthMap, b: ColumnWidthMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function loadCachedColumnWidths(pageNodeId: string | undefined): ColumnWidthMap | null {
  if (!pageNodeId) return null;
  const memoized = memoryCache.get(pageNodeId);
  if (memoized) return { ...memoized };
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(cacheKey(pageNodeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const sanitized = sanitizeColumnWidths(parsed);
    if (!sanitized) {
      safeRemoveItem(storage, cacheKey(pageNodeId));
      return null;
    }
    memoryCache.set(pageNodeId, sanitized);
    return { ...sanitized };
  } catch {
    safeRemoveItem(storage, cacheKey(pageNodeId));
    return null;
  }
}

export function cacheColumnWidths(pageNodeId: string | undefined, widths: Record<string, unknown>): void {
  if (!pageNodeId) return;
  const sanitized = sanitizeColumnWidths(widths);
  if (!sanitized) return;
  memoryCache.set(pageNodeId, sanitized);
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(cacheKey(pageNodeId), JSON.stringify(sanitized));
  } catch {
    // Ignore quota or storage errors.
  }
}

export function resolveInitialColumnWidths(pageNodeId: string | undefined): ColumnWidthMap {
  const cached = loadCachedColumnWidths(pageNodeId);
  return mergeWithDefaults(cached ?? null);
}

export const __columnWidthCacheTesting = {
  reset(): void {
    memoryCache.clear();
  },
  storageKey(pageNodeId: string): string {
    return cacheKey(pageNodeId);
  },
};
