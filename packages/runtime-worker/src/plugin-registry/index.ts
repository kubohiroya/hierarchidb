import { pluginRegistry as canonicalRegistry } from '../../../plugin-registry/generated/registry.js';
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

const workerModuleGlob = import.meta.glob('../../../../plugins/*-plugin/src/**/index.{ts,tsx}');

function resolveWorkerLoader(sourcePath: string | undefined): (() => Promise<unknown>) | undefined {
  if (!sourcePath) return undefined;
  const relativeKey = `../../../../${sourcePath}`;
  return workerModuleGlob[relativeKey];
}

export const pluginWorkerLoaders: Record<string, () => Promise<unknown>> = Object.fromEntries(
  Object.entries(pluginWorkerSourceMap)
    .map(([nodeType, sourcePath]) => {
      const loader = resolveWorkerLoader(sourcePath);
      return loader ? ([nodeType, loader] as const) : null;
    })
    .filter((entry): entry is readonly [string, () => Promise<unknown>] => entry !== null)
);

export const pluginUiModuleMap: Record<string, string> = derivePluginModuleSpecifiers(
  pluginRegistry,
  'ui'
);
