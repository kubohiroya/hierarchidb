import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { createLaneSemaphoreRegistry } from '../LaneSemaphoreRegistry.js';

const TEST_ENV_KEY = 'TEST_LANE_LIMITS';
const globalBag = globalThis as Record<string, unknown> & {
  __HIERARCHIDB_ENV__?: Record<string, unknown>;
};

const cleanupEnv = () => {
  if (globalBag.__HIERARCHIDB_ENV__ && typeof globalBag.__HIERARCHIDB_ENV__ === 'object') {
    delete globalBag.__HIERARCHIDB_ENV__[TEST_ENV_KEY];
    if (Object.keys(globalBag.__HIERARCHIDB_ENV__).length === 0) {
      delete globalBag.__HIERARCHIDB_ENV__;
    }
  }
  delete globalBag[TEST_ENV_KEY];
};

describe('LaneSemaphoreRegistry', () => {
  beforeEach(() => {
    cleanupEnv();
  });

  afterEach(() => {
    cleanupEnv();
  });

  it('enforces per-lane concurrency limits', async () => {
    const registry = createLaneSemaphoreRegistry({
      defaults: { alpha: 2 },
      fallback: 1,
    });
    let active = 0;
    let peak = 0;
    const tasks = Array.from({ length: 5 }, () =>
      registry.runWithLane('alpha', async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;
      }),
    );

    await Promise.all(tasks);
    expect(peak).toBe(2);
  });

  it('respects environment overrides and disable toggle', () => {
    globalBag[TEST_ENV_KEY] = 'beta=3';
    const registry = createLaneSemaphoreRegistry({
      defaults: { beta: 1 },
      envKey: TEST_ENV_KEY,
      fallback: 2,
    });
    expect(registry.getLaneCapacity('beta')).toBe(3);
    expect(registry.recommendConcurrency(['beta', 'beta'])).toBe(3);

    globalBag[TEST_ENV_KEY] = '0';
    const disabledRegistry = createLaneSemaphoreRegistry({
      defaults: { beta: 4 },
      envKey: TEST_ENV_KEY,
      fallback: 2,
    });
    expect(disabledRegistry.isDisabled()).toBe(true);
    expect(disabledRegistry.recommendConcurrency(['beta'], 4)).toBe(4);
  });

  it('falls back for unknown lanes and deduplicates lane list when recommending concurrency', () => {
    const registry = createLaneSemaphoreRegistry({
      defaults: { gamma: 3, default: 2 },
      fallback: 5,
    });
    expect(registry.getLaneCapacity('unknown')).toBe(5);
    const concurrency = registry.recommendConcurrency(['gamma', 'gamma', 'unknown'], 2);
    expect(concurrency).toBe(8);
  });
});
