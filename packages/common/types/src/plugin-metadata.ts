import type { NodeType } from './id-types.js';

/**
 * Lightweight, publish-stable metadata that plugins may expose for discovery.
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
  database?: unknown;

  /** UI configuration hints */
  ui?: unknown;

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
