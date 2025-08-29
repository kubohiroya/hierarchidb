/**
 * @file NodeDefinitionRegistry.ts
 * @description Registry for PluginDefinition (AOP-based node definitions)
 * This is the refactored version of the original NodeTypeRegistry in core
 * Moved from common-core to keep implementation details internal to worker
 */

import { NodeType, WorkingCopyProperties } from '@hierarchidb/common-type';
import type {
  PeerEntity,
  GroupEntity,
  EntityHandler,
  NodeTypeDefinition,
  NodeLifecycleHooks,
  EntityBackup,
  INodeDefinitionRegistry,
} from '@hierarchidb/common-type';

import { BaseNodeTypeRegistry } from './BaseNodeTypeRegistry';

/**
 * Registry for managing PluginDefinition instances
 * Used for AOP-based plugin architecture
 */
export class NodeDefinitionRegistry
  extends BaseNodeTypeRegistry<
    NodeTypeDefinition<PeerEntity, GroupEntity, PeerEntity & WorkingCopyProperties>
  >
  implements INodeDefinitionRegistry
{
  private static instance: NodeDefinitionRegistry;
  private handlers: Map<
    NodeType,
    EntityHandler<PeerEntity, GroupEntity, PeerEntity & WorkingCopyProperties>
  > = new Map();
  
  // Add database manager support
  private databaseManager: any; // PluginDatabaseManager type

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
   * Reset instance for testing
   */
  static resetInstance(): void {
    if (NodeDefinitionRegistry.instance) {
      NodeDefinitionRegistry.instance.clear();
      NodeDefinitionRegistry.instance = null as any;
    }
  }
  
  /**
   * Set database manager
   */
  setDatabaseManager(manager: any): void {
    this.databaseManager = manager;
  }

  /**
   * Register a node type definition
   */
  registerDefinition<
    TPeerEntity extends PeerEntity,
    TGroupEntity extends GroupEntity,
    TWorkingCopy extends TPeerEntity & WorkingCopyProperties,
  >(definition: NodeTypeDefinition<TPeerEntity, TGroupEntity, TWorkingCopy>): void {
    this.validateDefinition(definition);

    const nodeType = definition.nodeType;
    
    // Store the definition with type assertion
    const storedDef = definition as NodeTypeDefinition<
      PeerEntity,
      GroupEntity,
      PeerEntity & WorkingCopyProperties
    >;
    
    this.registry.set(nodeType, storedDef);
    
    // Store entity handler separately
    if (definition.entityHandler) {
      const handler = definition.entityHandler as EntityHandler<
        PeerEntity,
        GroupEntity,
        PeerEntity & WorkingCopyProperties
      >;
      this.handlers.set(nodeType, handler);
    }

    this.onRegister(nodeType, storedDef);
  }

  /**
   * Register implementation (required by abstract class)
   */
  register(nodeType: NodeType, config: NodeTypeDefinition<PeerEntity, GroupEntity, PeerEntity & WorkingCopyProperties>): void {
    this.registerDefinition(config);
  }

  /**
   * Get node type definition
   */
  getDefinition(
    nodeType: NodeType
  ): NodeTypeDefinition<PeerEntity, GroupEntity, PeerEntity & WorkingCopyProperties> | undefined {
    return this.registry.get(nodeType);
  }

  /**
   * Get entity handler
   */
  getHandler(
    nodeType: NodeType
  ): EntityHandler<PeerEntity, GroupEntity, PeerEntity & WorkingCopyProperties> | undefined {
    return this.handlers.get(nodeType);
  }

  /**
   * Unregister override to clean up handlers
   */
  override unregister(nodeType: NodeType, options?: { clearData?: boolean; dropDatabase?: boolean }): void {
    this.handlers.delete(nodeType);
    super.unregister(nodeType);
    
    // Handle cleanup options if database manager is available
    if (this.databaseManager && options) {
      if (options.clearData) {
        // Clear data logic
      }
      if (options.dropDatabase) {
        // Drop database logic
      }
    }
  }

  /**
   * Clear override to clean up handlers
   */
  override clear(): void {
    this.handlers.clear();
    super.clear();
  }

  /**
   * Check if a node type has a specific capability
   */
  hasCapability(nodeType: NodeType, capability: string): boolean {
    const definition = this.getDefinition(nodeType);
    if (!definition) {
      return false;
    }

    // Check for specific capabilities
    switch (capability) {
      case 'database':
        return !!definition.database;
      case 'entityHandler':
        return !!definition.entityHandler;
      case 'lifecycle':
        return !!definition.lifecycle;
      case 'api':
        return !!(definition as any).api;
      case 'ui':
        return !!(definition as any).ui;
      default:
        return false;
    }
  }

  /**
   * Get all definitions (type-safe)
   */
  getAllDefinitions(): NodeTypeDefinition<PeerEntity, GroupEntity, PeerEntity & WorkingCopyProperties>[] {
    return Array.from(this.registry.values());
  }

  /**
   * Validate definition before registration
   */
  private validateDefinition<
    TPeerEntity extends PeerEntity,
    TGroupEntity extends GroupEntity,
    TWorkingCopy extends TPeerEntity & WorkingCopyProperties,
  >(definition: NodeTypeDefinition<TPeerEntity, TGroupEntity, TWorkingCopy>): void {
    if (!definition) {
      throw new Error('Definition cannot be null or undefined');
    }

    if (!definition.nodeType) {
      throw new Error('Node type cannot be null or undefined');
    }

    if (this.has(definition.nodeType)) {
      throw new Error(`Node type ${definition.nodeType} is already registered`);
    }

    // Validate entity handler
    if (!definition.entityHandler) {
      console.warn(`No entity handler provided for node type ${definition.nodeType}`);
    }
  }

  /**
   * Hook called after successful registration
   */
  protected override onRegister(
    nodeType: NodeType,
    config: NodeTypeDefinition<PeerEntity, GroupEntity, PeerEntity & WorkingCopyProperties>
  ): void {
    this.logRegistration(nodeType, 'register');
    
    // Initialize plugin database if configured
    if (this.databaseManager && config.database) {
      // Database initialization logic
    }
  }

  /**
   * Hook called after unregistration
   */
  protected override onUnregister(nodeType: NodeType): void {
    this.logRegistration(nodeType, 'unregister');
  }
}