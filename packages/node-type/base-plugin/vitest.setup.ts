import 'fake-indexeddb/auto';
import { vi } from 'vitest';

if (!globalThis.crypto) {
  (globalThis as any).crypto = {
    getRandomValues: (arr: any) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    },
    subtle: {} as any,
    randomUUID: () => `uuid-${Math.random().toString(16).slice(2)}`,
  } as any;
}

// Quiet noisy logs during tests
global.console.error = vi.fn();
global.console.warn = vi.fn();

