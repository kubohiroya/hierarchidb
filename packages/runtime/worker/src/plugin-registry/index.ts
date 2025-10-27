import { pluginRegistry as canonicalRegistry } from '@hierarchidb/plugin-registry';
import {
  derivePluginModuleSources,
  derivePluginModuleSpecifiers,
} from '@hierarchidb/plugin-registry/derivations';
import type { PluginRegistryEntry } from '@hierarchidb/plugin-registry/types.ts';

export const pluginRegistry: PluginRegistryEntry[] = canonicalRegistry;

export const pluginWorkerModuleMap: Record<string, string> = derivePluginModuleSpecifiers(
  pluginRegistry,
  'worker',
);

export const pluginWorkerSourceMap: Record<string, string | undefined> =
  derivePluginModuleSources(pluginRegistry, 'worker');

export const pluginUiModuleMap: Record<string, string> = derivePluginModuleSpecifiers(
  pluginRegistry,
  'ui',
);
