/**
 * @file SimpleNodeTypeRegistry.ts
 * @description Lightweight registry for simple node type configurations
 * This replaces the old NodeTypeRegistry.ts in the worker package
 */

import type { ISimpleNodeTypeRegistry, NodeTypeConfig } from '@hierarchidb/common-core';
import { BaseNodeTypeRegistry, NodeType } from '@hierarchidb/common-core';

/**
 * Simple registry for managing basic node type configurations
 * Used for lightweight node type management without full plugin features
 */
export class SimpleNodeTypeRegistry
  extends BaseNodeTypeRegistry<NodeTypeConfig>
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
  registerNodeType(nodeType: NodeType, config: NodeTypeConfig): void {
    this.register(nodeType, config);
  }

  /**
   * Generic register method
   */
  register(nodeType: NodeType, config: NodeTypeConfig): void {
    this.registry.set(nodeType, config);
    this.onRegister(nodeType, config);
    this.logRegistration(nodeType, 'register');
  }

  /**
   * Unregister a node type (alias for unregister)
   */
  unregisterNodeType(nodeType: NodeType): void {
    this.unregister(nodeType);
  }

  /**
   * Get configuration for a node type
   */
  getNodeTypeConfig(nodeType: NodeType): NodeTypeConfig | undefined {
    return this.registry.get(nodeType);
  }

  /**
   * Check if a node type is registered
   */
  isRegistered(nodeType: NodeType): boolean {
    return this.has(nodeType);
  }

  /**
   * Get all registered node types
   */
  getAllNodeTypes(): NodeType[] {
    return this.getAll();
  }

  /**
   * Check if a child type can be added to a parent type
   */
  canAddChild(parentType: NodeType, childType: NodeType): boolean {
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
  getDefaultIcon(nodeType: NodeType): string {
    const config = this.getNodeTypeConfig(nodeType);

    // Return configured icon if available
    if (config?.icon) {
      return config.icon;
    }

    // Return type-specific defaults
    switch (nodeType) {
      case 'Root':
      case 'Trash':
      case 'folder':
        return 'folder';
      case 'file':
        return 'file';
      default:
        // Default to 'file' icon for unknown types in a simple registry
        return 'file';
    }
  }

  /**
   * Batch register multiple node types
   */
  registerBatch(types: Array<{ nodeType: NodeType; config: NodeTypeConfig }>): void {
    types.forEach(({ nodeType, config }) => {
      this.registerNodeType(nodeType, config);
    });
  }

  /**
   * Get validation rules for a node type
   */
  getValidationRules(nodeType: NodeType): Partial<NodeTypeConfig> {
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
  canBeRoot(nodeType: NodeType): boolean {
    const config = this.getNodeTypeConfig(nodeType);
    return config?.canBeRoot ?? false;
  }

  /**
   * Get sorted node types by their sort order
   */
  getSortedNodeTypes(): NodeType[] {
    const types = Array.from(this.registry.entries());

    return types
      .sort((a, b) => {
        const orderA = a[1].sortOrder ?? 999;
        const orderB = b[1].sortOrder ?? 999;
        return orderA - orderB;
      })
      .map(([type]) => type);
  }
}
