i/**
 * Base Vitest Setup Configuration
 * 
 * Common test environment setup for all packages.
 * Provides Web Worker, IndexedDB, and other browser API mocks for Node.js environment.
 */

import 'fake-indexeddb/auto';
import { beforeEach, vi } from 'vitest';
// Testing Library matchers (toBeInTheDocument, toHaveClass, etc.)
import '@testing-library/jest-dom/vitest';

const logVitestSetupWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[vitest.setup.base]', message, error);
};

// ========================
// Comlink Mock Setup
// ========================

const comlinkMock = {
  wrap: <T>(target: any): T => {
    // Return API directly without proxy in test environment
    return target as T;
  },
  expose: (api: any) => {
    // No-op in Node environment
    return api;
  },
  transfer: (obj: any, _transfers?: any[]) => obj,
  transferHandlers: new Map(),
  proxy: <T>(obj: T): T => obj,
  windowEndpoint: (window: any) => window,
  createEndpoint: () => ({}),
  releaseProxy: () => {},
};

vi.mock('comlink', () => comlinkMock);

// ========================
// Worker Environment Setup
// ========================

// Set up Worker environment globals
if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis as any;
}

// Mock Web Worker class
class WorkerMock {
  private listeners: Map<string, Function[]> = new Map();
  
  constructor(public url: string | URL, public options?: WorkerOptions) {}
  
  postMessage(message: any, _transfer?: Transferable[]): void {
    // Simulate async message handling
    setTimeout(() => {
      const handlers = this.listeners.get('message') || [];
      handlers.forEach(handler => handler({ data: message }));
    }, 0);
  }
  
  addEventListener(type: string, listener: Function): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }
  
  removeEventListener(type: string, listener: Function): void {
    const handlers = this.listeners.get(type) || [];
    const index = handlers.indexOf(listener);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }
  
  terminate(): void {
    this.listeners.clear();
  }
}

// Set Worker globally if not available
if (typeof Worker === 'undefined') {
  (globalThis as any).Worker = WorkerMock;
}

// ========================
// Browser API Polyfills
// ========================

// structuredClone polyfill (for Node < v17)
if (!globalThis.structuredClone) {
  globalThis.structuredClone = (obj: any) => {
    return JSON.parse(JSON.stringify(obj));
  };
}

// crypto.subtle mock for tests that need crypto APIs
if (!globalThis.crypto) {
  (globalThis as any).crypto = {
    subtle: {
      digest: vi.fn(),
      encrypt: vi.fn(),
      decrypt: vi.fn(),
    },
    getRandomValues: vi.fn((arr) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    }),
  } as any;
}
// Ensure window.crypto is writable/configurable for tests that reassign it
try {
  Object.defineProperty(globalThis.window ?? globalThis, 'crypto', {
    value: globalThis.crypto,
    configurable: true,
    writable: true,
  });
} catch (error) {
  logVitestSetupWarning('Failed to mark window.crypto as configurable', error);
}

// fetch polyfill (only when not provided by the runtime)
void (async () => {
  if (typeof globalThis.fetch !== 'function') {
    try {
      const fetchModule = await import('node-fetch');
      const { default: nodeFetch, Headers, Request, Response, FormData } = fetchModule as unknown as {
        default: typeof fetch;
        Headers: typeof globalThis.Headers;
        Request: typeof globalThis.Request;
        Response: typeof globalThis.Response;
        FormData?: typeof globalThis.FormData;
      };
      Object.assign(globalThis, {
        fetch: nodeFetch,
        Headers: Headers ?? globalThis.Headers,
        Request: Request ?? globalThis.Request,
        Response: Response ?? globalThis.Response,
        FormData: FormData ?? globalThis.FormData,
      });
    } catch (error) {
      logVitestSetupWarning('Failed to polyfill fetch via node-fetch', error);
    }
  }
})();

// CompressionStream mock for compression tests
if (!globalThis.CompressionStream) {
  globalThis.CompressionStream = class CompressionStream {
    constructor(public format: string) {}
    writable = { getWriter: () => ({ write: vi.fn(), close: vi.fn() }) };
    readable = { getReader: () => ({ read: vi.fn() }) };
  } as any;
}

// URL.createObjectURL is used in worker bootstrap e2e-style tests
if (!globalThis.URL?.createObjectURL) {
  (globalThis.URL as any) = globalThis.URL || {};
  (globalThis.URL as any).createObjectURL = vi.fn(() => 'blob:mock');
}

// Make window.location configurable/writable for tests that override it
try {
  const current = globalThis.window?.location ?? ({} as any);
  Object.defineProperty(globalThis.window ?? globalThis, 'location', {
    configurable: true,
    writable: true,
    value: current,
  });
} catch (error) {
  logVitestSetupWarning('Failed to mark window.location as configurable', error);
}

// ========================
// Test Cleanup Utilities
// ========================

/**
 * Clear all IndexedDB databases
 * Use this in tests that need clean database state
 */
export async function clearAllDatabases(): Promise<void> {
  const databases = await indexedDB.databases?.() || [];
  for (const db of databases) {
    if (db.name) {
      await new Promise<void>((resolve, reject) => {
        const deleteReq = indexedDB.deleteDatabase(db.name!);
        deleteReq.onsuccess = () => resolve();
        deleteReq.onerror = () => reject(deleteReq.error);
        deleteReq.onblocked = () => {
          // Force close any open connections
          setTimeout(() => resolve(), 100);
        };
      });
    }
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
