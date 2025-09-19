/**
 * columnWidthCache.test.ts - Verify TreeTable column width caching helpers.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  cacheColumnWidths,
  columnWidthsEqual,
  DEFAULT_COLUMN_WIDTHS,
  mergeWithDefaults,
  resolveInitialColumnWidths,
  __columnWidthCacheTesting,
} from '../utils/column-width-cache.js';

declare global {
  // Vitest runs in Node; declare localStorage for the tests.
  // eslint-disable-next-line no-var
  var localStorage: Storage;
}

class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

const storage = new MemoryStorage();

beforeEach(() => {
  storage.clear();
  __columnWidthCacheTesting.reset();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  });
});

describe('column-width-cache helpers', () => {
  it('returns a fresh copy of defaults when no cache is present', () => {
    const widths = resolveInitialColumnWidths('page-1');
    expect(widths).toEqual(DEFAULT_COLUMN_WIDTHS);
    expect(widths).not.toBe(DEFAULT_COLUMN_WIDTHS);
  });

  it('hydrates cached overrides synchronously', () => {
    cacheColumnWidths('page-2', { name: 480, description: 275 });
    __columnWidthCacheTesting.reset();
    const widths = resolveInitialColumnWidths('page-2');
    expect(widths.name).toBe(480);
    expect(widths.description).toBe(275);
  });

  it('ignores invalid overrides and falls back to defaults', () => {
    cacheColumnWidths('page-3', { name: 510, description: -10, bogus: 'x' });
    __columnWidthCacheTesting.reset();
    const widths = resolveInitialColumnWidths('page-3');
    expect(widths.description).toBe(DEFAULT_COLUMN_WIDTHS.description);
    expect('bogus' in widths).toBe(false);
  });

  it('detects width equality changes precisely', () => {
    const base = mergeWithDefaults(null);
    const clone = { ...base };
    const baseName = base.name ?? 0;
    const modified = { ...base, name: baseName + 5 };
    expect(columnWidthsEqual(base, clone)).toBe(true);
    expect(columnWidthsEqual(base, modified)).toBe(false);
  });
});
