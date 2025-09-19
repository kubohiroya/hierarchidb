import type { UIPluginDefinition } from '../types.js';
/**
 * UI Plugin Registry
 *
 * Central registry for managing UI plugins in the HierarchiDB system.
 * Provides registration, validation, and retrieval of plugins.
 */
export declare class UIPluginRegistry {
    private static instance;
    private readonly plugins;
    private constructor();
    /**
     * Get the singleton instance of the registry
     */
    static getInstance(): UIPluginRegistry;
    /**
     * Register a new UI plugin
     *
     * @param plugin - The plugin definition to register
     * @throws Error if the plugin is invalid or already registered
     */
    register(plugin: UIPluginDefinition): void;
    /**
     * Get a plugin by node type
     *
     * @param nodeType - The node type to look up
     * @returns The plugin definition or undefined if not found
     */
    get(nodeType: string): UIPluginDefinition | undefined;
    /**
     * Get all registered plugins
     *
     * @returns Array of all plugin definitions
     */
    getAll(): readonly UIPluginDefinition[];
    /**
     * Get plugins by group
     *
     * @param group - The group to filter by
     * @returns Array of plugins in the specified group
     */
    getByGroup(group: string): readonly UIPluginDefinition[];
    /**
     * Get plugins that can be created
     *
     * @returns Array of plugins with create capability
     */
    getCreatablePlugins(): readonly UIPluginDefinition[];
    /**
     * Get plugins sorted by create order
     *
     * @returns Array of plugins sorted by create order
     */
    getPluginsByCreateOrder(): readonly UIPluginDefinition[];
    /**
     * Check if a plugin is registered for a node type
     *
     * @param nodeType - The node type to check
     * @returns True if the plugin is registered
     */
    isRegistered(nodeType: string): boolean;
    /**
     * Unregister a plugin
     *
     * @param nodeType - The node type to unregister
     * @returns True if the plugin was unregistered, false if it wasn't registered
     */
    unregister(nodeType: string): boolean;
    /**
     * Clear all registered plugins
     */
    clear(): void;
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
    };
    /**
     * Validate a plugin definition
     *
     * @param plugin - The plugin to validate
     * @throws Error if the plugin is invalid
     */
    private validatePlugin;
}
/**
 * Convenience function to get the singleton registry instance
 */
export declare function getUIPluginRegistry(): UIPluginRegistry;
//# sourceMappingURL=UIPluginRegistry.d.ts.map