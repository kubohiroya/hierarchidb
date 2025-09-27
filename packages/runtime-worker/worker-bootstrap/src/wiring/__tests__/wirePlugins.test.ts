import { beforeEach, describe, expect, it, vi } from 'vitest';
import { wirePluginsFromModules } from '../wirePlugins.js';
import {
  clearRuntimeExportsForTests,
  getRuntimeExports,
} from '../runtime-export-registry.js';

describe('wirePluginsFromModules', () => {
  beforeEach(() => {
    clearRuntimeExportsForTests();
  });

  it('registers worker namespace exports', async () => {
    const createEntityHandler = vi.fn(async () => ({ handler: true }));
    const createBatchManager = vi.fn(async () => ({ manager: true }));
    const lifecycle = { onCreate: vi.fn() };

    await wirePluginsFromModules([
      {
        nodeType: 'shape',
        mod: {
          worker: {
            createEntityHandler,
            createBatchManager,
            lifecycle,
          },
        },
      },
    ]);

    const runtimeExports = getRuntimeExports('shape');
    expect(runtimeExports?.createEntityHandler).toBe(createEntityHandler);
    expect(runtimeExports?.createBatchManager).toBe(createBatchManager);
    expect(runtimeExports?.lifecycle).toBe(lifecycle);
  });

  it('invokes runtime wiring hooks when exported', async () => {
    const registerSharedDownloadService = vi.fn();
    const registerAuthNotifier = vi.fn();
    const registerRuntimeWorkerAdapters = vi.fn();

    await wirePluginsFromModules([
      {
        nodeType: 'location',
        mod: {
          worker: {},
          runtimeWiring: {
            registerSharedDownloadService,
            registerAuthNotifier,
            registerRuntimeWorkerAdapters,
          },
        },
      },
    ]);

    expect(registerSharedDownloadService).toHaveBeenCalledTimes(1);
    expect(registerAuthNotifier).toHaveBeenCalledTimes(1);
    expect(registerRuntimeWorkerAdapters).toHaveBeenCalledTimes(1);
  });
});
