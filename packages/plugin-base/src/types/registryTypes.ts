/**
 * @file registry.ts
 * @description Base interfaces for node type and plugin registries
 * Moved from _obsolate_common-core/src/registry/INodeTypeRegistry.ts
 */
import type { NodeType } from '@hierarchidb/core-types';

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
