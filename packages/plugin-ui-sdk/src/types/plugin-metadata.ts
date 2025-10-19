import type { ValidationRule, NodeType } from '@hierarchidb/common-types';

export interface PluginManifestDatabaseField {
  name: string;
  indexed?: boolean;
}

export interface PluginManifestDatabaseSchema {
  fields?: ReadonlyArray<PluginManifestDatabaseField>;
}

export interface PluginManifestDatabaseConfig {
  dbName?: string;
  tableName?: string;
  version?: number;
  schema?: PluginManifestDatabaseSchema;
}

export interface PluginManifestUIConfig {
  dialogComponentPath?: string;
  panelComponentPath?: string;
  formComponentPath?: string;
  iconComponentPath?: string;
}

export interface PluginManifestAPIConfig {
  workerExtensions?: Record<string, (...args: unknown[]) => Promise<unknown>>;
  clientExtensions?: Record<string, (...args: unknown[]) => Promise<unknown>>;
}

export interface PluginManifestValidationConfig {
  namePattern?: string | RegExp;
  maxChildren?: number;
  allowedChildTypes?: ReadonlyArray<NodeType>;
  customValidators?: ReadonlyArray<ValidationRule<any>>;
}

/**
 * Lightweight, publish-stable metadata that plugin-loader may expose for discovery.
 * Keep this independent from runtime handler wiring so UI/registry can read it
 * without importing heavy worker-side code.
 */
export interface PluginMetadata {
  /** Unique plugin ID (reverse‑DNS or npm style is fine) */
  id: string;
  /** Human‑readable package name */
  name: string;
  /** Display label shown in UI */
  displayName?: string;
  /** Node type this plugin registers */
  nodeType: NodeType;
  /** Semver string */
  version: string;

  /** Optional descriptive fields */
  description?: string;
  author?: string;
  status?: 'active' | 'inactive' | 'error';
  tags?: string[];

  /** Plugin inheritance / dependency graph */
  extends?: string;
  /** Declared plugin dependencies (by nodeType or plugin id) */
  dependencies?: string[];
  /** Sorting hint (lower = loaded first) */
  priority?: number;

  /** Icon hints consumed by UI */
  icon?: {
    muiIconName?: string;
    mui?: string;
    emoji?: string;
    color?: string;
    svg?: string;
    description?: string;
  };

  /** Category hint used by menus/catalogs */
  category?: unknown;

  /** Capability flags surfaced in UI */
  capabilities?: unknown;

  /** Schema metadata (kept loose to avoid coupling) */
  schema?: unknown;

  /** Database configuration hints */
  database?: PluginManifestDatabaseConfig;

  /** UI configuration hints */
  ui?: PluginManifestUIConfig;

  /** API extension hints */
  api?: PluginManifestAPIConfig;

  /** Validation hints */
  validation?: PluginManifestValidationConfig;

  /** Arbitrary additional metadata */
  extra?: Record<string, unknown>;

  /**
   * Hints for entity cross‑references. For example, a field name that stores
   * a relational reference so generic UIs can infer relationships.
   */
  entityHints?: {
    /** Field name that points to a related entity (e.g., spreadsheetMetadataId) */
    relRefField?: string;
  };
}
