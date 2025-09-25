import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';

describe('Worker runtime state store', () => {
  const fakeClient = {} as Remote<WorkerAPI>;

  beforeEach(() => {
    vi.resetModules();
  });

  it('transitions to ready and notifies subscribers when initialization succeeds', async () => {
    let ready = false;
    const getOrInit = vi.fn(async () => {
      ready = true;
      return fakeClient;
    });

    vi.doMock('../WorkerAPIClient.js', () => ({
      WorkerAPIClient: {
        getOrInit,
        isReady: vi.fn(() => ready),
        getSingleton: vi.fn(() => fakeClient),
      },
      NotInitializedError: class NotInitializedError extends Error {},
    }));

    vi.doMock('./WorkerModuleLoader.js', () => ({
      ensureWorkerRuntime: vi.fn().mockResolvedValue(fakeClient),
    }));

    const {
      ensureWorkerInitialized,
      getWorkerSnapshot,
      subscribeWorkerState,
    } = await import('../WorkerStateStore.js');

    const observedStates: string[] = [];
    const unsubscribe = subscribeWorkerState((snapshot) => {
      observedStates.push(snapshot.state);
    });

    const result = await ensureWorkerInitialized();
    unsubscribe();

    expect(result).toBe(fakeClient);
    expect(getWorkerSnapshot().state).toBe('ready');
    expect(observedStates).toEqual(['uninitialized', 'initializing', 'ready']);
  });

  it('records failure state when initialization rejects', async () => {
    const loaderError = new Error('boom');
    vi.doMock('../WorkerAPIClient.js', () => ({
      WorkerAPIClient: {
        getOrInit: vi.fn(async () => {
          throw loaderError;
        }),
        isReady: vi.fn(() => false),
        getSingleton: vi.fn(() => {
          throw loaderError;
        }),
      },
      NotInitializedError: class NotInitializedError extends Error {},
    }));

    vi.doMock('./WorkerModuleLoader.js', () => ({
      ensureWorkerRuntime: vi.fn().mockRejectedValue(loaderError),
    }));

    const {
      ensureWorkerInitialized,
      getWorkerSnapshot,
    } = await import('../WorkerStateStore.js');

    await expect(ensureWorkerInitialized()).rejects.toThrow('boom');
    const snapshot = getWorkerSnapshot();
    expect(snapshot.state).toBe('failed');
    expect(snapshot.error?.message).toBe('boom');
  });
});

describe('WorkerModuleLoader', () => {
  const fakeClient = {} as Remote<WorkerAPI>;

  beforeEach(() => {
    vi.resetModules();
  });

  it('preloads plugin workers and swallows loader errors', async () => {
    vi.doMock('../WorkerAPIClient.js', () => ({
      WorkerAPIClient: {
        getOrInit: vi.fn(async () => fakeClient),
        isReady: vi.fn(() => true),
        getSingleton: vi.fn(() => fakeClient),
      },
      NotInitializedError: class NotInitializedError extends Error {},
    }));

    const basemapLoader = vi.fn().mockResolvedValue(undefined);
    const folderLoader = vi.fn().mockRejectedValue(new Error('folder failed'));
    const resolverLoader = vi.fn().mockResolvedValue(undefined);
    const routeLoader = vi.fn().mockResolvedValue(undefined);
    const spreadsheetLoader = vi.fn().mockResolvedValue(undefined);
    const stylerLoader = vi.fn().mockResolvedValue(undefined);
    const locationLoader = vi.fn().mockResolvedValue(undefined);
    const linkerLoader = vi.fn().mockResolvedValue(undefined);
    const timelineLoader = vi.fn().mockResolvedValue(undefined);

    const importPluginWorkerMock = vi.fn(async (id: string) => {
      switch (id) {
        case 'basemap':
          return { loadBasemapEntitiesDbModule: basemapLoader };
        case 'folder':
          return { loadFolderEntitiesDbModule: folderLoader };
        case 'resolver':
          return { loadResolverEntitiesDbModule: resolverLoader };
        case 'route':
          return { loadRouteEntitiesDbModule: routeLoader };
        case 'spreadsheet':
          return { loadSpreadsheetEntitiesDbModule: spreadsheetLoader };
        case 'styler':
          return { loadStylerEntitiesDbModule: stylerLoader };
        case 'location':
          return { loadLocationEntitiesDbModule: locationLoader };
        case 'linker':
          return { loadLinkerEntitiesDbModule: linkerLoader };
        case 'timeline':
          return { loadTimelineEntitiesDbModule: timelineLoader };
        default:
          return {};
      }
    });

    vi.doMock('@hierarchidb/runtime-shared-module-paths', () => ({
      importPluginWorker: importPluginWorkerMock,
    }));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { ensureWorkerRuntime } = await import('../WorkerModuleLoader.js');

    await ensureWorkerRuntime();
    await ensureWorkerRuntime();

    expect(importPluginWorkerMock).toHaveBeenCalledTimes(9);
    expect(basemapLoader).toHaveBeenCalledTimes(1);
    expect(folderLoader).toHaveBeenCalledTimes(1);
    expect(resolverLoader).toHaveBeenCalledTimes(1);
    expect(routeLoader).toHaveBeenCalledTimes(1);
    expect(spreadsheetLoader).toHaveBeenCalledTimes(1);
    expect(stylerLoader).toHaveBeenCalledTimes(1);
    expect(locationLoader).toHaveBeenCalledTimes(1);
    expect(linkerLoader).toHaveBeenCalledTimes(1);
    expect(timelineLoader).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
