import { PluginDefinition } from '@hierarchidb/common-api';
import type { NodeType } from '@hierarchidb/common-types';

/**
 * Dependency resolution result
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface ResolutionResult {
  /** Whether resolution was successful */
  success: boolean;
  /** Resolved plugin-loader in load order */
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
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface ResolvedPlugin {
  /** Plugin identifier */
  nodeType: NodeType;
  /** Plugin metadata */
  metadata: PluginDefinition;
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
  nodes: Map<NodeType, PluginDefinition>;
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
/**
 * @deprecated Unused across the repository; scheduled for removal.
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
/**
 * @deprecated Unused across the repository; scheduled for removal.
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
