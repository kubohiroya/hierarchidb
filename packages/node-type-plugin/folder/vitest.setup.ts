import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Setup fake IndexedDB for testing
import { FDBFactory } from 'fake-indexeddb';
global.indexedDB = new FDBFactory();

// Mock global functions that would be provided by the UI core
global.checkCreatePermission = vi.fn().mockResolvedValue(true);
global.getChildren = vi.fn().mockResolvedValue([]);
global.hasChildren = vi.fn().mockResolvedValue(false);
global.showDialog = vi.fn();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
};
