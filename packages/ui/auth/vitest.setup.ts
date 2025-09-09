import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Make globalThis.crypto writable/configurable for tests that reassign it
(() => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  if (desc && (!desc.configurable || !desc.writable)) {
    try {
      Object.defineProperty(globalThis, 'crypto', {
        value: globalThis.crypto,
        configurable: true,
        writable: true,
      });
    } catch {
      // Fallback: stub global if missing or locked
      vi.stubGlobal('crypto', globalThis.crypto ?? {});
    }
  } else if (!('crypto' in globalThis)) {
    vi.stubGlobal('crypto', {});
  }

  // Provide minimal crypto methods if absent
  const c: any = globalThis.crypto as any;
  if (typeof c.getRandomValues !== 'function') {
    c.getRandomValues = (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    };
  }
  if (typeof c.randomUUID !== 'function') {
    c.randomUUID = () => `test-uuid-${Math.random().toString(36).slice(2, 10)}`;
  }
})();

// Suppress the specific expected error from the test that intentionally
// renders useMultiAuth() outside its provider to assert throwing behavior.
// We prevent it from being treated as an uncaught global error while
// still allowing the test's expect(...).toThrow() to pass.
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('error', (ev) => {
    const msg = (ev as any)?.error?.message || ev.message;
    if (typeof msg === 'string' && msg.includes('useMultiAuth must be used within MultiAuthProvider')) {
      ev.preventDefault();
    }
  });
}
