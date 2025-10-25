/**
 * App-local module identifiers and helpers for runtime/workers.
 *
 * This file supersedes the former @hierarchidb/runtime-shared-module-paths package
 * for the application bundle. It resolves plugin workers via the static
 * registry emitted by scripts/generate-plugin-loader.mjs.
 */

import { pluginMapWorker } from './generated/plugin-metadata.js';

export const RUNTIME_MODULE_IDS = {
  runtimeWorker: '@hierarchidb/runtime-worker',
  runtimeWorkerBootstrap: '@hierarchidb/runtime-client',
} as const;

export const OPTIONAL_FEATURE_MODULE_IDS = {
  mapAdapter: '@hierarchidb/map-adapter',
  tabularXlsx: '@hierarchidb/tabular-source-xlsx',
} as const;

// Expose discovered plugin IDs as a map for backward compatibility.
// Keys are nodeType (e.g., 'basemap', 'folder', ...), and values echo the key.

export const PLUGIN_WORKER_MODULE_IDS = Object.freeze(
  Object.fromEntries(Object.keys(pluginMapWorker).map((k) => [k, k])) as Record<string, string>
);

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PluginWorkerModule = Record<string, any> | any;

/*
const runtimeWorkerImporter = () =>
  import('@hierarchidb/runtime-worker') as Promise<RuntimeWorkerModule>;
const runtimeWorkerBootstrapImporter = () =>
  import('@hierarchidb/runtime-client') as Promise<Record<string, unknown>>;
 */

const optionalFeatureImporters: Record<OptionalFeatureId, () => Promise<OptionalFeatureModule>> = {
  mapAdapter: () => import('@hierarchidb/map-adapter') as Promise<OptionalFeatureModule>,
  tabularXlsx: () => import('@hierarchidb/tabular-source-xlsx') as Promise<OptionalFeatureModule>,
};

/**
 * Dynamically import the runtime worker bootstrap utilities.
export function importRuntimeWorkerBootstrap() {
  return runtimeWorkerBootstrapImporter();
}
 */

/**
 * Dynamically import an optional feature module (e.g. map adapter).
 */
export function importOptionalFeature<T extends OptionalFeatureId>(feature: T) {
  return optionalFeatureImporters[feature]() as Promise<OptionalFeatureModule>;
}

/**
 * Resolve the module id for a plugin worker bundle.
 * In the registry-driven world, the logical module id is the plugin id itself.
 */
export function getPluginWorkerModuleId(id: PluginWorkerId): string {
  return id as string;
}

/**
 * Dynamically import a plugin worker bundle using the virtual plugin registry.
 */

export function importPluginWorker<T extends PluginWorkerId>(id: T) {
  const loader = (pluginMapWorker as Record<string, () => Promise<unknown>>)[id as string];
  if (!loader) {
    return Promise.reject(new Error(`[module-paths] Unknown plugin worker id: ${String(id)}`));
  }
  return loader() as Promise<PluginWorkerModule>;
}
