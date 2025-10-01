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

/**
 * Dynamically import the runtime worker bundle. Callers can then access
 * exports such as `storeRegistry`.
 */
export function importRuntimeWorker() {
  return import(RUNTIME_MODULE_IDS.runtimeWorker);
}

/**
 * Dynamically import an optional feature module (e.g. map adapter).
 */
export function importOptionalFeature<T extends OptionalFeatureId>(feature: T) {
  return import(OPTIONAL_FEATURE_MODULE_IDS[feature]);
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
  return import(PLUGIN_WORKER_MODULE_IDS[id]);
}
