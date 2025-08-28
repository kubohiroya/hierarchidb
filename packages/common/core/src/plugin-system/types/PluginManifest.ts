import type { NodeType } from '../../types';

/**
 * Unified plugin manifest definition
 * Consolidates different plugin manifest formats into a single interface
 */
export interface PluginManifest {
  /** Plugin identifier (node type) */
  nodeType: NodeType;
  
  /** Human-readable plugin name */
  name: string;
  
  /** Plugin version */
  version: string;
  
  /** Plugin description */
  description?: string;
  
  /** Plugin author */
  author?: string;
  
  /** Loading priority (lower number = higher priority) */
  priority?: number;
  
  /** Plugin category for grouping */
  category?: string;
  
  /** Parent plugin this extends (inheritance) */
  extends?: NodeType;
  
  /** Required dependencies */
  dependencies?: NodeType[];
  
  /** Optional dependencies (loaded if available) */
  optionalDependencies?: NodeType[];
  
  /** Peer dependencies (must be present at runtime) */
  peerDependencies?: NodeType[];
  
  /** Plugin exports configuration */
  exports?: {
    /** Main plugin definition export */
    definition: string;
    /** Entity handler export */
    handler?: string;
    /** Extension capabilities export */
    extension?: string;
    /** Service exports */
    services?: string[];
    /** UI component exports */
    components?: string[];
  };
  
  /** Plugin capabilities and features */
  capabilities?: Record<string, any>;
  
  /** Schema definition for extending functionality */
  schema?: {
    /** Schema this inherits from */
    inherits?: NodeType;
    /** Additional fields defined by this plugin */
    fields?: Array<{
      name: string;
      type: string;
      required: boolean;
      description?: string;
    }>;
  };
  
  /** Additional metadata */
  metadata?: {
    /** Tags for categorization */
    tags?: string[];
    /** Minimum framework version required */
    minVersion?: string;
    /** Maximum framework version supported */
    maxVersion?: string;
    /** Plugin-specific configuration */
    config?: Record<string, any>;
  };
}