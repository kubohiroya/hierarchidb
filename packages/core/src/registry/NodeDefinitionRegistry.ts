/**
 * @file NodeDefinitionRegistry.ts
 * @description Registry for NodeTypeDefinition (AOP-based node definitions)
 * This is the refactored version of the original NodeTypeRegistry in core
 */

import type { TreeNodeType } from '../types/base';
import type {
  NodeTypeDefinition,
  BaseEntity,
  BaseSubEntity,
  BaseWorkingCopy,
  EntityHandler,
} from '../types/nodeDefinition';
import { BaseNodeTypeRegistry } from './BaseNodeTypeRegistry';
import type { INodeDefinitionRegistry } from './INodeTypeRegistry';

/**
 * Registry for managing NodeTypeDefinition instances
 * Used for AOP-based plugin architecture
 */
export class NodeDefinitionRegistry
  extends BaseNodeTypeRegistry
  implements INodeDefinitionRegistry
{
  private static instance: NodeDefinitionRegistry;
  private handlers: Map<TreeNodeType, EntityHandler<BaseEntity, BaseSubEntity, BaseWorkingCopy>> =
    new Map();

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    super();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): NodeDefinitionRegistry {
    if (!NodeDefinitionRegistry.instance) {
      NodeDefinitionRegistry.instance = new NodeDefinitionRegistry();
    }
    return NodeDefinitionRegistry.instance;
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static resetInstance(): void {
    NodeDefinitionRegistry.instance = undefined as any;
  }

  /**
   * Register a node type definition
   */
  registerDefinition<
    TEntity extends BaseEntity,
    TSubEntity extends BaseSubEntity,
    TWorkingCopy extends BaseWorkingCopy,
  >(definition: NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy>): void {
    const { nodeType, entityHandler } = definition;

    // Validate
    this.validateConfig(nodeType, definition);

    if (this.registry.has(nodeType)) {
      throw new Error(`Node type ${nodeType} is already registered`);
    }

    // Store with type casting to base types
    this.registry.set(
      nodeType,
      definition as unknown as NodeTypeDefinition<BaseEntity, BaseSubEntity, BaseWorkingCopy>
    );
    this.handlers.set(
      nodeType,
      entityHandler as unknown as EntityHandler<BaseEntity, BaseSubEntity, BaseWorkingCopy>
    );

    // Register database schema
    this.registerDatabaseSchema(definition);

    // Register API extensions
    if (definition.api) {
      this.registerAPIExtensions(definition);
    }

    // Call hook
    this.onRegister(nodeType, definition);
    this.logRegistration(nodeType, 'register');
  }

  /**
   * Generic register method (delegates to registerDefinition)
   */
  register(_nodeType: TreeNodeType, config: any): void {
    if (this.isNodeTypeDefinition(config)) {
      this.registerDefinition(config);
    } else {
      throw new Error('Invalid configuration: expected NodeTypeDefinition');
    }
  }

  /**
   * Unregister a node type
   */
  unregister(nodeType: TreeNodeType): void {
    super.unregister(nodeType);
    this.handlers.delete(nodeType);
    this.logRegistration(nodeType, 'unregister');
  }

  /**
   * Get node type definition
   */
  getDefinition(
    nodeType: TreeNodeType
  ): NodeTypeDefinition<BaseEntity, BaseSubEntity, BaseWorkingCopy> | undefined {
    return this.registry.get(nodeType);
  }

  /**
   * Get entity handler
   */
  getHandler(
    nodeType: TreeNodeType
  ): EntityHandler<BaseEntity, BaseSubEntity, BaseWorkingCopy> | undefined {
    return this.handlers.get(nodeType);
  }

  /**
   * Get all definitions
   */
  getAllDefinitions(): NodeTypeDefinition<BaseEntity, BaseSubEntity, BaseWorkingCopy>[] {
    return Array.from(this.registry.values());
  }

  /**
   * Check if a node type has a specific capability
   */
  hasCapability(nodeType: TreeNodeType, capability: keyof NodeTypeDefinition): boolean {
    const definition = this.getDefinition(nodeType);
    return definition ? capability in definition : false;
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    super.clear();
    this.handlers.clear();
  }

  /**
   * Register database schema
   */
  private registerDatabaseSchema<
    TEntity extends BaseEntity,
    TSubEntity extends BaseSubEntity,
    TWorkingCopy extends BaseWorkingCopy,
  >(definition: NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy>): void {
    const { database } = definition;
    // TODO: Implement Dexie dynamic schema registration
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[NodeDefinitionRegistry] Registering database schema for ${definition.nodeType}:`,
        database
      );
    }
  }

  /**
   * Register API extensions
   */
  private registerAPIExtensions<
    TEntity extends BaseEntity,
    TSubEntity extends BaseSubEntity,
    TWorkingCopy extends BaseWorkingCopy,
  >(definition: NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy>): void {
    const { api } = definition;
    // TODO: Implement API extension registry integration
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[NodeDefinitionRegistry] Registering API extensions for ${definition.nodeType}:`,
        api
      );
    }
  }

  /**
   * Type guard to check if config is NodeTypeDefinition
   */
  private isNodeTypeDefinition(config: any): config is NodeTypeDefinition {
    return (
      config &&
      typeof config === 'object' &&
      'nodeType' in config &&
      'entityHandler' in config &&
      'database' in config
    );
  }
}
