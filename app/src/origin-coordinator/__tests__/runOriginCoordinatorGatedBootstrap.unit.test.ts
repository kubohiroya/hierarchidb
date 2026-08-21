import { describe, expect, it, vi } from 'vitest';
import { runOriginCoordinatorGatedBootstrap } from '../runOriginCoordinatorGatedBootstrap.js';
import type { OriginCoordinatorClientHandle } from '../types.js';

const coordinator = Object.freeze({}) as OriginCoordinatorClientHandle;

describe('runOriginCoordinatorGatedBootstrap', () => {
  it('runs only activation and success handoff for an allowed contender', async () => {
    const order: string[] = [];
    const prepareCanonicalRuntime = vi.fn(async () => undefined);
    const initializeBrowserGlobals = vi.fn();
    const initializeRuntime = vi.fn(async () => 'router');

    const result = await runOriginCoordinatorGatedBootstrap({
      initializeCoordinator: async () => {
        order.push('coordinator:allowed');
        return { status: 'activation-allowed', coordinator };
      },
      acceptActivationCoordinator: (accepted) => {
        expect(accepted).toBe(coordinator);
        order.push('coordinator:stored');
      },
      activateCanonicalStorage: async (accepted) => {
        expect(accepted).toBe(coordinator);
        order.push('storage:canonical-ready');
      },
      requestSuccessReload: () => order.push('reload'),
      prepareCanonicalRuntime,
      initializeBrowserGlobals,
      initializeRuntime,
    });

    expect(result).toEqual({ status: 'reload-requested' });
    expect(order).toEqual([
      'coordinator:allowed',
      'coordinator:stored',
      'storage:canonical-ready',
      'reload',
    ]);
    expect(prepareCanonicalRuntime).not.toHaveBeenCalled();
    expect(initializeBrowserGlobals).not.toHaveBeenCalled();
    expect(initializeRuntime).not.toHaveBeenCalled();
  });

  it('validates the canonical worker before browser globals and runtime', async () => {
    const order: string[] = [];
    const activateCanonicalStorage = vi.fn(async () => undefined);
    const requestSuccessReload = vi.fn();

    const result = await runOriginCoordinatorGatedBootstrap({
      initializeCoordinator: async () => ({
        status: 'canonical-revoked',
        coordinatorGate: 'revoked-ready-for-preflight',
        helloCode: 'LEGACY_YAML_ACCESS_REVOKED',
      }),
      acceptActivationCoordinator: vi.fn(),
      activateCanonicalStorage,
      requestSuccessReload,
      prepareCanonicalRuntime: async () => {
        order.push('canonical-worker');
      },
      initializeBrowserGlobals: () => order.push('browser-globals'),
      initializeRuntime: async () => {
        order.push('runtime');
        return 'router';
      },
    });

    expect(result).toEqual({ status: 'runtime-ready', runtime: 'router' });
    expect(order).toEqual(['canonical-worker', 'browser-globals', 'runtime']);
    expect(activateCanonicalStorage).not.toHaveBeenCalled();
    expect(requestSuccessReload).not.toHaveBeenCalled();
  });

  it('does not request reload after activation failure', async () => {
    const failure = new Error('activation-failed');
    const requestSuccessReload = vi.fn();

    await expect(
      runOriginCoordinatorGatedBootstrap({
        initializeCoordinator: async () => ({ status: 'activation-allowed', coordinator }),
        acceptActivationCoordinator: vi.fn(),
        activateCanonicalStorage: async () => {
          throw failure;
        },
        requestSuccessReload,
        prepareCanonicalRuntime: vi.fn(async () => undefined),
        initializeBrowserGlobals: vi.fn(),
        initializeRuntime: vi.fn(async () => 'router'),
      })
    ).rejects.toBe(failure);

    expect(requestSuccessReload).not.toHaveBeenCalled();
  });

  it('publishes nothing when canonical worker preparation fails', async () => {
    const failure = new Error('canonical-worker-failed');
    const initializeBrowserGlobals = vi.fn();
    const initializeRuntime = vi.fn(async () => 'router');

    await expect(
      runOriginCoordinatorGatedBootstrap({
        initializeCoordinator: async () => ({
          status: 'canonical-revoked',
          coordinatorGate: 'revoked-ready-for-preflight',
          helloCode: 'LEGACY_YAML_ACCESS_REVOKED',
        }),
        acceptActivationCoordinator: vi.fn(),
        activateCanonicalStorage: vi.fn(async () => undefined),
        requestSuccessReload: vi.fn(),
        prepareCanonicalRuntime: async () => {
          throw failure;
        },
        initializeBrowserGlobals,
        initializeRuntime,
      })
    ).rejects.toBe(failure);

    expect(initializeBrowserGlobals).not.toHaveBeenCalled();
    expect(initializeRuntime).not.toHaveBeenCalled();
  });
});
