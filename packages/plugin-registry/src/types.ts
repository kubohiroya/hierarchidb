export interface PluginIconComponentConfig {
  specifier: string;
  exportName?: string;
}

export interface PluginIconConfig {
  muiIconName?: string;
  mui?: string;
  emoji?: string;
  color?: string;
  component?: PluginIconComponentConfig | null;
}

export type PluginCategoryConfig =
  | string
  | null
  | {
      id?: string;
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
  draft?: boolean;
  batch?: boolean;
  visualization?: boolean;
  [key: string]: boolean | undefined;
}

export interface PluginDatabasePrewarmEntry {
  export?: string;
  exportName?: string;
  specifier?: string;
  module?: string;
}

export type PluginDatabasePrewarmConfig =
  | string
  | PluginDatabasePrewarmEntry
  | Array<string | PluginDatabasePrewarmEntry>;

export interface PluginDatabaseConfig {
  dbName?: string;
  tableName?: string;
  version?: number;
  schema?: Record<string, unknown>;
  prewarm?: PluginDatabasePrewarmConfig;
}

export type PluginDefinitionDatabaseConfig = Omit<PluginDatabaseConfig, 'prewarm'>;

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
  visibility?: {
    hidden?: boolean;
    showInCreateMenu?: boolean;
    showInPluginList?: boolean;
  };
  schema?: PluginManifestSchema;
  capabilities?: PluginCapabilities;
  packageName?: string;
  worker?: {
    preload?: string[];
  } | null;
  database?: PluginDatabaseConfig | null;
}

export interface PluginModuleInfo {
  specifier: string;
  source?: string;
  exportName?: string;
}

export interface PluginModuleSet {
  root: PluginModuleInfo;
  ui?: PluginModuleInfo;
  worker?: PluginModuleInfo;
  database?: PluginModuleInfo;
  common?: PluginModuleInfo;
  icon?: PluginModuleInfo;
}

export interface PluginRegistryEntry {
  nodeType: string;
  packageName: string;
  version: string;
  dependencies: string[];
  exports?: string[];
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
  database?: PluginDefinitionDatabaseConfig;
}
