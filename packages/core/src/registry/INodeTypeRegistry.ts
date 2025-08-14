/**
 * @file INodeTypeRegistry.ts
 * @description Base interfaces for node type and plugin registries
 */

import type { TreeNodeType } from '../types/base';
import type {
  NodeTypeDefinition,
  BaseEntity,
  BaseSubEntity,
  BaseWorkingCopy,
  EntityHandler,
} from '../types/nodeDefinition';

/**
 * Base interface for all node type registries
 */
export interface INodeTypeRegistry {
  /**
   * Register a node type with its configuration
   */
  register(nodeType: TreeNodeType, config: any): void;

  /**
   * Unregister a node type
   */
  unregister(nodeType: TreeNodeType): void;

  /**
   * Get configuration for a node type
   */
  get(nodeType: TreeNodeType): any;

  /**
   * Check if a node type is registered
   */
  has(nodeType: TreeNodeType): boolean;

  /**
   * Get all registered node types
   */
  getAll(): TreeNodeType[];

  /**
   * Clear all registrations
   */
  clear(): void;
}

/**
 * Extended interface for plugin registries with UnifiedPluginDefinition support
 */
export interface IPluginRegistry extends INodeTypeRegistry {
  /**
   * Register a plugin with its unified definition
   */
  registerPlugin(
    definition: any // UnifiedPluginDefinition type would be imported from worker
  ): void;

  /**
   * Get plugin definition
   */
  getPlugin(nodeType: TreeNodeType): any;

  /**
   * Get entity handler for a node type
   */
  getEntityHandler(nodeType: TreeNodeType): EntityHandler | undefined;

  /**
   * Validate plugin dependencies
   */
  validateDependencies(nodeType: TreeNodeType): boolean;

  /**
   * Get plugins by tag
   */
  findPluginsByTag(tag: string): any[];

  /**
   * Get all plugins
   */
  getAllPlugins(): any[];
}

/**
 * Interface for node type definition registry (original core registry)
 */
export interface INodeDefinitionRegistry extends INodeTypeRegistry {
  /**
   * Register a node type definition
   */
  registerDefinition<
    TEntity extends BaseEntity,
    TSubEntity extends BaseSubEntity,
    TWorkingCopy extends BaseWorkingCopy,
  >(
    definition: NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy>
  ): void;

  /**
   * Get node type definition
   */
  getDefinition(
    nodeType: TreeNodeType
  ): NodeTypeDefinition<BaseEntity, BaseSubEntity, BaseWorkingCopy> | undefined;

  /**
   * Get entity handler
   */
  getHandler(
    nodeType: TreeNodeType
  ): EntityHandler<BaseEntity, BaseSubEntity, BaseWorkingCopy> | undefined;
}

/**
 * Simple configuration for node types (used in worker)
 */
export interface NodeTypeConfig {
  icon?: string;
  color?: string;
  displayName?: string;
  allowedChildren?: TreeNodeType[];
  maxChildren?: number;
  canBeRoot?: boolean;
  canBeDeleted?: boolean;
  canBeRenamed?: boolean;
  canBeMoved?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Interface for simple node type registry (lightweight version)
 */
export interface ISimpleNodeTypeRegistry extends INodeTypeRegistry {
  /**
   * Register node type with simple config
   */
  registerNodeType(nodeType: TreeNodeType, config: NodeTypeConfig): void;

  /**
   * Get node type config
   */
  getNodeTypeConfig(nodeType: TreeNodeType): NodeTypeConfig | undefined;

  /**
   * Check if a child type can be added to a parent type
   */
  canAddChild(parentType: TreeNodeType, childType: TreeNodeType): boolean;

  /**
   * Get default icon for a node type
   */
  getDefaultIcon(nodeType: TreeNodeType): string;
}
