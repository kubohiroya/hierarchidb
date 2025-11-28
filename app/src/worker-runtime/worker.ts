/**
 * Worker entry point (dynamic-import, error-safe)
 * Avoid static imports so we can report precise failures to UI.
 */

import './worker-react-refresh-shim.js';
import type { PluginDefinition } from '@hierarchidb/plugin-registry/types';
import type {
  DialogStateAPI,
  ImportExportAPI,
  PluginLifecycleAPI,
  TagAPI,
  TreeMutationAPI,
  TreeQueryAPI,
  TreeSubscriptionAPI,
  WorkerAPI,
  DraftAPI,
} from '@hierarchidb/common-api';
import {
  getAllRuntimeExports,
  WorkerInitializationReporter,
  wirePluginsFromModules,
} from '@hierarchidb/ui-worker-client';
import {
  getWorkerContainer,
  configureWorkerContainer,
  type PluginWorkerModuleLoader,
  WorkerDiTokens,
} from '@hierarchidb/runtime-worker';
import {
  pluginDefinitions as staticPluginDefinitions,
  pluginWorkerLoaders,
} from '~/plugin-registry/index.ts';

/** Runtime export metadata (subset consumed during bootstrap). */
type RuntimeExportEntry = {
  lifecycle?: unknown;
  createEntityHandler?: () => Promise<unknown>;
};

type ManualPluginSelf = typeof self & {
  __HIERARCHIDB_MANUAL_PLUGIN_DEFS__?: PluginDefinition[];
};

type WorkerMessagePort = typeof self & {
  postMessage?: (msg: unknown) => void;
};

type RuntimeWorkerServices = {
  ping: WorkerAPI['ping'];
  initialize: WorkerAPI['initialize'];
  shutdown: WorkerAPI['shutdown'];
  getSystemHealth: WorkerAPI['getSystemHealth'];
  getQueryAPI: () => TreeQueryAPI;
  getMutationAPI: () => TreeMutationAPI;
  getSubscriptionAPI: () => TreeSubscriptionAPI;
  getDraftAPI: () => DraftAPI;
  getPluginLifecycleAPI: () => PluginLifecycleAPI;
  getImportExportAPI: () => ImportExportAPI;
  getTagAPI: () => TagAPI;
  getDialogStateAPI: () => DialogStateAPI;
  getCommandProcessor: () => object;
};

type RuntimeWorkerModule = {
  WorkerService: {
    getSingleton: (plugins: PluginDefinition[]) => Promise<RuntimeWorkerServices>;
  };
  entityRegistry?: {
    register: (nodeType: string, handler: unknown) => void;
  };
};

// Provide minimal Node-like globals for libraries that expect them.
const globalShim = globalThis as typeof globalThis & {
  global?: typeof globalThis;
  process?: { env: Record<string, unknown> };
};
if (typeof globalShim.global === 'undefined') {
  globalShim.global = globalShim;
}
if (!globalShim.process) {
  globalShim.process = { env: {} } as typeof globalShim.process;
}
if (!globalShim.process.env) {
  globalShim.process.env = {};
}

const reporter = new WorkerInitializationReporter(
  [
    { name: 'Load Comlink', weight: 5 },
    { name: 'Load plugin loaders', weight: 10 },
    { name: 'Load plugin-loader', weight: 35 },
    { name: 'Bootstrap services', weight: 30 },
    { name: 'Create API facade', weight: 10 },
    { name: 'Expose API', weight: 10 },
  ],
  false
);
reporter.reportStepProgress('Load Comlink', 0);

(async () => {
  try {
    reporter.reportStepProgress('Load Comlink', 10);
    const Comlink = await import('comlink');
    reporter.reportStepProgress('Load Comlink', 100);

    reporter.reportStepProgress('Load plugin loaders', 100);

    const pluginDefinitions: PluginDefinition[] = Array.isArray(staticPluginDefinitions)
      ? [...(staticPluginDefinitions as PluginDefinition[])]
      : [];

    const legacyDefs = (self as ManualPluginSelf).__HIERARCHIDB_MANUAL_PLUGIN_DEFS__;
    if (Array.isArray(legacyDefs)) {
      pluginDefinitions.push(...legacyDefs);
    }

    // Note: Legacy workerModuleLoaders are no longer generated; the DI-provided moduleLoader now resolves plugin bundles.

    const denyEnv =
      typeof import.meta.env.VITE_HDB_WORKER_PLUGIN_DENY === 'string'
        ? import.meta.env.VITE_HDB_WORKER_PLUGIN_DENY
        : '';
    const denyList = new Set(
      denyEnv
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    );

    const moduleEntries: Array<{ nodeType: string; mod: unknown }> = [];

    configureWorkerContainer((container) => {
      container.rebind(WorkerDiTokens.PluginWorkerLoaderMap).toConstantValue(pluginWorkerLoaders);
    });

    const workerContainer = getWorkerContainer();
    const moduleLoader = workerContainer.get<PluginWorkerModuleLoader>(
      WorkerDiTokens.PluginWorkerModuleLoader
    );

    for (const definition of pluginDefinitions) {
      const nodeType = definition?.nodeType;
      if (!nodeType || denyList.has(nodeType)) {
        continue;
      }
      const localLoader = pluginWorkerLoaders[nodeType];
      if (localLoader) {
        try {
          const mod = await localLoader();
          moduleEntries.push({ nodeType, mod });
          continue;
        } catch (loaderError) {
          const msg = loaderError instanceof Error ? loaderError.message : String(loaderError);
          console.warn(
            `[worker bootstrap] local loader failed for ${nodeType}, fallback to registry loader:`,
            msg
          );
        }
      }

      if (!moduleLoader.has(nodeType)) {
        continue;
      }
      try {
        const mod = await moduleLoader.importModule(nodeType);
        moduleEntries.push({ nodeType, mod });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const softFailure = /document is not defined|Grid2|does not provide an export/i.test(msg);
        const prefix = `[worker bootstrap] failed to load worker for ${nodeType}:`;
        if (import.meta.env.DEV || softFailure) {
          console.warn(prefix, msg);
        } else {
          throw error;
        }
      }
    }

    if (moduleEntries.length > 0) {
      await wirePluginsFromModules(moduleEntries);
    }

    const exportsByType = getAllRuntimeExports() as Record<string, RuntimeExportEntry>;
    const enrichedDefinitions = pluginDefinitions.map((definition) => {
      const extra = exportsByType?.[definition.nodeType];
      return extra?.lifecycle ? { ...definition, lifecycle: extra.lifecycle } : definition;
    });

    try {
      const runtimeModule = (await import(
        '@hierarchidb/runtime-worker'
      )) as unknown as RuntimeWorkerModule;
      const entityRegistry = runtimeModule.entityRegistry;
      if (entityRegistry) {
        for (const [nodeType, entry] of Object.entries(exportsByType)) {
          const factory = entry?.createEntityHandler;
          if (typeof factory === 'function') {
            try {
              const handler = await factory();
              if (handler) {
                entityRegistry.register(nodeType, handler);
              }
            } catch (error) {
              console.warn(
                '[worker bootstrap] entity handler registration failed:',
                nodeType,
                error
              );
            }
          }
        }
      }

      const { WorkerService } = runtimeModule;
      const services = await WorkerService.getSingleton(
        enrichedDefinitions.length > 0 ? enrichedDefinitions : pluginDefinitions
      );
      reporter.reportStepProgress('Bootstrap services', 100);

      const messagePort = self as WorkerMessagePort;
      messagePort.postMessage?.({ type: 'SERVICES_READY', source: 'worker', at: Date.now() });

      reporter.reportStepProgress('Create API facade', 10);

      const api = {
        ping: () => services.ping(),
        initialize: () => services.initialize(),
        shutdown: () => services.shutdown(),
        getSystemHealth: () => services.getSystemHealth(),
        getQueryAPI: () => Comlink.proxy(services.getQueryAPI()),
        getMutationAPI: () => Comlink.proxy(services.getMutationAPI()),
        getSubscriptionAPI: () => Comlink.proxy(services.getSubscriptionAPI()),
        getDraftAPI: () => Comlink.proxy(services.getDraftAPI()),
        getPluginLifecycleAPI: () => Comlink.proxy(services.getPluginLifecycleAPI()),
        getImportExportAPI: () => Comlink.proxy(services.getImportExportAPI()),
        getTagAPI: () => Comlink.proxy(services.getTagAPI()),
        getDialogStateAPI: () => Comlink.proxy(services.getDialogStateAPI()),
        getCommandProcessor: () => Comlink.proxy(services.getCommandProcessor()),
      } as const;

      reporter.reportStepProgress('Create API facade', 100);
      reporter.reportStepProgress('Expose API', 10);
      Comlink.expose(api);
      reporter.reportStepProgress('Expose API', 100);
      reporter.reportComplete();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn('[worker bootstrap] runtime-worker wiring failed:', msg);
      throw error;
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    reporter.reportError(err);
    throw err;
  }
})();
