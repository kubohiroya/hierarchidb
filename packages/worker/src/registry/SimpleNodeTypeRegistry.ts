/**
 * @file SimpleNodeTypeRegistry.ts
 * @description Lightweight registry for simple node type configurations
 * This replaces the old NodeTypeRegistry.ts in the worker package
 */

import type { TreeNodeType } from '@hierarchidb/core';
import { BaseNodeTypeRegistry, TreeNodeTypes } from '@hierarchidb/core';
import type { ISimpleNodeTypeRegistry, NodeTypeConfig } from '@hierarchidb/core';

/**
 * Simple registry for managing basic node type configurations
 * Used for lightweight node type management without full plugin features
 */
export class SimpleNodeTypeRegistry
  extends BaseNodeTypeRegistry
  implements ISimpleNodeTypeRegistry
{
  constructor() {
    super();
    this.initializeDefaultTypes();
  }

  /**
   * Initialize default node types
   */
  private initializeDefaultTypes(): void {
    // Default configurations can be overridden by plugins
  }

  /**
   * Register a node type with its configuration
   */
  registerNodeType(nodeType: TreeNodeType, config: NodeTypeConfig): void {
    this.register(nodeType, config);
  }

  /**
   * Generic register method
   */
  register(nodeType: TreeNodeType, config: NodeTypeConfig): void {
    this.registry.set(nodeType, config);
    this.onRegister(nodeType, config);
    this.logRegistration(nodeType, 'register');
  }

  /**
   * Unregister a node type (alias for unregister)
   */
  unregisterNodeType(nodeType: TreeNodeType): void {
    this.unregister(nodeType);
  }

  /**
   * Get configuration for a node type
   */
  getNodeTypeConfig(nodeType: TreeNodeType): NodeTypeConfig | undefined {
    return this.registry.get(nodeType);
  }

  /**
   * Check if a node type is registered
   */
  isRegistered(nodeType: TreeNodeType): boolean {
    return this.has(nodeType);
  }

  /**
   * Get all registered node types
   */
  getAllNodeTypes(): TreeNodeType[] {
    return this.getAll();
  }

  /**
   * Check if a child type can be added to a parent type
   */
  canAddChild(parentType: TreeNodeType, childType: TreeNodeType): boolean {
    const parentConfig = this.getNodeTypeConfig(parentType);

    // If parent type is not registered, allow all children
    if (!parentConfig) {
      return true;
    }

    // If no allowedChildren specified, allow all
    if (!parentConfig.allowedChildren) {
      return true;
    }

    // Check if child type is in allowed list
    return parentConfig.allowedChildren.includes(childType);
  }

  /**
   * Get default icon for a node type
   */
  getDefaultIcon(nodeType: TreeNodeType): string {
    const config = this.getNodeTypeConfig(nodeType);

    // Return configured icon if available
    if (config?.icon) {
      return config.icon;
    }

    // Return type-specific defaults
    switch (nodeType) {
      case TreeNodeTypes.Root:
      case TreeNodeTypes.Trash:
      case TreeNodeTypes.folder:
        return 'folder';
      default:
        throw new Error(`Default icon not found for node type: ${nodeType}`);
    }
  }

  /**
   * Batch register multiple node types
   */
  registerBatch(types: Array<{ nodeType: TreeNodeType; config: NodeTypeConfig }>): void {
    types.forEach(({ nodeType, config }) => {
      this.registerNodeType(nodeType, config);
    });
  }

  /**
   * Get validation rules for a node type
   */
  getValidationRules(nodeType: TreeNodeType): Partial<NodeTypeConfig> {
    const config = this.getNodeTypeConfig(nodeType);
    if (!config) {
      return {};
    }

    return {
      canBeDeleted: config.canBeDeleted,
      canBeRenamed: config.canBeRenamed,
      canBeMoved: config.canBeMoved,
      maxChildren: config.maxChildren,
    };
  }

  /**
   * Check if a node type can be a root node
   */
  canBeRoot(nodeType: TreeNodeType): boolean {
    const config = this.getNodeTypeConfig(nodeType);
    return config?.canBeRoot ?? false;
  }

  /**
   * Get sorted node types by their sort order
   */
  getSortedNodeTypes(): TreeNodeType[] {
    const types = Array.from(this.registry.entries());

    return types
      .sort((a, b) => {
        const orderA = (a[1] as NodeTypeConfig).sortOrder ?? 999;
        const orderB = (b[1] as NodeTypeConfig).sortOrder ?? 999;
        return orderA - orderB;
      })
      .map(([type]) => type);
  }
}
