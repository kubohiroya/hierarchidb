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
  NodeLifecycleHooks,
  EntityBackup,
} from '../types/nodeDefinition';
import { BaseNodeTypeRegistry } from './BaseNodeTypeRegistry';
import type { INodeDefinitionRegistry } from './INodeTypeRegistry';

/**
 * Registry for managing NodeTypeDefinition instances
 * Used for AOP-based plugin architecture
 */
export class NodeDefinitionRegistry
  extends BaseNodeTypeRegistry<NodeTypeDefinition<BaseEntity, BaseSubEntity, BaseWorkingCopy>>
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
    // Resetting to undefined is safe for singleton reset
    NodeDefinitionRegistry.instance = undefined as unknown as NodeDefinitionRegistry;
  }

  /**
   * Register a node type definition
   */
  registerDefinition<
    TEntity extends BaseEntity,
    TSubEntity extends BaseSubEntity,
    TWorkingCopy extends BaseWorkingCopy,
  >(definition: NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy>): void {
    const { nodeType } = definition;

    // Validate (local to avoid generic variance issues)
    if (!nodeType) {
      throw new Error('Node type cannot be null or undefined');
    }
    if (definition === null || definition === undefined) {
      throw new Error('Definition cannot be null or undefined');
    }

    if (this.registry.has(nodeType)) {
      throw new Error(`Node type ${nodeType} is already registered`);
    }

    // Store with safe adaptation to base-typed facade (avoid unsafe casts)
    const adapted = this.adaptDefinition(definition);
    this.registry.set(nodeType, adapted.definition);
    this.handlers.set(nodeType, adapted.handler);

    // Register database schema
    this.registerDatabaseSchema(definition);

    // Register API extensions
    if (definition.api) {
      this.registerAPIExtensions(definition);
    }

    // Call hook
    this.onRegister(nodeType, adapted.definition);
    this.logRegistration(nodeType, 'register');
  }

  /**
   * Generic register method (delegates to registerDefinition)
   */
  register(_nodeType: TreeNodeType, config: NodeTypeDefinition<BaseEntity, BaseSubEntity, BaseWorkingCopy>): void {
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
   * Adapt a generic NodeTypeDefinition<TEntity,...> into a base-typed facade
   * to safely store in the registry without using any. Function parameters
   * are downcast at the boundary; return values are upcast to base.
   */
  private adaptDefinition<
    TEntity extends BaseEntity,
    TSubEntity extends BaseSubEntity,
    TWorkingCopy extends BaseWorkingCopy,
  >(definition: NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy>): {
    definition: NodeTypeDefinition<BaseEntity, BaseSubEntity, BaseWorkingCopy>;
    handler: EntityHandler<BaseEntity, BaseSubEntity, BaseWorkingCopy>;
  } {
    const { entityHandler, lifecycle } = definition;

    const adaptedHandler: EntityHandler<BaseEntity, BaseSubEntity, BaseWorkingCopy> = {
      // Entity operations
      createEntity: async (nodeId, data) =>
        (await entityHandler.createEntity(nodeId, data as Partial<TEntity>)) as BaseEntity,
      getEntity: async (nodeId) =>
        (await entityHandler.getEntity(nodeId)) as BaseEntity | undefined,
      updateEntity: async (nodeId, data) =>
        entityHandler.updateEntity(nodeId, data as Partial<TEntity>),
      deleteEntity: async (nodeId) => entityHandler.deleteEntity(nodeId),

      // Sub-entity operations
      createSubEntity: entityHandler.createSubEntity
        ? async (nodeId, subType, data) =>
            entityHandler.createSubEntity!(nodeId, subType, data as TSubEntity)
        : undefined,
      getSubEntities: entityHandler.getSubEntities
        ? async (nodeId, subType) =>
            (await entityHandler.getSubEntities!(nodeId, subType)) as TSubEntity[]
        : undefined,
      deleteSubEntities: entityHandler.deleteSubEntities
        ? async (nodeId, subType) => entityHandler.deleteSubEntities!(nodeId, subType)
        : undefined,

      // Working copy operations
      createWorkingCopy: async (nodeId) =>
        (await entityHandler.createWorkingCopy(nodeId)) as BaseWorkingCopy,
      commitWorkingCopy: async (nodeId, workingCopy) =>
        entityHandler.commitWorkingCopy(nodeId, workingCopy as TWorkingCopy),
      discardWorkingCopy: async (nodeId) => entityHandler.discardWorkingCopy(nodeId),

      // Optional operations
      duplicate: entityHandler.duplicate
        ? async (nodeId, newNodeId) => entityHandler.duplicate!(nodeId, newNodeId)
        : undefined,
      backup: entityHandler.backup
        ? async (nodeId) => entityHandler.backup!(nodeId)
        : undefined,
      restore: entityHandler.restore
        ? async (nodeId, backup) =>
            entityHandler.restore!(nodeId, backup as EntityBackup<TEntity>)
        : undefined,
      cleanup: entityHandler.cleanup
        ? async (nodeId) => entityHandler.cleanup!(nodeId)
        : undefined,
    };

    const adaptedLifecycle: NodeLifecycleHooks<BaseEntity, BaseWorkingCopy> = {
      beforeCreate: lifecycle.beforeCreate
        ? async (parentId, nodeData) => lifecycle.beforeCreate!(parentId, nodeData)
        : undefined,
      afterCreate: lifecycle.afterCreate
        ? async (nodeId, entity) => lifecycle.afterCreate!(nodeId, entity as TEntity)
        : undefined,
      beforeUpdate: lifecycle.beforeUpdate
        ? async (nodeId, changes) => lifecycle.beforeUpdate!(nodeId, changes)
        : undefined,
      afterUpdate: lifecycle.afterUpdate
        ? async (nodeId, entity) => lifecycle.afterUpdate!(nodeId, entity as TEntity)
        : undefined,
      beforeDelete: lifecycle.beforeDelete
        ? async (nodeId) => lifecycle.beforeDelete!(nodeId)
        : undefined,
      afterDelete: lifecycle.afterDelete
        ? async (nodeId) => lifecycle.afterDelete!(nodeId)
        : undefined,
      beforeMove: lifecycle.beforeMove
        ? async (nodeId, newParentId) => lifecycle.beforeMove!(nodeId, newParentId)
        : undefined,
      afterMove: lifecycle.afterMove
        ? async (nodeId, newParentId) => lifecycle.afterMove!(nodeId, newParentId)
        : undefined,
      beforeDuplicate: lifecycle.beforeDuplicate
        ? async (sourceId, targetParentId) => lifecycle.beforeDuplicate!(sourceId, targetParentId)
        : undefined,
      afterDuplicate: lifecycle.afterDuplicate
        ? async (sourceId, newNodeId) => lifecycle.afterDuplicate!(sourceId, newNodeId)
        : undefined,
      onWorkingCopyCreated: lifecycle.onWorkingCopyCreated
        ? async (nodeId, wc) => lifecycle.onWorkingCopyCreated!(nodeId, wc as TWorkingCopy)
        : undefined,
      onWorkingCopyCommitted: lifecycle.onWorkingCopyCommitted
        ? async (nodeId, wc) => lifecycle.onWorkingCopyCommitted!(nodeId, wc as TWorkingCopy)
        : undefined,
      onWorkingCopyDiscarded: lifecycle.onWorkingCopyDiscarded
        ? async (nodeId) => lifecycle.onWorkingCopyDiscarded!(nodeId)
        : undefined,
    };

    const adaptedDefinition: NodeTypeDefinition<BaseEntity, BaseSubEntity, BaseWorkingCopy> = {
      ...definition,
      entityHandler: adaptedHandler,
      lifecycle: adaptedLifecycle,
    } as unknown as NodeTypeDefinition<BaseEntity, BaseSubEntity, BaseWorkingCopy>;

    return { definition: adaptedDefinition, handler: adaptedHandler };
  }

  /**
   * Type guard to check if config is NodeTypeDefinition
   */
  private isNodeTypeDefinition(config: unknown): config is NodeTypeDefinition {
    if (typeof config !== 'object' || config === null) return false;
    const obj = config as Record<string, unknown>;
    return 'nodeType' in obj && 'entityHandler' in obj && 'database' in obj;
  }
}
