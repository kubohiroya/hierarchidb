/**
 * @file NodeRegistry.ts
 * @description Extended NodeTypeRegistry with PluginDefinition support
 * Singleton pattern implementation for centralized plugin management
 * References: docs/7-aop-architecture.md, ../eria-cartograph/app0/src/shared/services/ResourceDefinitionRegistry.ts
 */

import type {
  EntityHandler,
  NodeType,
  PluginDefinition,
  PluginIntegrated,
  WorkerPluginRouterAction,
} from '@hierarchidb/common-type';

// Simple logging functions to replace workerLogger
const workerLog = console.log;
const workerWarn = console.warn;
import type { NodeTypeConfig } from './types';

/**
 * PluginRegistry
 */
export class PluginRegistry {
  private static instance: PluginRegistry | null = null;
  private pluginDefinitions: Map<NodeType, PluginIntegrated> = new Map();
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
  static getInstance(): PluginRegistry {
    if (!PluginRegistry.instance) {
      PluginRegistry.instance = new PluginRegistry();
    }
    return PluginRegistry.instance;
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static resetInstance(): void {
    PluginRegistry.instance = null;
  }

  /**
   * Register a unified plugin definition
   */
  registerPlugin(definition: PluginIntegrated): void {
    const { nodeType } = definition;

    // Check for duplicate registration
    if (this.pluginDefinitions.has(nodeType)) {
      workerWarn(`Plugin type ${nodeType} is already registered. Skipping...`);
      return; // Continue processing (warning level)
    }

    // Validate dependencies
    if (definition.dependencies) {
      for (const dep of definition.dependencies) {
        if (!this.pluginDefinitions.has(dep as NodeType)) {
          // Error level - should rollback
          throw new Error(`Missing dependency: ${dep} for plugin ${nodeType}`);
        }
      }
    }

    // Register the plugin definition
    this.pluginDefinitions.set(nodeType, definition);

    // Register entity handler
    if (definition.entityHandler) {
      this.entityHandlers.set(nodeType, definition.entityHandler);
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
      workerLog(`Plugin registered: ${nodeType} (${definition.name}) v${definition.version}`);
    }
  }

  /**
   * Get plugin (generic method for interface)
   */
  getPlugin(nodeType: NodeType): PluginIntegrated | undefined {
    return this.getPluginDefinition(nodeType);
  }

  /**
   * Get plugin definition
   */
  getPluginDefinition(nodeType: NodeType): PluginIntegrated | undefined {
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
   * Get plugin dependencies
   */
  getPluginDependencies(nodeType: NodeType): string[] {
    if (!nodeType) {
      throw new Error('nodeType cannot be null or undefined');
    }
    const definition = this.getPluginDefinition(nodeType);
    return definition?.dependencies ?? [];
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
  getAllPlugins(): PluginIntegrated[] {
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
        const dependencies = definition.dependencies ?? [];
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
    if (!definition || !definition.dependencies) {
      return true;
    }

    for (const dep of definition.dependencies) {
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
   * Batch register multiple plugins
   */
  registerPluginBatch(plugins: PluginIntegrated[]): void {
    // Sort by dependencies first
    const sorted = this.sortByDependencies(plugins);

    // Register in order
    for (const plugin of sorted) {
      this.registerPlugin(plugin);
    }
  }

  /**
   * Sort plugins by dependencies
   */
  private sortByDependencies(plugins: PluginIntegrated[]): PluginIntegrated[] {
    const nodeTypeMap = new Map<NodeType, PluginIntegrated>(plugins.map((d) => [d.nodeType, d]));
    const visited = new Set<NodeType>();
    const result: PluginIntegrated[] = [];

    const visit = (plugin: PluginIntegrated): void => {
      if (visited.has(plugin.nodeType)) {
        return;
      }

      visited.add(plugin.nodeType);

      // Visit dependencies first
      const dependencies = plugin.dependencies ?? [];
      for (const dep of dependencies) {
        const depDefinition = nodeTypeMap.get(dep as NodeType);
        if (depDefinition) {
          visit(depDefinition);
        }
      }

      result.push(plugin);
    };

    // Visit all definitions
    for (const plugin of plugins) {
      visit(plugin);
    }

    return result;
  }
}
