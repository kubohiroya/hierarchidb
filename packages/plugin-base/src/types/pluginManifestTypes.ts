import type { NodeType } from '@hierarchidb/core-types';
import type { PluginManifestDatabasePrewarmConfig } from './pluginMetadataTypes.js';

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
  supportsBuildProcessing?: boolean;
  draft?: boolean;
  build?: boolean;
  visualization?: boolean;
  [key: string]: boolean | undefined;
}

export interface PluginManifestDatabaseConfig {
  dbName?: string;
  tableName?: string;
  version?: number;
  schema?: Record<string, unknown>;
  prewarm?: PluginManifestDatabasePrewarmConfig;
}

export interface PluginManifest {
  id?: string;
  name?: string;
  displayName?: string;
  i18nNamespace?: string;
  stepTitleKeys?: Record<string, string>;
  nodeType?: NodeType;
  version?: string;
  description?: string;
  author?: string;
  status?: string;
  priority?: number;
  extends?: string;
  dependencies?: string[];
  icon?: PluginIconConfig;
  category?: PluginCategoryConfig;
  tags?: string[];
  entityHints?: Record<string, unknown>;
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
  database?: PluginManifestDatabaseConfig | null;
}
