declare module '@hierarchidb/plugin-registry' {
  import type { PluginRegistryEntry } from '@hierarchidb/plugin-registry/types';

  export interface PluginDatabasePrewarmDescriptor {
    specifier?: string;
    exportName: string;
    load: () => Promise<unknown>;
  }

  export interface PluginDatabaseLoaderEntry {
    moduleSpecifier?: string;
    loader?: () => Promise<unknown>;
    prewarm?: PluginDatabasePrewarmDescriptor[];
  }

  export const pluginRegistry: PluginRegistryEntry[];
  export const pluginIconLoaders: Record<string, () => Promise<unknown>>;
  export const pluginWorkerPreloads: Record<string, string[]>;
  export const pluginDatabaseLoaders: Record<string, PluginDatabaseLoaderEntry>;

  export type {
    PluginDefinition,
    PluginManifest,
    PluginModuleInfo,
    PluginModuleSet,
    PluginCapabilities,
    PluginCategoryConfig,
    PluginIconConfig,
    PluginIconComponentConfig,
    PluginManifestField,
    PluginManifestSchema,
    PluginDatabasePrewarmConfig,
    PluginDatabasePrewarmEntry,
  } from '@hierarchidb/plugin-registry/types';
}
