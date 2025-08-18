// Vitest Setup
import '@testing-library/jest-dom';

// Mock ResizeObserver if not available
if (typeof ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}