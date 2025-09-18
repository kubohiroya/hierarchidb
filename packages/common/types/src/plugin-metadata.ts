import type { NodeType } from './id-types.js';

/**
 * Lightweight, publish-stable metadata that plugins may expose for discovery.
 * Keep this independent from runtime handler wiring so UI/registry can read it
 * without importing heavy worker-side code.
 */
export interface PluginMetadata {
  /** Unique plugin ID (reverse‑DNS or npm style is fine) */
  id: string;
  /** Human‑readable name */
  name: string;
  /** Node type this plugin registers */
  nodeType: NodeType;
  /** Semver string */
  version: string;

  /** Optional fields used by catalogs/registries */
  description?: string;
  author?: string;
  status?: 'active' | 'inactive' | 'error';
  tags?: string[];
  /** Declared plugin dependencies (by plugin id) */
  dependencies?: string[];

  /**
   * Hints for entity cross‑references. For example, a field name that stores
   * a relational reference so generic UIs can infer relationships.
   */
  entityHints?: {
    /** Field name that points to a related entity (e.g., spreadsheetMetadataId) */
    relRefField?: string;
  };
}

