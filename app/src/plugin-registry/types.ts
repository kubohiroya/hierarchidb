export interface PluginIconConfig {
  muiIconName?: string;
  mui?: string;
  emoji?: string;
  color?: string;
}

export type PluginCategoryConfig =
  | string
  | null
  | {
      menuGroup?: string;
      createOrder?: number;
      treeId?: string;
    };

export interface PluginManifestField {
  name: string;
  type: string;
  required?: boolean;
}

export interface PluginManifestSchema {
  inherits?: string;
  fields?: PluginManifestField[];
}

export interface PluginCapabilities {
  canHaveChildren?: boolean;
  canBeRoot?: boolean;
  canBeDeleted?: boolean;
  canBeRenamed?: boolean;
  canBeMoved?: boolean;
  canBeCopied?: boolean;
  supportsBatchProcessing?: boolean;
  workingCopy?: boolean;
  batch?: boolean;
  visualization?: boolean;
  [key: string]: boolean | undefined;
}

export interface PluginManifest {
  id?: string;
  name?: string;
  displayName?: string;
  nodeType?: string;
  version?: string;
  description?: string;
  priority?: number;
  extends?: string;
  dependencies?: string[];
  icon?: PluginIconConfig;
  category?: PluginCategoryConfig;
  schema?: PluginManifestSchema;
  capabilities?: PluginCapabilities;
}

export interface PluginDefinition {
  nodeType: string;
  name: string;
  packageName: string;
  version: string;
  displayName: string;
  priority: number;
  dependencies: string[];
}

export interface PluginRegistryEntry {
  nodeType: string;
  packageName: string;
  version: string;
  hasUI: boolean;
  hasWorker: boolean;
  hasDatabase: boolean;
  hasCommon: boolean;
  dependencies: string[];
  manifest: PluginManifest | null;
}

export type PluginModuleSpecifierMap = Record<string, string>;
export type PluginLoaderFactoryMap = Record<string, () => Promise<unknown>>;

export interface PluginRegistrySnapshot {
  pluginDefinitions: PluginDefinition[];
  pluginRegistry: PluginRegistryEntry[];
  pluginUiModuleMap: PluginModuleSpecifierMap;
  pluginUiLoaders: PluginLoaderFactoryMap;
  pluginWorkerModuleMap: PluginModuleSpecifierMap;
}
