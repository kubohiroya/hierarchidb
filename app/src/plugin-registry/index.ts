import {
  pluginRegistry as canonicalRegistry,
  pluginDatabaseLoaders,
  pluginWorkerPreloads,
  pluginIconLoaders as registryIconLoaders,
} from '@hierarchidb/plugin-registry';
import {
  derivePluginDefinitions,
  derivePluginModuleSources,
  derivePluginModuleSpecifiers,
} from '@hierarchidb/plugin-registry/derivations';
import type {
  PluginDefinition,
  PluginRegistryEntry,
} from '@hierarchidb/plugin-registry/types';

export const pluginRegistry: PluginRegistryEntry[] = canonicalRegistry;

export const pluginDefinitions: PluginDefinition[] = derivePluginDefinitions(pluginRegistry);

export const pluginUiModuleMap: Record<string, string> = derivePluginModuleSpecifiers(
  pluginRegistry,
  'ui'
);

export const pluginUiModuleSources: Record<string, string | undefined> = derivePluginModuleSources(
  pluginRegistry,
  'ui'
);

const uiSourceGlob = import.meta.glob('../../../plugins/*-plugin/src/**/index.{ts,tsx}');

function resolveUiLoader(nodeType: string, sourcePath: string | undefined) {
  if (!sourcePath) return undefined;
  const relativeKey = `../../../${sourcePath}`;
  const loader = uiSourceGlob[relativeKey];
  if (!loader) {
    throw new Error(`[plugin-ui-loader] UI source not found for ${nodeType}: ${sourcePath}`);
  }
  return loader;
}

export const pluginUiLoaders: Record<string, () => Promise<unknown>> = Object.fromEntries(
  Object.entries(pluginUiModuleSources)
    .map(([nodeType, sourcePath]) => {
      const loader = resolveUiLoader(nodeType, sourcePath);
      return loader ? ([nodeType, loader] as const) : null;
    })
    .filter((entry): entry is readonly [string, () => Promise<unknown>] => entry !== null)
);

const iconModuleGlob = import.meta.glob('../../../plugins/*-plugin/src/icon/index.{ts,tsx}');

function resolveIconLoader(nodeType: string): (() => Promise<unknown>) | undefined {
  const entry = pluginRegistry.find((item) => item.nodeType === nodeType);
  const sourcePath = entry?.modules.icon?.source;
  const exportName = entry?.modules.icon?.exportName;
  if (!sourcePath) return registryIconLoaders[nodeType];

  const relativeKey = `../../../${sourcePath}`;
  const loader = iconModuleGlob[relativeKey];
  if (!loader) {
    return registryIconLoaders[nodeType];
  }

  return async () => {
    const mod = await loader();
    if (exportName) {
      const component = (mod as Record<string, unknown>)[exportName];
      if (!component) {
        throw new Error(`Plugin icon export "${exportName}" not found for ${nodeType}`);
      }
      return component;
    }
    const resolved = (mod as { default?: unknown }).default ?? mod;
    if (!resolved) {
      throw new Error(`Plugin icon default export not found for ${nodeType}`);
    }
    return resolved;
  };
}

export const pluginIconLoaders: Record<string, () => Promise<unknown>> = Object.fromEntries(
  pluginRegistry
    .map((entry) => {
      const loader = resolveIconLoader(entry.nodeType);
      return loader ? ([entry.nodeType, loader] as const) : null;
    })
    .filter((entry): entry is readonly [string, () => Promise<unknown>] => entry !== null)
);

export const pluginWorkerModuleMap: Record<string, string> = derivePluginModuleSpecifiers(
  pluginRegistry,
  'worker'
);

export const pluginWorkerModuleSources: Record<string, string | undefined> =
  derivePluginModuleSources(pluginRegistry, 'worker');

const workerModuleGlob = import.meta.glob('../../../plugins/*-plugin/src/**/index.{ts,tsx}');

function resolveWorkerLoader(sourcePath: string | undefined):
  | (() => Promise<unknown>)
  | undefined {
  if (!sourcePath) return undefined;
  const relativeKey = `../../../${sourcePath}`;
  return workerModuleGlob[relativeKey];
}

export const pluginWorkerLoaders: Record<string, () => Promise<unknown>> = Object.fromEntries(
  Object.entries(pluginWorkerModuleSources)
    .map(([nodeType, sourcePath]) => {
      const loader = resolveWorkerLoader(sourcePath);
      return loader ? ([nodeType, loader] as const) : null;
    })
    .filter((entry): entry is readonly [string, () => Promise<unknown>] => entry !== null)
);

export const pluginDatabaseModuleMap: Record<string, string> = derivePluginModuleSpecifiers(
  pluginRegistry,
  'database'
);

export { pluginWorkerPreloads, pluginDatabaseLoaders };
