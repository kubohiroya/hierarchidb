import '@testing-library/jest-dom';
import { vi } from 'vitest';

type MutableCrypto = Partial<Crypto> & Record<string, unknown>;

// Make globalThis.crypto writable/configurable for tests that reassign it
(() => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  if (descriptor && (!descriptor.configurable || !descriptor.writable)) {
    try {
      Object.defineProperty(globalThis, 'crypto', {
        value: globalThis.crypto,
        configurable: true,
        writable: true,
      });
    } catch {
      vi.stubGlobal('crypto', {} as Crypto);
    }
  } else if (!('crypto' in globalThis)) {
    vi.stubGlobal('crypto', {} as Crypto);
  }

  const cryptoRef = (globalThis.crypto ?? {}) as MutableCrypto;
  if (typeof cryptoRef.getRandomValues !== 'function') {
    cryptoRef.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
      if (array === null) {
        throw new TypeError('array must not be null');
      }
      const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      for (let i = 0; i < view.length; i += 1) {
        view[i] = Math.floor(Math.random() * 256);
      }
      return array;
    };
  }
  if (typeof cryptoRef.randomUUID !== 'function') {
    cryptoRef.randomUUID = () => '00000000-0000-4000-8000-000000000000';
  }
})();

// Suppress the specific expected error from the test that intentionally
// renders useMultiAuth() outside its provider to assert throwing behavior.
// We prevent it from being treated as an uncaught global error while
// still allowing the test's expect(...).toThrow() to pass.
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('error', (event: Event) => {
    const errorEvent = event as ErrorEvent;
    const message = typeof errorEvent.error?.message === 'string' ? errorEvent.error.message : errorEvent.message;
    if (typeof message === 'string' && message.includes('useMultiAuth must be used within MultiAuthProvider')) {
      event.preventDefault();
    }
  });
}
