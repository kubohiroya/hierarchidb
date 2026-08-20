import { describe, expect, it, vi } from 'vitest';
import { runOriginCoordinatorGatedBootstrap } from '../runOriginCoordinatorGatedBootstrap.js';

describe('runOriginCoordinatorGatedBootstrap', () => {
  it('starts browser storage and runtime only after coordinator acceptance', async () => {
    const order: string[] = [];
    const coordinator = Object.freeze({ kind: 'coordinator' });

    const runtime = await runOriginCoordinatorGatedBootstrap({
      initializeCoordinator: async () => {
        order.push('coordinator:start');
        await Promise.resolve();
        order.push('coordinator:accepted');
        return coordinator;
      },
      acceptCoordinator: (accepted) => {
        expect(accepted).toBe(coordinator);
        order.push('coordinator:stored');
      },
      initializeBrowserGlobals: () => {
        order.push('browser-globals');
      },
      preloadWorkerStores: async () => {
        order.push('worker-stores:start');
        await Promise.resolve();
        order.push('worker-stores:ready');
      },
      initializeRuntime: async () => {
        order.push('runtime');
        return 'router';
      },
    });

    expect(runtime).toBe('router');
    expect(order).toEqual([
      'coordinator:start',
      'coordinator:accepted',
      'coordinator:stored',
      'browser-globals',
      'worker-stores:start',
      'worker-stores:ready',
      'runtime',
    ]);
  });

  it('does not start any legacy bootstrap action after coordinator rejection', async () => {
    const failure = new Error('coordinator-rejected');
    const acceptCoordinator = vi.fn();
    const initializeBrowserGlobals = vi.fn();
    const preloadWorkerStores = vi.fn(async () => undefined);
    const initializeRuntime = vi.fn(async () => 'router');

    await expect(
      runOriginCoordinatorGatedBootstrap({
        initializeCoordinator: async () => {
          throw failure;
        },
        acceptCoordinator,
        initializeBrowserGlobals,
        preloadWorkerStores,
        initializeRuntime,
      })
    ).rejects.toBe(failure);

    expect(acceptCoordinator).not.toHaveBeenCalled();
    expect(initializeBrowserGlobals).not.toHaveBeenCalled();
    expect(preloadWorkerStores).not.toHaveBeenCalled();
    expect(initializeRuntime).not.toHaveBeenCalled();
  });

  it('does not initialize runtime when worker-store preload fails', async () => {
    const initializeRuntime = vi.fn(async () => 'router');

    await expect(
      runOriginCoordinatorGatedBootstrap({
        initializeCoordinator: async () => 'coordinator',
        acceptCoordinator: () => {},
        initializeBrowserGlobals: () => {},
        preloadWorkerStores: async () => {
          throw new Error('preload-failed');
        },
        initializeRuntime,
      })
    ).rejects.toThrow('preload-failed');

    expect(initializeRuntime).not.toHaveBeenCalled();
  });
});
