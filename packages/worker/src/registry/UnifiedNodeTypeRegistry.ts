/**
 * @file UnifiedNodeTypeRegistry.ts
 * @description Extended NodeTypeRegistry with UnifiedPluginDefinition support
 * Singleton pattern implementation for centralized plugin management
 * References: docs/7-aop-architecture.md, ../eria-cartograph/app0/src/shared/services/ResourceDefinitionRegistry.ts
 */

import type { TreeNodeType, TreeNodeId } from '@hierarchidb/core';
import type { INodeTypeRegistry, IPluginRegistry } from '@hierarchidb/core';
import type { NodeTypeConfig } from './types';
import type {
  BaseEntity,
  BaseSubEntity,
  BaseWorkingCopy,
  UnifiedPluginDefinition,
  EntityHandler,
  WorkerPluginRouterAction,
} from './types/unified-plugin';
import { workerWarn, workerLog } from '../utils/workerLogger';

/**
 * Extended registry interface with UnifiedPluginDefinition support
 */
export interface IUnifiedNodeTypeRegistry extends IPluginRegistry {
  // Plugin registration
  registerPlugin<
    TEntity extends BaseEntity,
    TSubEntity extends BaseSubEntity,
    TWorkingCopy extends BaseWorkingCopy,
  >(
    definition: UnifiedPluginDefinition<TEntity, TSubEntity, TWorkingCopy>
  ): void;

  // Plugin retrieval
  getPluginDefinition(nodeType: TreeNodeType): UnifiedPluginDefinition | undefined;
  getEntityHandler(nodeType: TreeNodeType): EntityHandler | undefined;

  // Router actions
  getRouterAction(nodeType: TreeNodeType, action: string): WorkerPluginRouterAction | undefined;
  getAvailableActions(nodeType: TreeNodeType): string[];

  // Plugin search
  findPluginsByTag(tag: string): UnifiedPluginDefinition[];
  getPluginDependencies(nodeType: TreeNodeType): string[];

  // Plugin validation
  validatePluginDependencies(nodeType: TreeNodeType): boolean;
  getAllPlugins(): UnifiedPluginDefinition[];
}

/**
 * Unified NodeTypeRegistry with plugin support
 * Complete plugin registry implementation
 */
export class UnifiedNodeTypeRegistry implements IUnifiedNodeTypeRegistry {
  private static unifiedInstance: UnifiedNodeTypeRegistry | null = null;
  private pluginDefinitions: Map<TreeNodeType, UnifiedPluginDefinition> = new Map();
  private entityHandlers: Map<TreeNodeType, EntityHandler> = new Map();
  private routingActions: Map<TreeNodeType, Map<string, WorkerPluginRouterAction>> = new Map();
  private nodeTypeConfigs: Map<TreeNodeType, NodeTypeConfig> = new Map();

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // No parent constructor to call
  }

  /**
   * Get singleton instance
   */
  static getInstance(): UnifiedNodeTypeRegistry {
    if (!UnifiedNodeTypeRegistry.unifiedInstance) {
      UnifiedNodeTypeRegistry.unifiedInstance = new UnifiedNodeTypeRegistry();
    }
    return UnifiedNodeTypeRegistry.unifiedInstance;
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static resetInstance(): void {
    UnifiedNodeTypeRegistry.unifiedInstance = null;
  }

  /**
   * Register a unified plugin definition
   */
  registerPlugin<
    TEntity extends import('./types/unified-plugin').BaseEntity,
    TSubEntity extends import('./types/unified-plugin').BaseSubEntity,
    TWorkingCopy extends import('./types/unified-plugin').BaseWorkingCopy,
  >(definition: UnifiedPluginDefinition<TEntity, TSubEntity, TWorkingCopy>): void {
    const { nodeType } = definition;

    // Check for duplicate registration
    if (this.pluginDefinitions.has(nodeType)) {
      workerWarn(`Plugin type ${nodeType} is already registered. Skipping...`);
      return; // Continue processing (warning level)
    }

    // Validate dependencies
    if (definition.meta?.dependencies) {
      for (const dep of definition.meta.dependencies) {
        if (!this.pluginDefinitions.has(dep as TreeNodeType)) {
          // Error level - should rollback
          throw new Error(`Missing dependency: ${dep} for plugin ${nodeType}`);
        }
      }
    }

    // Register the plugin definition
    this.pluginDefinitions.set(nodeType, definition as UnifiedPluginDefinition);

    // Register entity handler
    if (definition.entityHandler) {
      this.entityHandlers.set(nodeType, definition.entityHandler as EntityHandler);
    }

    // Register routing actions
    if (definition.routing?.actions) {
      const actions = new Map<string, WorkerPluginRouterAction>();
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
  register(nodeType: TreeNodeType, config: any): void {
    if (this.isUnifiedPluginDefinition(config)) {
      this.registerPlugin(config);
    } else {
      throw new Error('UnifiedNodeTypeRegistry only accepts UnifiedPluginDefinition');
    }
  }

  /**
   * Get plugin (generic method for interface)
   */
  getPlugin(nodeType: TreeNodeType): UnifiedPluginDefinition | undefined {
    return this.getPluginDefinition(nodeType);
  }

  /**
   * Get plugin definition
   */
  getPluginDefinition(nodeType: TreeNodeType): UnifiedPluginDefinition | undefined {
    if (!nodeType) {
      throw new Error('nodeType cannot be null or undefined');
    }
    return this.pluginDefinitions.get(nodeType);
  }

  /**
   * Get entity handler for a node type
   */
  getEntityHandler(nodeType: TreeNodeType): EntityHandler | undefined {
    if (!nodeType) {
      throw new Error('nodeType cannot be null or undefined');
    }
    return this.entityHandlers.get(nodeType);
  }

  /**
   * Get router action for a specific action name
   */
  getRouterAction(nodeType: TreeNodeType, action: string): WorkerPluginRouterAction | undefined {
    if (!nodeType || !action) {
      throw new Error('nodeType and action cannot be null or undefined');
    }
    const actions = this.routingActions.get(nodeType);
    return actions?.get(action);
  }

  /**
   * Get all available actions for a node type
   */
  getAvailableActions(nodeType: TreeNodeType): string[] {
    if (!nodeType) {
      throw new Error('nodeType cannot be null or undefined');
    }
    const actions = this.routingActions.get(nodeType);
    return actions ? Array.from(actions.keys()) : [];
  }

  /**
   * Find plugins by tag
   */
  findPluginsByTag(tag: string): UnifiedPluginDefinition[] {
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
  getPluginDependencies(nodeType: TreeNodeType): string[] {
    if (!nodeType) {
      throw new Error('nodeType cannot be null or undefined');
    }
    const definition = this.getPluginDefinition(nodeType);
    return definition?.meta?.dependencies ?? [];
  }

  /**
   * Validate plugin dependencies
   */
  validatePluginDependencies(nodeType: TreeNodeType): boolean {
    const dependencies = this.getPluginDependencies(nodeType);

    for (const dep of dependencies) {
      if (!this.pluginDefinitions.has(dep as TreeNodeType)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): UnifiedPluginDefinition[] {
    return Array.from(this.pluginDefinitions.values());
  }

  /**
   * Get node type config for compatibility
   */
  getNodeTypeConfig(nodeType: TreeNodeType): NodeTypeConfig | undefined {
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
  getAllNodeTypes(): TreeNodeType[] {
    return Array.from(this.pluginDefinitions.keys());
  }

  /**
   * Get all node types (alias for getAllNodeTypes)
   */
  getAll(): TreeNodeType[] {
    return this.getAllNodeTypes();
  }

  /**
   * Get plugins sorted by their dependencies (topological sort)
   */
  getPluginsInDependencyOrder(): UnifiedPluginDefinition[] {
    const visited = new Set<TreeNodeType>();
    const result: UnifiedPluginDefinition[] = [];

    const visit = (nodeType: TreeNodeType): void => {
      if (visited.has(nodeType)) {
        return;
      }

      visited.add(nodeType);
      const definition = this.getPluginDefinition(nodeType);

      if (definition) {
        // Visit dependencies first
        const dependencies = definition.meta?.dependencies ?? [];
        for (const dep of dependencies) {
          visit(dep as TreeNodeType);
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
  validateDependencies(nodeType: TreeNodeType): boolean {
    const definition = this.pluginDefinitions.get(nodeType);
    if (!definition || !definition.meta?.dependencies) {
      return true;
    }

    for (const dep of definition.meta.dependencies) {
      if (!this.pluginDefinitions.has(dep as TreeNodeType)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Unregister a plugin
   */
  unregister(nodeType: TreeNodeType): void {
    this.pluginDefinitions.delete(nodeType);
    this.entityHandlers.delete(nodeType);
    this.routingActions.delete(nodeType);
  }

  /**
   * Get a plugin definition (alias for getPluginDefinition)
   */
  get(nodeType: TreeNodeType): UnifiedPluginDefinition | undefined {
    return this.getPluginDefinition(nodeType);
  }

  /**
   * Check if a plugin is registered
   */
  has(nodeType: TreeNodeType): boolean {
    return this.pluginDefinitions.has(nodeType);
  }

  /**
   * Type guard to check if config is UnifiedPluginDefinition
   */
  private isUnifiedPluginDefinition(config: any): config is UnifiedPluginDefinition {
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
  registerPluginBatch(definitions: UnifiedPluginDefinition[]): void {
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
  private sortByDependencies(definitions: UnifiedPluginDefinition[]): UnifiedPluginDefinition[] {
    const nodeTypeMap = new Map(definitions.map((d) => [d.nodeType, d]));
    const visited = new Set<TreeNodeType>();
    const result: UnifiedPluginDefinition[] = [];

    const visit = (definition: UnifiedPluginDefinition): void => {
      if (visited.has(definition.nodeType)) {
        return;
      }

      visited.add(definition.nodeType);

      // Visit dependencies first
      const dependencies = definition.meta?.dependencies ?? [];
      for (const dep of dependencies) {
        const depDefinition = nodeTypeMap.get(dep as TreeNodeType);
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
