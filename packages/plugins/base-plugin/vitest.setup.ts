import 'fake-indexeddb/auto';
import { vi } from 'vitest';

if (!globalThis.crypto) {
  const getRandomValues = <T extends ArrayBufferView>(array: T): T => {
    const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    for (let i = 0; i < view.length; i++) {
      view[i] = Math.floor(Math.random() * 256);
    }
    return array;
  };

  const subtleStub: SubtleCrypto = new Proxy({} as SubtleCrypto, {
    get: () => {
      throw new Error('SubtleCrypto not implemented in test environment');
    },
  });

  const cryptoStub: Crypto = {
    getRandomValues,
    randomUUID: () => `uuid-${Math.random().toString(16).slice(2)}`,
    subtle: subtleStub,
  };

  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: cryptoStub,
  });
}

// Quiet noisy logs during tests
global.console.error = vi.fn();
global.console.warn = vi.fn();
