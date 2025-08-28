/*
// プラグイン関連の型定義
export interface PluginCapabilities {
  supportsCreate: boolean;
  supportsUpdate: boolean;
  supportsDelete: boolean;
  supportsChildren: boolean;
  supportedOperations: Array<'create' | 'read' | 'update' | 'delete' | 'move' | 'copy'>;
}
 */

import { NodeType } from './id-types';

/*
export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  nodeType: NodeType;
  status: 'active' | 'inactive' | 'error';
  //capabilities?: PluginCapabilities;
  tags?: string[];
  dependencies?: string[];
  // Entity reference hints for 3x2 lifecycle management
  entityHints?: EntityReferenceHints;
}

export interface EntityReferenceHints {
  // PeerEntity/GroupEntity: TreeNodeを参照するプロパティ名
  // デフォルト: 'nodeId'
  nodeRefField?: string;

  // RelationalEntity: RelationalEntityを参照するプロパティ名
  // デフォルト: 'relRef'
  relRefField?: string;
}
 */

/**
 * Plugin metadata for dependency resolution
 */
export interface PluginMetadata {
  /** Plugin identifier */
  nodeType: NodeType;
  /** Human-readable name */
  name: string;
  /** Plugin version */
  version: string;
  /** Loading priority */
  priority?: number;
  /** Required dependencies */
  dependencies?: NodeType[];
  /** Parent plugin (inheritance) */
  extends?: NodeType;
  /** Plugin description */
  description?: string;
  /** Plugin category */
  category?: string;
}

/**
 * Dependency resolution result
 */
export interface ResolutionResult {
  /** Whether resolution was successful */
  success: boolean;
  /** Resolved plugins in load order */
  resolvedOrder: ResolvedPlugin[];
  /** Dependency graph */
  graph: DependencyGraph;
  /** Any resolution errors */
  errors: DependencyError[];
  /** Warning messages */
  warnings: string[];
}

/**
 * Individual resolved plugin entry
 */
export interface ResolvedPlugin {
  /** Plugin identifier */
  nodeType: NodeType;
  /** Plugin metadata */
  metadata: PluginMetadata;
  /** Resolution depth (0 = requested, 1+ = dependency) */
  depth: number;
  /** Load order index */
  loadOrder: number;
  /** Plugins this depends on */
  dependencies: NodeType[];
  /** Plugins that depend on this */
  dependents: NodeType[];
}

/**
 * Dependency graph structure
 */
export interface DependencyGraph {
  /** All nodes in the graph */
  nodes: Map<NodeType, PluginMetadata>;
  /** Edge mappings (from -> to[]) */
  edges: Map<NodeType, Set<NodeType>>;
  /** Reverse edge mappings (to -> from[]) */
  reverseEdges: Map<NodeType, Set<NodeType>>;
  /** Topological ordering */
  topologicalOrder: NodeType[];
}

/**
 * Dependency resolution error
 */
export interface DependencyError {
  /** Error type */
  type: 'missing' | 'circular' | 'version' | 'conflict';
  /** Error message */
  message: string;
  /** Node types involved */
  nodeTypes: NodeType[];
  /** Additional context */
  context?: Record<string, any>;
}

/**
 * Plugin registration configuration
 */
export interface PluginRegistrationConfig {
  /** Allow version conflicts */
  allowVersionConflicts?: boolean;
  /** Allow circular dependencies */
  allowCircularDependencies?: boolean;
  /** Skip missing optional dependencies */
  skipMissingOptional?: boolean;
  /** Maximum dependency depth */
  maxDepth?: number;
}
