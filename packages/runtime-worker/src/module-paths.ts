/**
 * App-local module identifiers and helpers for runtime-worker/workers.
 *
 * This file supersedes the former @hierarchidb/runtime-worker-shared-module-paths package
 * for the application bundle. It resolves plugin workers via the static
 * registry emitted by scripts/generate-plugin-loader.mjs.
 */

import { getWorkerContainer } from './di/container.js';
import type { PluginWorkerModuleLoader } from './di/interfaces.js';
import { WorkerDiTokens } from './di/tokens.js';
import { pluginWorkerModuleMap } from './plugin-registry/index.js';

export const RUNTIME_MODULE_IDS = {
  runtimeWorker: '@hierarchidb/runtime-worker-worker',
  runtimeWorkerBootstrap: '@hierarchidb/ui-worker-client',
} as const;

export const OPTIONAL_FEATURE_MODULE_IDS = {
  mapAdapter: '@hierarchidb/map-adapter',
  tabularXlsx: '@hierarchidb/tabular-source-xlsx',
} as const;

// Expose discovered plugin IDs as a map for backward compatibility.
// Keys are nodeType (e.g., 'basemap', 'folder', ...), and values echo the key.

export const PLUGIN_WORKER_MODULE_IDS = Object.freeze(
  Object.fromEntries(Object.keys(pluginWorkerModuleMap).map((k) => [k, k])) as Record<
    string,
    string
  >
);

export type OptionalFeatureId = keyof typeof OPTIONAL_FEATURE_MODULE_IDS;
export type PluginWorkerId = keyof typeof PLUGIN_WORKER_MODULE_IDS;

export type StoreRegistry = {
  getGroup<T = unknown>(nodeType: string): T | undefined;
  registerGroup<T = unknown>(nodeType: string, store: T): void;
  getRelations<T = unknown>(nodeType: string): T | undefined;
  registerRelations<T = unknown>(nodeType: string, store: T): void;
};

type OptionalFeatureModule = Record<string, unknown> | unknown;
export type PluginWorkerModule = Record<string, unknown>;

/*
const runtimeWorkerImporter = () =>
  import('@hierarchidb/runtime-worker-worker') as Promise<RuntimeWorkerModule>;
const runtimeWorkerBootstrapImporter = () =>
  import('@hierarchidb/ui-worker-client') as Promise<Record<string, unknown>>;
 */

const optionalFeatureImporters: Record<OptionalFeatureId, () => Promise<OptionalFeatureModule>> = {
  mapAdapter: () => import('@hierarchidb/map-adapter') as Promise<OptionalFeatureModule>,
  tabularXlsx: () => import('@hierarchidb/tabular-source-xlsx') as Promise<OptionalFeatureModule>,
};

/**
 * Dynamically import the runtime-worker worker bootstrap utilities.
export function importRuntimeWorkerBootstrap() {
  return runtimeWorkerBootstrapImporter();
}
 */

/**
 * Dynamically import an optional features module (e.g. map adapter).
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
  const container = getWorkerContainer();
  const loader = container.get<PluginWorkerModuleLoader>(WorkerDiTokens.PluginWorkerModuleLoader);
  return loader.importModule<PluginWorkerModule>(id as string);
}
