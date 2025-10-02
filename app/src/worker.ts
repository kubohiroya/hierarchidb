/**
 * Worker entry point (dynamic-import, error-safe)
 * Avoid static imports so we can report precise failures to UI.
 */

import './worker-react-refresh-shim.js';
import { WorkerInitializationReporter, wirePluginsFromModules, getAllRuntimeExports } from '@hierarchidb/runtime-worker-bootstrap';
import type { PluginDefinition } from '@hierarchidb/common-type';
import {
  WORKER_FLAG_ALLOWED_OVERRIDES,
  WORKER_FLAG_PARAM_PREFIX,
} from './config/worker-flag-overrides.js';

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

type PluginLoaderMap = Record<string, () => Promise<unknown>>;

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

const workerEnv = globalShim.process.env;

try {
  if (typeof self !== 'undefined' && typeof self.location?.href === 'string') {
    const params = new URL(self.location.href).searchParams;
    for (const flag of WORKER_FLAG_ALLOWED_OVERRIDES) {
      const value = params.get(`${WORKER_FLAG_PARAM_PREFIX}${flag}`);
      if (value != null) {
        workerEnv[flag] = value;
      }
    }
  }
} catch (error) {
  console.warn('[worker bootstrap] failed to apply flag overrides', error);
}

const reporter = new WorkerInitializationReporter(
  [
    { name: 'Load Comlink', weight: 5 },
    { name: 'Load plugin loaders', weight: 10 },
    { name: 'Load plugins', weight: 35 },
    { name: 'Bootstrap services', weight: 30 },
    { name: 'Create API facade', weight: 10 },
    { name: 'Expose API', weight: 10 },
  ],
  false,
);
reporter.reportStepProgress('Load Comlink', 0);

(async () => {
  try {
    reporter.reportStepProgress('Load Comlink', 10);
    const Comlink = await import('comlink');
    reporter.reportStepProgress('Load Comlink', 100);

    reporter.reportStepProgress('Load plugin loaders', 100);

    let pluginDefinitions: PluginDefinition[] = [];
    if (!import.meta.env.DEV) {
      try {
        const mod = await import('virtual:plugin-definitions').catch(async () =>
          import('./virtual/plugin-definitions.js')
        );
        const defs = (mod as { default?: unknown }).default;
        pluginDefinitions = Array.isArray(defs) ? (defs as PluginDefinition[]) : [];
      } catch {
        const legacyDefs = (self as ManualPluginSelf).__HIERARCHIDB_MANUAL_PLUGIN_DEFS__;
        pluginDefinitions = Array.isArray(legacyDefs) ? legacyDefs : [];
      }
    }

    const registryModule = await import('virtual:plugin-registry-worker').catch(() => null);
    let pluginMap: PluginLoaderMap = registryModule?.pluginMapWorker ?? {};

    // Note: Legacy workerModuleLoaders are no longer generated; pluginMapWorker now provides all loaders.

    const denyEnv = typeof import.meta.env.VITE_HDB_WORKER_PLUGIN_DENY === 'string'
      ? import.meta.env.VITE_HDB_WORKER_PLUGIN_DENY
      : '';
    const denyList = new Set(
      denyEnv
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    );

    const moduleEntries: Array<{ nodeType: string; mod: unknown }> = [];
    for (const definition of pluginDefinitions) {
      const nodeType = definition?.nodeType;
      if (!nodeType || denyList.has(nodeType)) {
        continue;
      }
      const loader = pluginMap[nodeType];
      if (typeof loader !== 'function') {
        continue;
      }
      try {
        const mod = await loader();
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
      const runtime = await import('@hierarchidb/runtime-worker');
      const entityRegistry = (runtime as { entityRegistry?: { register: (nodeType: string, handler: unknown) => void } }).entityRegistry;
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
              console.warn('[worker bootstrap] entity handler registration failed:', nodeType, error);
            }
          }
        }
      }

      const { WorkerService } = runtime;
      const services = await WorkerService.getSingleton(
        enrichedDefinitions.length > 0 ? enrichedDefinitions : pluginDefinitions,
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
        getWorkingCopyAPI: () => Comlink.proxy(services.getWorkingCopyAPI()),
        getPluginLifecycleAPI: () => Comlink.proxy(services.getPluginLifecycleAPI()),
        getImportExportAPI: () => Comlink.proxy(services.getImportExportAPI()),
        getTagAPI: () => Comlink.proxy(services.getTagAPI()),
        getDialogStateAPI: () => Comlink.proxy(services.getDialogStateAPI()),
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
    reporter.reportError(err.message, err);
    throw err;
  }
})();
