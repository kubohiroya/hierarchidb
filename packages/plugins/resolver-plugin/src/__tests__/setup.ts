import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

// Ensure crypto API is available for tests (Vitest/JSDOM)
if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

if (typeof globalThis.crypto.randomUUID !== 'function') {
  const fallbackRandomUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const r = Math.floor(Math.random() * 16);
      const v = char === 'x' ? r : ((r & 0x3) | 0x8);
      return v.toString(16);
    });
  };

  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: fallbackRandomUUID,
    configurable: true,
  });
}
