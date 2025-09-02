/**
 * Base Vitest Setup (ESM)
 * Common mocks and utilities shared across packages.
 */

import 'fake-indexeddb/auto';
import { vi, beforeEach } from 'vitest';
// ========================
// Comlink Mock Setup
// ========================
const comlinkMock = {
    wrap: function (target) {
        // Return API directly without proxy in test environment
        return target;
    },
    expose: function (api) {
        // No-op in Node environment
        return api;
    },
    transfer: function (obj, _transfers) { return obj; },
    transferHandlers: new Map(),
    proxy: function (obj) { return obj; },
    windowEndpoint: function (window) { return window; },
    createEndpoint: function () { return ({}); },
    releaseProxy: function () { },
};
vi.mock('comlink', () => comlinkMock);
// ========================
// Worker Environment Setup
// ========================
// Set up Worker environment globals
if (typeof globalThis.self === 'undefined') {
    globalThis.self = globalThis;
}
// Mock Web Worker class
class WorkerMock {
  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.listeners = new Map();
  }
  postMessage(message, _transfer) {
    setTimeout(() => {
      const handlers = this.listeners.get('message') || [];
      handlers.forEach((handler) => handler({ data: message }));
    }, 0);
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    const handlers = this.listeners.get(type) || [];
    const index = handlers.indexOf(listener);
    if (index > -1) handlers.splice(index, 1);
  }
  terminate() { this.listeners.clear(); }
}
// Set Worker globally if not available
if (typeof Worker === 'undefined') {
    globalThis.Worker = WorkerMock;
}
// ========================
// Browser API Polyfills
// ========================
// structuredClone polyfill (for Node < v17)
if (!globalThis.structuredClone) {
    globalThis.structuredClone = function (obj) {
        return JSON.parse(JSON.stringify(obj));
    };
}
// crypto.subtle mock for tests that need crypto APIs
if (!globalThis.crypto) {
  globalThis.crypto = {
    subtle: {
      digest: vi.fn(),
      encrypt: vi.fn(),
      decrypt: vi.fn(),
    },
    getRandomValues: vi.fn((arr) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    }),
  };
}
// CompressionStream mock for compression tests
if (!globalThis.CompressionStream) {
  globalThis.CompressionStream = class CompressionStream {
    constructor(format) {
      this.format = format;
      this.writable = { getWriter: () => ({ write: vi.fn(), close: vi.fn() }) };
      this.readable = { getReader: () => ({ read: vi.fn() }) };
    }
  };
}
// ========================
// Test Cleanup Utilities
// ========================
/**
 * Clear all IndexedDB databases
 * Use this in tests that need clean database state
 */
export async function clearAllDatabases() {
  const list = (await indexedDB.databases?.()) || [];
  for (const db of list) {
    if (!db.name) continue;
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(db.name);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => setTimeout(() => resolve(), 100);
    });
  }
}
/**
 * Basic setup that runs before each test
 * Can be extended by individual packages
 */
export function setupBasicTestEnvironment() {
  beforeEach(async () => {
    await clearAllDatabases();
    vi.clearAllMocks();
  });
}
// ========================
// Console Mock Setup
// ========================
// Mock console methods that might interfere with test output
global.console.error = vi.fn();
global.console.warn = vi.fn();
// ========================
// Default Setup
// ========================
// Run basic setup by default
setupBasicTestEnvironment();
