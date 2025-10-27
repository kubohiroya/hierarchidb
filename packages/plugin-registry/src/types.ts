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
  packageName?: string;
}

export interface PluginModuleInfo {
  specifier: string;
  source?: string;
}

export interface PluginModuleSet {
  root: PluginModuleInfo;
  ui?: PluginModuleInfo;
  worker?: PluginModuleInfo;
  database?: PluginModuleInfo;
  common?: PluginModuleInfo;
}

export interface PluginRegistryEntry {
  nodeType: string;
  packageName: string;
  version: string;
  dependencies: string[];
  manifest: PluginManifest | null;
  modules: PluginModuleSet;
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
