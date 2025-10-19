/**
 * @file registry.ts
 * @description Base interfaces for node type and plugin registries
 * Moved from common-core/src/registry/INodeTypeRegistry.ts
 */
import { PluginDefinition } from './plugin-definition.js';
import type {  EntityHandler, NodeType } from '@hierarchidb/common-types';

/**
 * Base interface for all node type registries
 */
export interface INodeTypeRegistry<TValue = unknown> {
  /**
   * Register a node type with its configuration
   */
  register(nodeType: NodeType, config: TValue): void;

  /**
   * Unregister a node type
   */
  unregister(nodeType: NodeType): void;

  /**
   * Get configuration for a node type
   */
  get(nodeType: NodeType): TValue | undefined;

  /**
   * Check if a node type is registered
   */
  has(nodeType: NodeType): boolean;

  /**
   * Get all registered node types
   */
  getAll(): NodeType[];

  /**
   * Clear all registrations
   */
  clear(): void;
}

/**
 * Extended interface for plugin registries with PluginDefinition support
 */
export interface IPluginRegistry extends INodeTypeRegistry<unknown> {
  /**
   * Register a plugin with its unified definition
   */
  registerPlugin(
    definition: any, // PluginDefinition type would be imported from worker
  ): void;

  /**
   * Get plugin definition
   */
  getPlugin(nodeType: NodeType): any;

  /**
   * Get entity handler for a node type
   */
  getEntityHandler(nodeType: NodeType): EntityHandler | undefined;

  /**
   * Validate plugin dependencies
   */
  validateDependencies(nodeType: NodeType): boolean;

  /**
   * Get plugin-loader by tag
   */
  findPluginsByTag(tag: string): any[];

  /**
   * Get all plugin-loader
   */
  getAllPlugins(): any[];
}

/**
 * Interface for node type definition registry (original core registry)
 */
export interface INodeDefinitionRegistry extends INodeTypeRegistry<PluginDefinition> {
  /**
   * Register a node type definition
   */
  registerDefinition(definition: PluginDefinition): void;

  /**
   * Get node type definition
   */
  getDefinition(nodeType: NodeType): PluginDefinition | undefined;

  /**
   * Get entity handler
   */
  getHandler(nodeType: NodeType): EntityHandler | undefined;
}

/**
 * Simple configuration for node types (used in worker)
 */
export interface NodeTypeConfig {
  icon?: string;
  color?: string;
  displayName?: string;
  allowedChildren?: NodeType[];
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
export interface ISimpleNodeTypeRegistry extends INodeTypeRegistry<NodeTypeConfig> {
  /**
   * Register node type with simple config
   */
  registerNodeType(nodeType: NodeType, config: NodeTypeConfig): void;

  /**
   * Get node type config
   */
  getNodeTypeConfig(nodeType: NodeType): NodeTypeConfig | undefined;

  /**
   * Check if a child type can be added to a parent type
   */
  canAddChild(parentType: NodeType, childType: NodeType): boolean;

  /**
   * Get default icon for a node type
   */
  getDefaultIcon(nodeType: NodeType): string;
}
