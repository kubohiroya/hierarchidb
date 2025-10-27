import { pluginRegistry as canonicalRegistry } from '@hierarchidb/plugin-registry';
import { derivePluginDefinitions, derivePluginModuleSpecifiers } from '@hierarchidb/plugin-registry/derivations';
import type { PluginDefinition, PluginRegistryEntry } from '@hierarchidb/plugin-registry/types.ts';

export const pluginRegistry: PluginRegistryEntry[] = canonicalRegistry;

export const pluginDefinitions: PluginDefinition[] = derivePluginDefinitions(pluginRegistry);

export const pluginUiModuleMap: Record<string, string> = derivePluginModuleSpecifiers(
  pluginRegistry,
  'ui',
);

export const pluginUiLoaders: Record<string, () => Promise<unknown>> = Object.fromEntries(
  Object.entries(pluginUiModuleMap).map(([nodeType, specifier]) => [
    nodeType,
    () => import(specifier),
  ]),
);

export const pluginWorkerModuleMap: Record<string, string> = derivePluginModuleSpecifiers(
  pluginRegistry,
  'worker',
);
