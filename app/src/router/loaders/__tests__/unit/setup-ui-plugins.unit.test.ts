import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupUIPlugins } from '../../uiPlugins.js';

// Mock the ui-loader to avoid loading actual plugin-loaders in tests
vi.mock('../../../../plugin-loaders/ui-plugin-loader.js', () => ({
  loadAllUIPlugins: vi.fn().mockResolvedValue(undefined),
  resetUiPluginLoadStateForTesting: vi.fn(),
}));

describe('setupUIPlugins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return registry and teardown function', async () => {
    const result = await setupUIPlugins();

    expect(result).toBeDefined();
    expect(result.registry).toBeDefined();
    expect(result.servicesReady).toBeInstanceOf(Promise);
    expect(typeof result.teardown).toBe('function');
  });

  it('should resolve servicesReady promise', async () => {
    const result = await setupUIPlugins();

    await expect(result.servicesReady).resolves.toBeUndefined();
  });

  it('should allow teardown to be called', async () => {
    const result = await setupUIPlugins();

    await expect(result.teardown()).resolves.toBeUndefined();
  });

  it('should return consistent registry structure', async () => {
    const result1 = await setupUIPlugins();
    const result2 = await setupUIPlugins();

    // Registry should be defined objects
    expect(typeof result1.registry).toBe('object');
    expect(typeof result2.registry).toBe('object');
  });
});
