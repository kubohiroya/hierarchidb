/// <reference path="./external-modules.d.ts" />

/**
 * Centralized module identifiers and helpers for runtime/workers.
 *
 * Keeping these values in one place reduces the risk of typos or
 * out-of-sync string literals when refactoring package names.
 */

export const RUNTIME_MODULE_IDS = {
  runtimeWorker: '@hierarchidb/runtime-worker',
  runtimeWorkerBootstrap: '@hierarchidb/runtime-worker-bootstrap',
} as const;

export const OPTIONAL_FEATURE_MODULE_IDS = {
  mapAdapter: '@hierarchidb/map-adapter',
  tabularXlsx: '@hierarchidb/tabular-xlsx',
} as const;

export const PLUGIN_WORKER_MODULE_IDS = {
  basemap: '@hierarchidb/plugins-basemap-plugin/worker-factory',
  folder: '@hierarchidb/plugins-folder-plugin/worker-factory',
  resolver: '@hierarchidb/plugins-resolver-plugin/worker-factory',
  route: '@hierarchidb/plugins-route-plugin/worker-factory',
  spreadsheet: '@hierarchidb/plugins-spreadsheet-plugin/worker-factory',
  styler: '@hierarchidb/plugins-styler-plugin/worker-factory',
  shape: '@hierarchidb/plugins-shape-plugin/worker-factory',
  location: '@hierarchidb/plugins-location-plugin/worker-factory',
  linker: '@hierarchidb/plugins-linker-plugin/worker-factory',
  timeline: '@hierarchidb/plugins-timeline-plugin/worker-factory',
} as const;

export type OptionalFeatureId = keyof typeof OPTIONAL_FEATURE_MODULE_IDS;
export type PluginWorkerId = keyof typeof PLUGIN_WORKER_MODULE_IDS;

export type StoreRegistry = {
  getPeer<T = unknown>(nodeType: string): T | undefined;
  registerPeer<T = unknown>(nodeType: string, store: T): void;
};

type RuntimeWorkerModule = {
  storeRegistry?: StoreRegistry;
  [key: string]: unknown;
};

type OptionalFeatureModule = Record<string, unknown> | unknown;
type PluginWorkerModule = Record<string, unknown> | unknown;

const runtimeWorkerImporter = () =>
  import(
    /* @vite-ignore */ '@hierarchidb/runtime-worker'
  ) as Promise<RuntimeWorkerModule>;

const runtimeWorkerBootstrapImporter = () =>
  import(
    /* @vite-ignore */ '@hierarchidb/runtime-worker-bootstrap'
  ) as Promise<Record<string, unknown>>;

const optionalFeatureImporters: Record<OptionalFeatureId, () => Promise<OptionalFeatureModule>> = {
  mapAdapter: () => import(
    /* @vite-ignore */ '@hierarchidb/map-adapter'
  ) as Promise<OptionalFeatureModule>,
  tabularXlsx: () => import(
    /* @vite-ignore */ '@hierarchidb/tabular-xlsx'
  ) as Promise<OptionalFeatureModule>,
};

const pluginWorkerImporters: Record<PluginWorkerId, () => Promise<PluginWorkerModule>> = {
  basemap: () => import(
    /* @vite-ignore */ '@hierarchidb/plugins-basemap-plugin/worker-factory'
  ) as Promise<PluginWorkerModule>,
  folder: () => import(
    /* @vite-ignore */ '@hierarchidb/plugins-folder-plugin/worker-factory'
  ) as Promise<PluginWorkerModule>,
  resolver: () => import(
    /* @vite-ignore */ '@hierarchidb/plugins-resolver-plugin/worker-factory'
  ) as Promise<PluginWorkerModule>,
  route: () => import(
    /* @vite-ignore */ '@hierarchidb/plugins-route-plugin/worker-factory'
  ) as Promise<PluginWorkerModule>,
  spreadsheet: () => import(
    /* @vite-ignore */ '@hierarchidb/plugins-spreadsheet-plugin/worker-factory'
  ) as Promise<PluginWorkerModule>,
  styler: () => import(
    /* @vite-ignore */ '@hierarchidb/plugins-styler-plugin/worker-factory'
  ) as Promise<PluginWorkerModule>,
  shape: () => import(
    /* @vite-ignore */ '@hierarchidb/plugins-shape-plugin/worker-factory'
  ) as Promise<PluginWorkerModule>,
  location: () => import(
    /* @vite-ignore */ '@hierarchidb/plugins-location-plugin/worker-factory'
  ) as Promise<PluginWorkerModule>,
  linker: () => import(
    /* @vite-ignore */ '@hierarchidb/plugins-linker-plugin/worker-factory'
  ) as Promise<PluginWorkerModule>,
  timeline: () => import(
    /* @vite-ignore */ '@hierarchidb/plugins-timeline-plugin/worker-factory'
  ) as Promise<PluginWorkerModule>,
};

/**
 * Dynamically import the runtime worker bundle. Callers can then access
 * exports such as `storeRegistry`.
 */
export function importRuntimeWorker() {
  return runtimeWorkerImporter();
}

/**
 * Dynamically import the runtime worker bootstrap utilities.
 */
export function importRuntimeWorkerBootstrap() {
  return runtimeWorkerBootstrapImporter();
}

/**
 * Dynamically import an optional feature module (e.g. map adapter).
 */
export function importOptionalFeature<T extends OptionalFeatureId>(feature: T) {
  return optionalFeatureImporters[feature]() as Promise<OptionalFeatureModule>;
}

/**
 * Resolve the module id for a plugin worker bundle.
 */
export function getPluginWorkerModuleId(id: PluginWorkerId): string {
  return PLUGIN_WORKER_MODULE_IDS[id];
}

/**
 * Dynamically import a plugin worker bundle.
 */
export function importPluginWorker<T extends PluginWorkerId>(id: T) {
  return pluginWorkerImporters[id]() as Promise<PluginWorkerModule>;
}
