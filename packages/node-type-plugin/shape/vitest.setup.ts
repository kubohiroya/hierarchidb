/**
 * Vitest Setup for Shape Plugin Tests
 * 
 * Sets up test environment for geospatial processing, Workers, and IndexedDB
 */

import 'fake-indexeddb/auto';
import { beforeEach, vi } from 'vitest';

// Comlink mock for Node environment
const comlinkMock = {
  wrap: <T>(target: any): T => {
    // Return Worker API directly (no proxy)
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

// Mock geospatial libraries for testing
vi.mock('@turf/turf', () => ({
  // Basic implementations for testing
  area: (feature: any) => 1000, // Mock area calculation
  bbox: (feature: any) => [-1, -1, 1, 1], // Mock bounding box
  simplify: (feature: any, options: any) => feature, // Pass-through for now
  union: (features: any[]) => features[0], // Return first feature
}));

vi.mock('topojson-client', () => ({
  feature: (topology: any, object: any) => ({ type: 'Feature', geometry: {}, properties: {} }),
  mesh: (topology: any, object: any) => ({ type: 'MultiLineString', coordinates: [] }),
}));

vi.mock('topojson-server', () => ({
  topology: (objects: any) => ({ type: 'Topology', objects, arcs: [] }),
}));

// Mock fetch for download operations
global.fetch = vi.fn().mockImplementation(async (url: string) => {
  // Mock GeoJSON response
  const mockGeoJSON = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'test-feature-1',
        properties: { name: 'Test Feature', admin_level: 1 },
        geometry: {
          type: 'Polygon',
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
        }
      }
    ]
  };

  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(mockGeoJSON)).buffer,
    json: async () => mockGeoJSON,
  } as Response;
});

// Worker environment mock
if (typeof globalThis.self === 'undefined') {
  globalThis.self = {
    ...globalThis,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    postMessage: vi.fn(),
    close: vi.fn(),
    importScripts: vi.fn()
  } as any;
}

// Web Worker mock for testing
class WorkerMock {
  private listeners: Map<string, Function[]> = new Map();
  
  constructor(public url: string | URL, public options?: WorkerOptions) {}
  
  postMessage(message: any, _transfer?: Transferable[]): void {
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

if (typeof Worker === 'undefined') {
  (globalThis as any).Worker = WorkerMock;
}

// CompressionStream mock for vector tile compression
if (typeof CompressionStream === 'undefined') {
  (globalThis as any).CompressionStream = class CompressionStreamMock {
    readable: ReadableStream;
    writable: WritableStream;
    
    constructor(format: 'gzip' | 'deflate') {
      const transform = new TransformStream({
        transform(chunk, controller) {
          // Mock compression: just pass through
          controller.enqueue(chunk);
        }
      });
      this.readable = transform.readable;
      this.writable = transform.writable;
    }
  };
}

// structuredClone polyfill
if (!globalThis.structuredClone) {
  globalThis.structuredClone = (obj: any) => {
    return JSON.parse(JSON.stringify(obj));
  };
}

// crypto.subtle mock for tile hashing
if (!globalThis.crypto?.subtle) {
  globalThis.crypto = {
    ...globalThis.crypto,
    subtle: {
      digest: async (algorithm: string, data: ArrayBuffer) => {
        // Mock hash: return simple hash based on data length
        const hash = new ArrayBuffer(32); // SHA-256 length
        const view = new Uint8Array(hash);
        const dataLength = data.byteLength;
        for (let i = 0; i < 32; i++) {
          view[i] = (dataLength + i) % 256;
        }
        return hash;
      }
    } as any
  };
}

// Test environment cleanup helper
export async function clearAllDatabases(): Promise<void> {
  const databases = await indexedDB.databases?.() || [];
  for (const db of databases) {
    if (db.name) {
      await new Promise<void>((resolve, reject) => {
        const deleteReq = indexedDB.deleteDatabase(db.name!);
        deleteReq.onsuccess = () => resolve();
        deleteReq.onerror = () => reject(deleteReq.error);
      });
    }
  }
}

// Clear databases before each test
beforeEach(async () => {
  await clearAllDatabases();
  vi.clearAllMocks();
});

// Mock console methods for test output control
global.console.error = vi.fn();
global.console.warn = vi.fn();