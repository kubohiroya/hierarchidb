import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { PluginWorkerId } from '@hierarchidb/runtime-worker';
import { loadWorkerAPIClientModule } from './workerApiClientLoader.js';

// NOTE: Worker runtime and plugin worker modules are no longer imported through
// legacy `*/worker` subpath specifiers.  Instead we delegate to the
// `@hierarchidb/runtime-worker` module-path helpers so that both the runtime
// bundle and each plugin worker can be resolved via a single, versioned entry
// point.  This loader keeps the cache warm and preloads the optional peer store
// registration helpers for the plugin-loader that still expose Dexie-backed stores.

type ModulePathsModule = typeof import('@hierarchidb/runtime-worker');

const PLUGINS_TO_PRELOAD: PluginWorkerId[] = [
  'basemap',
  'folder',
  'resolver',
  'route',
  'spreadsheet',
  'styler',
  'shape',
  'location',
  'linker',
  'timeline',
];

const PLUGIN_LOADER_EXPORTS: Partial<Record<PluginWorkerId, string[]>> = {
  basemap: ['registerBasemapWorkerStores', 'loadBasemapEntitiesDbModule'],
  folder: ['registerFolderWorkerStores', 'loadFolderEntitiesDbModule'],
  resolver: ['registerResolverWorkerStores', 'loadResolverEntitiesDbModule'],
  route: ['registerRouteWorkerStores', 'loadRouteEntitiesDbModule'],
  spreadsheet: ['registerSpreadsheetWorkerStores', 'loadSpreadsheetEntitiesDbModule'],
  styler: ['registerStylerWorkerStores', 'loadStylerEntitiesDbModule'],
  shape: ['registerShapeWorkerStores', 'loadShapeEntitiesDbModule'],
  location: ['registerLocationWorkerStores', 'loadLocationEntitiesDbModule'],
  linker: ['registerLinkerWorkerStores', 'loadLinkerEntitiesDbModule'],
  timeline: ['registerTimelineWorkerStores', 'loadTimelineEntitiesDbModule'],
};

let runtimePromise: Promise<Remote<WorkerAPI>> | null = null;
let pluginLoadPromise: Promise<void> | null = null;

const isBrowserEnvironment = typeof window !== 'undefined';

let cachedModulePaths: ModulePathsModule | null = null;
let modulePathsPromise: Promise<ModulePathsModule> | null = null;

const getModulePaths = (): ModulePathsModule | null => cachedModulePaths;

const loadModulePaths = async (): Promise<ModulePathsModule> => {
  if (cachedModulePaths) return cachedModulePaths;
  if (!modulePathsPromise) {
    modulePathsPromise = import('@hierarchidb/runtime-worker').then((mod) => {
      cachedModulePaths = mod;
      return mod;
    });
  }
  return modulePathsPromise;
};

async function loadPluginWorkers(): Promise<void> {
  if (!isBrowserEnvironment) {
    return;
  }

  const modulePaths = await loadModulePaths();

  const loadTasks = PLUGINS_TO_PRELOAD.map(async (pluginId) => {
    try {
      const mod = await modulePaths.importPluginWorker(pluginId);
      const loaderExports = PLUGIN_LOADER_EXPORTS[pluginId] ?? [];
      const storeRegistry = modulePaths.storeRegistry ?? null;
      const loaderOptions = storeRegistry ? { storeRegistry } : undefined;
      for (const exportName of loaderExports) {
        const loader = (mod as Record<string, unknown>)[exportName];
        if (typeof loader === 'function') {
          try {
            await Promise.resolve((loader as (options?: unknown) => unknown)(loaderOptions));
          } catch (error) {
            console.warn(`[WorkerModuleLoader] ${exportName}() failed for ${pluginId}`, error);
          }
        }
      }
    } catch (error) {
      console.warn(`[WorkerModuleLoader] failed to preload plugin worker: ${pluginId}`, error);
    }
  });

  await Promise.allSettled(loadTasks);
}

export async function ensureWorkerRuntime(): Promise<Remote<WorkerAPI>> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const [{ WorkerAPIClient }, modulePaths] = await Promise.all([
        loadWorkerAPIClientModule(),
        loadModulePaths().catch((error) => {
          console.warn('[WorkerModuleLoader] failed to load module paths module', error);
          throw error;
        }),
      ]);
      const client = await WorkerAPIClient.getOrInit();
      if (!pluginLoadPromise) {
        pluginLoadPromise = loadPluginWorkers().catch((error) => {
          console.warn('[WorkerModuleLoader] plugin preload encountered errors', error);
        });
      }

      // ensure module paths cache populated for subsequent synchronous access
      if (!getModulePaths()) {
        cachedModulePaths = modulePaths;
      }
      await pluginLoadPromise.catch(() => {
        // individual plugin errors are logged above; swallow to avoid failing initialization
      });
      return client;
    })();
  }

  return runtimePromise;
}

export function getWorkerRuntimePromise(): Promise<Remote<WorkerAPI>> | null {
  return runtimePromise;
}
