// folder-plugin Test Setup
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// Reduce noisy act() warnings from third-party components during tests.
// We still rely on RTL to wrap interactions; this filters repeated console
// messages that do not affect assertions.
type ConsoleErrorFn = (
  ...args: Parameters<typeof console.error>
) => ReturnType<typeof console.error>;
const originalConsoleError: ConsoleErrorFn = console.error.bind(console);
console.error = (...args: Parameters<typeof console.error>) => {
  const [first] = args;
  const message = typeof first === 'string' ? first : (first?.toString?.() ?? '');
  if (typeof message === 'string' && message.includes('not wrapped in act')) {
    return; // suppress repetitive act warnings from MUI internals
  }
  return originalConsoleError(...args);
};

// Make crypto assignable if tests patch it
const desc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
if (desc && (!desc.configurable || !desc.writable)) {
  try {
    Object.defineProperty(globalThis, 'crypto', {
      value: globalThis.crypto,
      configurable: true,
      writable: true,
    });
  } catch {
    vi.stubGlobal('crypto', globalThis.crypto ?? {});
  }
}
