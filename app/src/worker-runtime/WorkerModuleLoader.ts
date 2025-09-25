import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { WorkerAPIClient } from '../WorkerAPIClient.js';
import { importPluginWorker, importRuntimeWorker, type PluginWorkerId } from '@hierarchidb/runtime-shared-module-paths';

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

async function loadPluginWorkers(): Promise<void> {
  if (!isBrowserEnvironment) {
    return;
  }

  const runtimeModulePromise = importRuntimeWorker().catch((error) => {
    console.warn('[WorkerModuleLoader] failed to import runtime worker module', error);
    return null;
  });

  const loadTasks = PLUGINS_TO_PRELOAD.map(async (pluginId) => {
    try {
      const mod = await importPluginWorker(pluginId);
      const loaderExports = PLUGIN_LOADER_EXPORTS[pluginId] ?? [];
      const runtimeModule = await runtimeModulePromise;
      const storeRegistry = runtimeModule?.storeRegistry;
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
      const client = await WorkerAPIClient.getOrInit();
      if (!pluginLoadPromise) {
        pluginLoadPromise = loadPluginWorkers().catch((error) => {
          console.warn('[WorkerModuleLoader] plugin preload encountered errors', error);
        });
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
