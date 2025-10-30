import {
  pluginRegistry as canonicalRegistry,
  pluginIconLoaders as registryIconLoaders,
  pluginWorkerPreloads,
  pluginDatabaseLoaders,
} from '@hierarchidb/feature-core/plugin-registry';
import {
  derivePluginDefinitions,
  derivePluginModuleSources,
  derivePluginModuleSpecifiers,
} from '@hierarchidb/feature-core/plugin-registry/derivations';
import type { PluginDefinition, PluginRegistryEntry } from '@hierarchidb/feature-core/plugin-registry/types';

export const pluginRegistry: PluginRegistryEntry[] = canonicalRegistry;

export const pluginDefinitions: PluginDefinition[] = derivePluginDefinitions(pluginRegistry);

export const pluginUiModuleMap: Record<string, string> = derivePluginModuleSpecifiers(
  pluginRegistry,
  'ui',
);

export const pluginUiModuleSources: Record<string, string | undefined> =
  derivePluginModuleSources(pluginRegistry, 'ui');

const uiModuleGlob = import.meta.glob(
  '../../../plugins/*-plugin/src/**/index.{ts,tsx}',
);

function resolveUiLoader(sourcePath: string | undefined): (() => Promise<unknown>) | undefined {
  if (!sourcePath) return undefined;
  const relativeKey = `../../../${sourcePath}`;
  return uiModuleGlob[relativeKey];
}

export const pluginUiLoaders: Record<string, () => Promise<unknown>> = Object.fromEntries(
  Object.entries(pluginUiModuleSources)
    .map(([nodeType, sourcePath]) => {
      const loader = resolveUiLoader(sourcePath);
      return loader ? ([nodeType, loader] as const) : null;
    })
    .filter((entry): entry is readonly [string, () => Promise<unknown>] => entry !== null),
);

const iconModuleGlob = import.meta.glob(
  '../../../plugins/*-plugin/src/icon/index.{ts,tsx}',
);

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
    .filter((entry): entry is readonly [string, () => Promise<unknown>] => entry !== null),
);

export const pluginWorkerModuleMap: Record<string, string> = derivePluginModuleSpecifiers(
  pluginRegistry,
  'worker',
);

export const pluginDatabaseModuleMap: Record<string, string> = derivePluginModuleSpecifiers(
  pluginRegistry,
  'database',
);

export { pluginWorkerPreloads, pluginDatabaseLoaders };
