declare module '@hierarchidb/plugin-registry' {
  import type { PluginRegistryEntry } from '@hierarchidb/plugin-registry/types';

  export const pluginRegistry: PluginRegistryEntry[];

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

declare module '@hierarchidb/plugin-registry/ui-loaders' {
  export const pluginUiLoaders: Record<string, () => Promise<unknown>>;
  export const pluginUiModuleMap: Record<string, string>;
}

declare module '@hierarchidb/plugin-registry/worker-loaders' {
  export const pluginWorkerLoaders: Record<string, () => Promise<unknown>>;
  export const pluginWorkerPreloads: Record<string, string[]>;
}

declare module '@hierarchidb/plugin-registry/icon-loaders' {
  export const pluginIconLoaders: Record<string, () => Promise<unknown>>;
}

declare module '@hierarchidb/plugin-registry/database-loaders' {
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

  export const pluginDatabaseLoaders: Record<string, PluginDatabaseLoaderEntry>;
}

declare module '@hierarchidb/plugin-registry/plugin-definitions' {
  import type { PluginDefinition } from '@hierarchidb/plugin-registry/types';

  export const pluginDefinitions: PluginDefinition[];
}
