import type { BuildWorkerAPI } from '~/types/worker-api';
import type { Remote } from 'comlink';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const workerClientMock = vi.hoisted(() => ({
  getOrInit: vi.fn<() => Promise<Remote<BuildWorkerAPI>>>(),
  isReady: vi.fn<() => boolean>(),
  getSingleton: vi.fn<() => Remote<BuildWorkerAPI>>(),
}));

vi.mock('../../WorkerAPIClient.ts', () => ({
  WorkerAPIClient: workerClientMock,
  NotInitializedError: class NotInitializedError extends Error {},
}));

const importPluginWorkerMock = vi.hoisted(() =>
  vi.fn<(id: string) => Promise<Record<string, unknown>>>()
);

const appWorkerStorePreloadsMock: Record<string, string[]> = {
  basemap: ['loadBasemapEntitiesDbModule'],
  folder: ['loadFolderEntitiesDbModule'],
  resolver: ['loadResolverEntitiesDbModule'],
  route: ['loadRouteEntitiesDbModule'],
  spreadsheet: ['loadSpreadsheetEntitiesDbModule'],
  styler: ['loadStylerEntitiesDbModule'],
  shape: ['loadShapeEntitiesDbModule'],
  location: ['loadLocationEntitiesDbModule'],
  linker: ['loadLinkerEntitiesDbModule'],
  timeline: ['loadTimelineEntitiesDbModule'],
};

vi.mock('~/plugin-loaders/worker-loaders.ts', () => ({
  pluginWorkerLoaders: {},
}));

vi.mock('~/plugin-runtime/store-selection.ts', () => ({
  APP_WORKER_STORE_PRELOADS: appWorkerStorePreloadsMock,
}));

vi.mock('~/plugin-loaders/index.ts', () => ({
  pluginRegistry: Object.keys(appWorkerStorePreloadsMock).map((nodeType) => ({
    nodeType,
    modules: { worker: `./${nodeType}/worker` },
  })),
}));

vi.mock('@hierarchidb/runtime-worker', () => ({
  configureWorkerContainer: (
    configure: (container: { rebind: () => { toConstantValue: (value: unknown) => void } }) => void
  ) => {
    configure({
      rebind: () => ({
        toConstantValue: () => {},
      }),
    });
  },
  WorkerDiTokens: { PluginWorkerLoaderMap: Symbol('PluginWorkerLoaderMap') },
  importPluginWorker: importPluginWorkerMock,
}));

describe('WorkerModuleLoader', () => {
  const fakeClient = {} as Remote<BuildWorkerAPI>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    workerClientMock.getOrInit.mockReset();
    workerClientMock.isReady.mockReset();
    workerClientMock.getSingleton.mockReset();
    importPluginWorkerMock.mockReset();
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
      const exportNames = appWorkerStorePreloadsMock[id] ?? [];
      return Object.fromEntries(exportNames.map((name) => [name, loader]));
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { ensureWorkerRuntime } = await import('~/worker-runtime/WorkerModuleLoader');

    await ensureWorkerRuntime();
    await ensureWorkerRuntime();
    await new Promise((resolve) => setTimeout(resolve, 0));

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
