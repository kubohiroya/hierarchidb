import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';

const workerClientMock = vi.hoisted(() => ({
  getOrInit: vi.fn<() => Promise<Remote<WorkerAPI>>>(),
  isReady: vi.fn<() => boolean>(),
  getSingleton: vi.fn<() => Remote<WorkerAPI>>(),
}));

vi.mock('../WorkerAPIClient.js', () => ({
  WorkerAPIClient: workerClientMock,
  NotInitializedError: class NotInitializedError extends Error {},
}));

const importPluginWorkerMock = vi.hoisted(() => vi.fn<
  (id: string) => Promise<Record<string, unknown>>
>());

const mockStoreRegistry = {
  getPeer: vi.fn(),
  registerPeer: vi.fn(),
};

vi.mock('@hierarchidb/runtime-worker', () => ({
  importPluginWorker: importPluginWorkerMock,
  storeRegistry: mockStoreRegistry,
}));

describe('WorkerModuleLoader', () => {
  const fakeClient = {} as Remote<WorkerAPI>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    workerClientMock.getOrInit.mockReset();
    workerClientMock.isReady.mockReset();
    workerClientMock.getSingleton.mockReset();
    importPluginWorkerMock.mockReset();
    mockStoreRegistry.getPeer.mockReset();
    mockStoreRegistry.registerPeer.mockReset();
  });

  it('preloads plugin workers and swallows loader errors', async () => {
    workerClientMock.getOrInit.mockResolvedValue(fakeClient);
    workerClientMock.isReady.mockReturnValue(true);
    workerClientMock.getSingleton.mockReturnValue(fakeClient);

    const loaderMap: Record<string, ReturnType<typeof vi.fn>> = {
      basemap: vi.fn().mockResolvedValue(undefined),
      folder: vi.fn().mockRejectedValue(new Error('folder failed')),
      resolver: vi.fn().mockResolvedValue(undefined),
      route: vi.fn().mockResolvedValue(undefined),
      spreadsheet: vi.fn().mockResolvedValue(undefined),
      styler: vi.fn().mockResolvedValue(undefined),
      shape: vi.fn().mockResolvedValue(undefined),
      location: vi.fn().mockResolvedValue(undefined),
      linker: vi.fn().mockResolvedValue(undefined),
      timeline: vi.fn().mockResolvedValue(undefined),
    };

    importPluginWorkerMock.mockImplementation(async (id: string) => {
      const loader = loaderMap[id];
      if (!loader) return {};
      const exportName = `load${id.charAt(0).toUpperCase()}${id.slice(1)}EntitiesDbModule` as const;
      return { [exportName]: loader } as Record<string, unknown>;
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { ensureWorkerRuntime } = await import('../WorkerModuleLoader.js');

    await ensureWorkerRuntime();
    await ensureWorkerRuntime();

    expect(importPluginWorkerMock).toHaveBeenCalledTimes(10);
    expect(loaderMap.basemap).toHaveBeenCalledTimes(1);
    expect(loaderMap.folder).toHaveBeenCalledTimes(1);
    expect(loaderMap.resolver).toHaveBeenCalledTimes(1);
    expect(loaderMap.route).toHaveBeenCalledTimes(1);
    expect(loaderMap.spreadsheet).toHaveBeenCalledTimes(1);
    expect(loaderMap.styler).toHaveBeenCalledTimes(1);
    expect(loaderMap.shape).toHaveBeenCalledTimes(1);
    expect(loaderMap.location).toHaveBeenCalledTimes(1);
    expect(loaderMap.linker).toHaveBeenCalledTimes(1);
    expect(loaderMap.timeline).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
    logSpy.mockRestore();
    infoSpy.mockRestore();
  });
});
