/**
 * @file NodeRegistry.ts
 * @description Extended NodeTypeRegistry with PluginDefinition support
 * Singleton pattern implementation for centralized plugin management
 * References: docs/7-aop-architecture.md, ../eria-cartograph/app0/src/shared/services/ResourceDefinitionRegistry.ts
 */

import type { IPluginRegistry, NodeType } from '@hierarchidb/common-core';
import { workerLog, workerWarn } from '../utils/workerLogger';
import type { NodeTypeConfig } from './types';
import type {
  PeerEntity,
  GroupEntity,
  WorkingCopyProperties,
  EntityHandler,
  PluginDefinition,
  WorkerPluginRouterAction,
} from './plugin';

/**
 * Extended registry interface with PluginDefinition support
 */
export interface INodeRegistry extends IPluginRegistry {
  // Plugin registration
  registerPlugin<
    TEntity extends PeerEntity,
    TGroupEntity extends GroupEntity,
    TWorkingCopy extends TEntity & WorkingCopyProperties,
  >(
    definition: PluginDefinition<TEntity, TGroupEntity, TWorkingCopy>
  ): void;

  // Plugin retrieval
  getPluginDefinition(nodeType: NodeType): PluginDefinition | undefined;
  getEntityHandler(
    nodeType: NodeType
  ): EntityHandler<PeerEntity, GroupEntity, PeerEntity & WorkingCopyProperties> | undefined;

  // Router actions
  getRouterAction(
    nodeType: NodeType,
    action: string
  ): WorkerPluginRouterAction | ((...args: any[]) => Promise<any>) | undefined;
  getAvailableActions(nodeType: NodeType): string[];

  // Plugin search
  findPluginsByTag(tag: string): PluginDefinition[];
  getPluginDependencies(nodeType: NodeType): string[];

  // Plugin validation
  validatePluginDependencies(nodeType: NodeType): boolean;
  getAllPlugins(): PluginDefinition[];
}

/**
 * Unified NodeTypeRegistry with plugin support
 * Complete plugin registry implementation
 */
export class NodeRegistry implements INodeRegistry {
  private static instance: NodeRegistry | null = null;
  private pluginDefinitions: Map<NodeType, PluginDefinition> = new Map();
  private entityHandlers: Map<NodeType, EntityHandler> = new Map();
  private routingActions: Map<
    NodeType,
    Map<string, WorkerPluginRouterAction | ((...args: any[]) => Promise<any>)>
  > = new Map();
  // private nodeTypeConfigs: Map<TreeNodeType, NodeTypeConfig> = new Map();

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // No parent constructor to call
  }

  /**
   * Get singleton instance
   */
  static getInstance(): NodeRegistry {
    if (!NodeRegistry.instance) {
      NodeRegistry.instance = new NodeRegistry();
    }
    return NodeRegistry.instance;
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static resetInstance(): void {
    NodeRegistry.instance = null;
  }

  /**
   * Register a unified plugin definition
   */
  registerPlugin<
    TEntity extends import('./plugin').PeerEntity,
    TGroupEntity extends import('./plugin').GroupEntity,
    TWorkingCopy extends TEntity & WorkingCopyProperties,
  >(definition: PluginDefinition<TEntity, TGroupEntity, TWorkingCopy>): void {
    const { nodeType } = definition;

    // Check for duplicate registration
    if (this.pluginDefinitions.has(nodeType)) {
      workerWarn(`Plugin type ${nodeType} is already registered. Skipping...`);
      return; // Continue processing (warning level)
    }

    // Validate dependencies
    if (definition.meta?.dependencies) {
      for (const dep of definition.meta.dependencies) {
        if (!this.pluginDefinitions.has(dep as NodeType)) {
          // Error level - should rollback
          throw new Error(`Missing dependency: ${dep} for plugin ${nodeType}`);
        }
      }
    }

    // Register the plugin definition
    this.pluginDefinitions.set(nodeType, definition as unknown as PluginDefinition);

    // Register entity handler
    if (definition.entityHandler) {
      this.entityHandlers.set(nodeType, definition.entityHandler as unknown as EntityHandler);
    }

    // Register routing actions
    if (definition.routing?.actions) {
      const actions = new Map<
        string,
        WorkerPluginRouterAction | ((...args: any[]) => Promise<any>)
      >();
      for (const [actionName, action] of Object.entries(definition.routing.actions)) {
        actions.set(actionName, action);
      }
      this.routingActions.set(nodeType, actions);
    }

    // Store definition in pluginDefinitions map
    // (No base registry to store in since we don't extend BaseNodeTypeRegistry)

    // Log successful registration in development
    if (process.env.NODE_ENV === 'development') {
      workerLog(`Plugin registered: ${nodeType} (${definition.name}) v${definition.meta?.version}`);
    }
  }

  /**
   * Generic register method
   */
  register(_nodeType: NodeType, config: NodeTypeConfig): void {
    if (this.isPluginDefinition(config)) {
      this.registerPlugin(config);
    } else {
      throw new Error('NodeRegistry only accepts PluginDefinition');
    }
  }

  /**
   * Get plugin (generic method for interface)
   */
  getPlugin(nodeType: NodeType): PluginDefinition | undefined {
    return this.getPluginDefinition(nodeType);
  }

  /**
   * Get plugin definition
   */
  getPluginDefinition(nodeType: NodeType): PluginDefinition | undefined {
    if (!nodeType) {
      throw new Error('nodeType cannot be null or undefined');
    }
    return this.pluginDefinitions.get(nodeType);
  }

  /**
   * Get entity handler for a node type
   */
  getEntityHandler(nodeType: NodeType): EntityHandler | undefined {
    if (!nodeType) {
      throw new Error('nodeType cannot be null or undefined');
    }
    return this.entityHandlers.get(nodeType);
  }

  /**
   * Get router action for a specific action name
   */
  getRouterAction(
    nodeType: NodeType,
    action: string
  ): WorkerPluginRouterAction | ((...args: any[]) => Promise<any>) | undefined {
    if (!nodeType || !action) {
      throw new Error('nodeType and action cannot be null or undefined');
    }
    const actions = this.routingActions.get(nodeType);
    return actions?.get(action);
  }

  /**
   * Get all available actions for a node type
   */
  getAvailableActions(nodeType: NodeType): string[] {
    if (!nodeType) {
      throw new Error('nodeType cannot be null or undefined');
    }
    const actions = this.routingActions.get(nodeType);
    return actions ? Array.from(actions.keys()) : [];
  }

  /**
   * Find plugins by tag
   */
  findPluginsByTag(tag: string): PluginDefinition[] {
    if (!tag) {
      return [];
    }

    return Array.from(this.pluginDefinitions.values()).filter(
      (definition) => definition.meta?.tags?.includes(tag) ?? false
    );
  }

  /**
   * Get plugin dependencies
   */
  getPluginDependencies(nodeType: NodeType): string[] {
    if (!nodeType) {
      throw new Error('nodeType cannot be null or undefined');
    }
    const definition = this.getPluginDefinition(nodeType);
    return definition?.meta?.dependencies ?? [];
  }

  /**
   * Validate plugin dependencies
   */
  validatePluginDependencies(nodeType: NodeType): boolean {
    const dependencies = this.getPluginDependencies(nodeType);

    for (const dep of dependencies) {
      if (!this.pluginDefinitions.has(dep as NodeType)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): PluginDefinition[] {
    return Array.from(this.pluginDefinitions.values());
  }

  /**
   * Get node type config for compatibility
   */
  getNodeTypeConfig(nodeType: NodeType): NodeTypeConfig | undefined {
    const definition = this.getPluginDefinition(nodeType);
    if (!definition) return undefined;

    return {
      displayName: definition.displayName,
      icon: definition.ui?.iconComponentPath ? 'custom' : undefined,
      allowedChildren: definition.validation?.allowedChildTypes,
      maxChildren: definition.validation?.maxChildren,
      canBeDeleted: true,
      canBeRenamed: true,
      canBeMoved: true,
    };
  }

  /**
   * Get all node types for compatibility
   */
  getAllNodeTypes(): NodeType[] {
    return Array.from(this.pluginDefinitions.keys());
  }

  /**
   * Get all node types (alias for getAllNodeTypes)
   */
  getAll(): NodeType[] {
    return this.getAllNodeTypes();
  }

  /**
   * Get plugins sorted by their dependencies (topological sort)
   */
  getPluginsInDependencyOrder(): PluginDefinition[] {
    const visited = new Set<NodeType>();
    const result: PluginDefinition[] = [];

    const visit = (nodeType: NodeType): void => {
      if (visited.has(nodeType)) {
        return;
      }

      visited.add(nodeType);
      const definition = this.getPluginDefinition(nodeType);

      if (definition) {
        // Visit dependencies first
        const dependencies = definition.meta?.dependencies ?? [];
        for (const dep of dependencies) {
          visit(dep as NodeType);
        }

        result.push(definition);
      }
    };

    // Visit all plugins
    for (const nodeType of this.pluginDefinitions.keys()) {
      visit(nodeType);
    }

    return result;
  }

  /**
   * Clear all registrations (useful for testing)
   */
  clear(): void {
    // Clear all internal maps
    this.pluginDefinitions.clear();
    this.entityHandlers.clear();
    this.routingActions.clear();
  }

  /**
   * Validate plugin dependencies
   */
  validateDependencies(nodeType: NodeType): boolean {
    const definition = this.pluginDefinitions.get(nodeType);
    if (!definition || !definition.meta?.dependencies) {
      return true;
    }

    for (const dep of definition.meta.dependencies) {
      if (!this.pluginDefinitions.has(dep as NodeType)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Unregister a plugin
   */
  unregister(nodeType: NodeType): void {
    this.pluginDefinitions.delete(nodeType);
    this.entityHandlers.delete(nodeType);
    this.routingActions.delete(nodeType);
  }

  /**
   * Get a plugin definition (alias for getPluginDefinition)
   */
  get(nodeType: NodeType): PluginDefinition | undefined {
    return this.getPluginDefinition(nodeType);
  }

  /**
   * Check if a plugin is registered
   */
  has(nodeType: NodeType): boolean {
    return this.pluginDefinitions.has(nodeType);
  }

  /**
   * Type guard to check if config is PluginDefinition
   */
  private isPluginDefinition(config: any): config is PluginDefinition {
    return (
      config &&
      typeof config === 'object' &&
      'nodeType' in config &&
      'entityHandler' in config &&
      'routing' in config &&
      'meta' in config
    );
  }

  /**
   * Batch register multiple plugins
   */
  registerPluginBatch(definitions: PluginDefinition[]): void {
    // Sort by dependencies first
    const sorted = this.sortByDependencies(definitions);

    // Register in order
    for (const definition of sorted) {
      this.registerPlugin(definition);
    }
  }

  /**
   * Sort plugins by dependencies
   */
  private sortByDependencies(definitions: PluginDefinition[]): PluginDefinition[] {
    const nodeTypeMap = new Map(definitions.map((d) => [d.nodeType, d]));
    const visited = new Set<NodeType>();
    const result: PluginDefinition[] = [];

    const visit = (definition: PluginDefinition): void => {
      if (visited.has(definition.nodeType)) {
        return;
      }

      visited.add(definition.nodeType);

      // Visit dependencies first
      const dependencies = definition.meta?.dependencies ?? [];
      for (const dep of dependencies) {
        const depDefinition = nodeTypeMap.get(dep as NodeType);
        if (depDefinition) {
          visit(depDefinition);
        }
      }

      result.push(definition);
    };

    // Visit all definitions
    for (const definition of definitions) {
      visit(definition);
    }

    return result;
  }
}
