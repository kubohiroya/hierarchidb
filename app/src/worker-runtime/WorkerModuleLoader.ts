import type { WorkerAPI } from '@hierarchidb/common-api';
import type { PluginWorkerId } from '@hierarchidb/runtime-worker';
import type { Remote } from 'comlink';
import { pluginRegistry, pluginWorkerPreloads } from '~/plugin-registry/index.ts';
import { loadWorkerAPIClientModule } from './workerApiClientLoader.js';

// NOTE: Worker runtime-worker and plugin worker modules are no longer imported through
// legacy `*/worker` subpath specifiers.  Instead we delegate to the
// `@hierarchidb/runtime-worker-worker` module-path helpers so that both the runtime-worker
// bundle and each plugin worker can be resolved via a single, versioned entry
// point.  This loader keeps the cache warm and preloads the optional peer store
// registration helpers for the plugin-loader that still expose Dexie-backed stores.

type ModulePathsModule = typeof import('@hierarchidb/runtime-worker');

const pluginWorkerPreloadMap = pluginWorkerPreloads as Record<string, string[]>;
const PLUGINS_TO_PRELOAD = Object.keys(pluginWorkerPreloadMap) as PluginWorkerId[];

const hasWorkerExport = (nodeType: string): boolean => {
  const entry = pluginRegistry.find((item) => item.nodeType === nodeType);
  const exportsList = Array.isArray(entry?.exports)
    ? entry.exports.map((value) => value.replace(/^\.?\//, ''))
    : [];
  if (exportsList.length > 0) {
    return exportsList.some((value) => value === 'worker' || value.startsWith('worker/'));
  }
  return Boolean(entry?.modules?.worker);
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

  // Run preload hooks sequentially to avoid concurrent storeRegistry mutations across plugins.
  for (const pluginId of PLUGINS_TO_PRELOAD) {
    if (!hasWorkerExport(pluginId)) {
      continue;
    }
    const preloadExports = pluginWorkerPreloadMap[pluginId] ?? [];
    try {
      const mod = await modulePaths.importPluginWorker(pluginId);
      if (preloadExports.length === 0) {
        continue;
      }
      const storeRegistry = modulePaths.storeRegistry ?? null;
      const loaderOptions = storeRegistry ? { storeRegistry } : undefined;
      for (const exportName of preloadExports) {
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
  }
}

function startPluginWorkerPreloads(): Promise<void> {
  if (!pluginLoadPromise) {
    pluginLoadPromise = loadPluginWorkers().catch((error) => {
      console.warn('[WorkerModuleLoader] plugin preload encountered errors', error);
      throw error;
    });
  }
  return pluginLoadPromise;
}

export async function preloadPluginWorkerStores(): Promise<void> {
  try {
    await startPluginWorkerPreloads();
  } catch {
    // individual plugin errors already logged in startPluginWorkerPreloads
  }
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
      startPluginWorkerPreloads();

      // ensure module paths cache populated for subsequent synchronous access
      if (!getModulePaths()) {
        cachedModulePaths = modulePaths;
      }
      const preloadPromise = pluginLoadPromise;
      if (preloadPromise) {
        await preloadPromise.catch(() => {
          // individual plugin errors are logged above; swallow to avoid failing initialization
        });
      }
      return client;
    })();
  }

  return runtimePromise;
}

export function resetWorkerRuntime(): void {
  runtimePromise = null;
}
