import { vi } from 'vitest';
import 'fake-indexeddb/auto';

// Setup test globals
(global as any).vi = vi;
(global as any).describe = vi.describe || describe;
(global as any).it = vi.it || it;
(global as any).test = vi.test || test;
(global as any).expect = vi.expect || expect;
(global as any).beforeEach = vi.beforeEach || beforeEach;
(global as any).afterEach = vi.afterEach || afterEach;
(global as any).beforeAll = vi.beforeAll || beforeAll;
(global as any).afterAll = vi.afterAll || afterAll;