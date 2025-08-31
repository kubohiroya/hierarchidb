/**
 * @file PluginRegistryAPI.ts
 * @description Plugin registry query API for client-side access to plugin information
 */

import type { NodeType } from '@hierarchidb/common-type';

/**
 * Plugin information exposed to clients
 */
export interface PluginInfo {
  nodeType: NodeType;
  name: string;
  displayName: string;
  version: string;
  status: 'active' | 'inactive' | 'error';
  dependencies: string[];
  priority: number;
}

/**
 * Plugin Registry API
 * 
 * Provides read-only access to plugin registration information from the Worker.
 * Used by UI layer to query plugin status, dependencies, and capabilities.
 * 
 * @example
 * ```typescript
 * const api = worker.getPluginRegistryAPI();
 * const plugins = await api.getRegisteredPlugins();
 * ```
 */
export interface PluginRegistryAPI {
  /**
   * Get list of all registered plugins
   * 
   * @returns Array of plugin information sorted by load order
   * 
   * @example
   * ```typescript
   * const plugins = await api.getRegisteredPlugins();
   * console.log(`Loaded ${plugins.length} plugins`);
   * ```
   */
  getRegisteredPlugins(): Promise<PluginInfo[]>;

  /**
   * Get information for a specific plugin
   * 
   * @param nodeType - Node type identifier of the plugin
   * @returns Plugin information or null if not found
   * 
   * @example
   * ```typescript
   * const info = await api.getPluginInfo('folder-plugin' as NodeType);
   * if (info) {
   *   console.log(`Plugin version: ${info.version}`);
   * }
   * ```
   */
  getPluginInfo(nodeType: NodeType): Promise<PluginInfo | null>;

  /**
   * Get plugin load order
   * 
   * Returns the order in which plugins were loaded, respecting dependencies.
   * 
   * @returns Array of node types in load order
   * 
   * @example
   * ```typescript
   * const order = await api.getPluginLoadOrder();
   * console.log('First loaded:', order[0]);
   * ```
   */
  getPluginLoadOrder(): Promise<NodeType[]>;

  /**
   * Get dependencies for a specific plugin
   * 
   * @param nodeType - Node type identifier of the plugin
   * @returns Array of dependency node types
   * 
   * @example
   * ```typescript
   * const deps = await api.getPluginDependencies('shape-plugin' as NodeType);
   * console.log('Dependencies:', deps);
   * ```
   */
  getPluginDependencies(nodeType: NodeType): Promise<string[]>;

  /**
   * Check if a plugin is registered
   * 
   * @param nodeType - Node type identifier to check
   * @returns True if the plugin is registered
   * 
   * @example
   * ```typescript
   * const isRegistered = await api.isPluginRegistered('folder-plugin' as NodeType);
   * ```
   */
  isPluginRegistered(nodeType: NodeType): Promise<boolean>;

  /**
   * Get total count of registered plugins
   * 
   * @returns Number of registered plugins
   * 
   * @example
   * ```typescript
   * const count = await api.getPluginCount();
   * console.log(`Total plugins: ${count}`);
   * ```
   */
  getPluginCount(): Promise<number>;
}