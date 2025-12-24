import { pluginRegistry as canonicalRegistry } from '../../../plugin-registry/generated/registry.js';
import { pluginWorkerLoaders as staticWorkerLoaders } from '../../../plugin-registry/generated/worker-loaders.js';
import {
  derivePluginModuleSources,
  derivePluginModuleSpecifiers,
} from '../../../plugin-registry/src/derivations.js';
import type { PluginRegistryEntry } from '../../../plugin-registry/src/types.js';

export const pluginRegistry: PluginRegistryEntry[] = canonicalRegistry;

export const pluginWorkerModuleMap: Record<string, string> = derivePluginModuleSpecifiers(
  pluginRegistry,
  'worker'
);

export const pluginWorkerSourceMap: Record<string, string | undefined> = derivePluginModuleSources(
  pluginRegistry,
  'worker'
);

export const pluginWorkerLoaders: Record<string, () => Promise<unknown>> = staticWorkerLoaders;
