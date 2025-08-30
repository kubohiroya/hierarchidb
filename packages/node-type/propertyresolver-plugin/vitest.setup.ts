import 'fake-indexeddb/auto';

// Mock ResizeObserver for tests
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};