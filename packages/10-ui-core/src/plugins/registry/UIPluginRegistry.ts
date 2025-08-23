import type { UIPluginDefinition } from '../types';

/**
 * UI Plugin Registry
 *
 * Central registry for managing UI plugins in the HierarchiDB system.
 * Provides registration, validation, and retrieval of plugins.
 */
export class UIPluginRegistry {
  private static instance: UIPluginRegistry | null = null;
  private readonly plugins = new Map<string, UIPluginDefinition>();

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  /**
   * Get the singleton instance of the registry
   */
  static getInstance(): UIPluginRegistry {
    if (!UIPluginRegistry.instance) {
      UIPluginRegistry.instance = new UIPluginRegistry();
    }
    return UIPluginRegistry.instance;
  }

  /**
   * Register a new UI plugin
   *
   * @param plugin - The plugin definition to register
   * @throws Error if the plugin is invalid or already registered
   */
  register(plugin: UIPluginDefinition): void {
    this.validatePlugin(plugin);

    if (this.plugins.has(plugin.nodeType)) {
      throw new Error(`Plugin with nodeType '${plugin.nodeType}' is already registered`);
    }

    this.plugins.set(plugin.nodeType, plugin);

    console.log(`UI Plugin registered: ${plugin.nodeType} (${plugin.displayName})`);
  }

  /**
   * Get a plugin by node type
   *
   * @param nodeType - The node type to look up
   * @returns The plugin definition or undefined if not found
   */
  get(nodeType: string): UIPluginDefinition | undefined {
    return this.plugins.get(nodeType);
  }

  /**
   * Get all registered plugins
   *
   * @returns Array of all plugin definitions
   */
  getAll(): readonly UIPluginDefinition[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugins by group
   *
   * @param group - The group to filter by
   * @returns Array of plugins in the specified group
   */
  getByGroup(group: string): readonly UIPluginDefinition[] {
    return this.getAll().filter((plugin) => plugin.menu.group === group);
  }

  /**
   * Get plugins that can be created
   *
   * @returns Array of plugins with create capability
   */
  getCreatablePlugins(): readonly UIPluginDefinition[] {
    return this.getAll().filter((plugin) => plugin.capabilities.canCreate);
  }

  /**
   * Get plugins sorted by create order
   *
   * @returns Array of plugins sorted by create order
   */
  getPluginsByCreateOrder(): readonly UIPluginDefinition[] {
    return this.getAll()
      .slice() // Create a copy to avoid mutating the original
      .sort((a, b) => a.menu.createOrder - b.menu.createOrder);
  }

  /**
   * Check if a plugin is registered for a node type
   *
   * @param nodeType - The node type to check
   * @returns True if the plugin is registered
   */
  isRegistered(nodeType: string): boolean {
    return this.plugins.has(nodeType);
  }

  /**
   * Unregister a plugin
   *
   * @param nodeType - The node type to unregister
   * @returns True if the plugin was unregistered, false if it wasn't registered
   */
  unregister(nodeType: string): boolean {
    const deleted = this.plugins.delete(nodeType);
    if (deleted) {
      console.log(`UI Plugin unregistered: ${nodeType}`);
    }
    return deleted;
  }

  /**
   * Clear all registered plugins
   */
  clear(): void {
    const count = this.plugins.size;
    this.plugins.clear();
    console.log(`All UI plugins cleared (${count} plugins)`);
  }

  /**
   * Get registration statistics
   *
   * @returns Object with plugin statistics
   */
  getStatistics(): {
    readonly total: number;
    readonly byGroup: Record<string, number>;
    readonly withEntityData: number;
    readonly creatable: number;
  } {
    const plugins = this.getAll();
    const byGroup: Record<string, number> = {};

    for (const plugin of plugins) {
      byGroup[plugin.menu.group] = (byGroup[plugin.menu.group] || 0) + 1;
    }

    return {
      total: plugins.length,
      byGroup,
      withEntityData: plugins.filter((p) => p.dataSource.requiresEntity).length,
      creatable: plugins.filter((p) => p.capabilities.canCreate).length,
    };
  }

  /**
   * Validate a plugin definition
   *
   * @param plugin - The plugin to validate
   * @throws Error if the plugin is invalid
   */
  private validatePlugin(plugin: UIPluginDefinition): void {
    // Basic required fields
    if (!plugin.nodeType) {
      throw new Error('Plugin must have a nodeType');
    }

    if (typeof plugin.nodeType !== 'string' || plugin.nodeType.trim() === '') {
      throw new Error('Plugin nodeType must be a non-empty string');
    }

    if (!plugin.displayName) {
      throw new Error('Plugin must have a displayName');
    }

    if (typeof plugin.displayName !== 'string' || plugin.displayName.trim() === '') {
      throw new Error('Plugin displayName must be a non-empty string');
    }

    // Components validation
    if (!plugin.components || !plugin.components.icon) {
      throw new Error('Plugin must have an icon component');
    }

    if (typeof plugin.components.icon !== 'function') {
      throw new Error('Plugin icon must be a React component');
    }

    // Data source validation
    if (typeof plugin.dataSource !== 'object' || plugin.dataSource === null) {
      throw new Error('Plugin must have a dataSource configuration');
    }

    if (typeof plugin.dataSource.requiresEntity !== 'boolean') {
      throw new Error('Plugin dataSource.requiresEntity must be a boolean');
    }

    if (plugin.dataSource.requiresEntity && !plugin.dataSource.entityType) {
      throw new Error('Plugin with requiresEntity=true must specify entityType');
    }

    // Capabilities validation
    if (typeof plugin.capabilities !== 'object' || plugin.capabilities === null) {
      throw new Error('Plugin must have capabilities configuration');
    }

    const requiredCapabilities = [
      'canCreate',
      'canRead',
      'canUpdate',
      'canDelete',
      'canHaveChildren',
      'canMove',
      'supportsWorkingCopy',
      'supportsVersioning',
      'supportsExport',
      'supportsBulkOperations',
    ];

    for (const capability of requiredCapabilities) {
      if (
        typeof plugin.capabilities[capability as keyof typeof plugin.capabilities] !== 'boolean'
      ) {
        throw new Error(`Plugin capability '${capability}' must be a boolean`);
      }
    }

    // Menu validation
    if (typeof plugin.menu !== 'object' || plugin.menu === null) {
      throw new Error('Plugin must have menu configuration');
    }

    if (typeof plugin.menu.createOrder !== 'number') {
      throw new Error('Plugin menu.createOrder must be a number');
    }

    const validGroups = ['basic', 'container', 'document', 'advanced'];
    if (!validGroups.includes(plugin.menu.group)) {
      throw new Error(`Plugin menu.group must be one of: ${validGroups.join(', ')}`);
    }

    // Hooks validation (basic structure check)
    if (typeof plugin.hooks !== 'object' || plugin.hooks === null) {
      throw new Error('Plugin must have hooks configuration');
    }

    // Style validation (optional)
    if (plugin.style !== undefined) {
      if (typeof plugin.style !== 'object' || plugin.style === null) {
        throw new Error('Plugin style must be an object if provided');
      }
    }
  }
}

/**
 * Convenience function to get the singleton registry instance
 */
export function getUIPluginRegistry(): UIPluginRegistry {
  return UIPluginRegistry.getInstance();
}
