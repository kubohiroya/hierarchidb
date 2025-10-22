import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// Quiet noisy logs during tests
global.console.error = vi.fn();
global.console.warn = vi.fn();
