/**
 * shape-plugin Test Setup
 * Uses base vitest setup configuration
 */

// Import base setup (includes _obsolate_common mocks and utilities)
import '../../vitest.setup.base';
import { setCorsProxyBaseURL } from '@hierarchidb/download';
import { initializeEphemeralDB } from '@hierarchidb/gis-sdk';
import { initializeShapeDB } from '@hierarchidb/shape-store';
import { getDBName } from '@hierarchidb/util';

initializeEphemeralDB(getDBName('test', 'ephemeral'));
initializeShapeDB(getDBName('test', 'shape'));

// Default: run network integration tests directly in Node (no CORS proxy).
setCorsProxyBaseURL('');
// Package-specific setup can be added here if needed


const ensureLocalStorage = () => {
  const target = (globalThis as { window?: typeof globalThis }).window ?? globalThis;
  const storage = (target as { localStorage?: Storage }).localStorage;
  if (storage && typeof storage.clear === 'function') return;
  const store = new Map<string, string>();
  const localStorageShim: Storage = {
    getItem: (key: string) => (store.has(key) ? store.get(key) ?? null : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(target, 'localStorage', {
    value: localStorageShim,
    configurable: true,
    writable: true,
  });
};

ensureLocalStorage();
