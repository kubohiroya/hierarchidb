/**
 * @file PluginRegistryAPIImpl.ts
 * @description Implementation of PluginRegistryAPI for Worker layer
 */

import type { PluginRegistryAPI, PluginInfo } from '@hierarchidb/common-api';
import type { NodeType, PluginIntegrated } from '@hierarchidb/common-type';
import type { PluginRegistryFacade } from '@hierarchidb/runtime-worker-plugin-registry';

/**
 * Plugin Registry API Implementation
 * 
 * Provides read-only access to plugin registration information.
 * Exposes plugin metadata, dependencies, and load order to clients.
 */
export class PluginRegistryAPIImpl implements PluginRegistryAPI {
  constructor(
    private registry: PluginRegistryFacade,
    private integratedPlugins: Map<NodeType, PluginIntegrated>,
    private loadOrder: NodeType[]
  ) {}

  /**
   * Get list of all registered plugins
   */
  async getRegisteredPlugins(): Promise<PluginInfo[]> {
    const plugins: PluginInfo[] = [];
    
    // Build plugin info from integrated plugins map
    for (const [nodeType, plugin] of this.integratedPlugins) {
      plugins.push({
        nodeType,
        name: plugin.name,
        displayName: plugin.displayName || plugin.name,
        version: plugin.version || '1.0.0',
        status: 'active', // All loaded plugins are active
        dependencies: plugin.dependencies || [],
        priority: plugin.priority || 0,
      });
    }
    
    // Sort by load order
    plugins.sort((a, b) => {
      const indexA = this.loadOrder.indexOf(a.nodeType);
      const indexB = this.loadOrder.indexOf(b.nodeType);
      return indexA - indexB;
    });
    
    return plugins;
  }

  /**
   * Get information for a specific plugin
   */
  async getPluginInfo(nodeType: NodeType): Promise<PluginInfo | null> {
    const plugin = this.integratedPlugins.get(nodeType);
    
    if (!plugin) {
      return null;
    }
    
    return {
      nodeType,
      name: plugin.name,
      displayName: plugin.displayName || plugin.name,
      version: plugin.version || '1.0.0',
      status: 'active',
      dependencies: plugin.dependencies || [],
      priority: plugin.priority || 0,
    };
  }

  /**
   * Get plugin load order
   */
  async getPluginLoadOrder(): Promise<NodeType[]> {
    return [...this.loadOrder]; // Return a copy
  }

  /**
   * Get dependencies for a specific plugin
   */
  async getPluginDependencies(nodeType: NodeType): Promise<string[]> {
    const plugin = this.integratedPlugins.get(nodeType);
    
    if (!plugin) {
      return [];
    }
    
    const dependencies: Set<string> = new Set();
    
    // Add explicit dependencies
    if (plugin.dependencies) {
      plugin.dependencies.forEach(dep => dependencies.add(dep));
    }
    
    // Add extends (inheritance) as implicit dependency
    if (plugin.extends) {
      dependencies.add(plugin.extends);
    }
    
    return Array.from(dependencies);
  }

  /**
   * Check if a plugin is registered
   */
  async isPluginRegistered(nodeType: NodeType): Promise<boolean> {
    return this.integratedPlugins.has(nodeType);
  }

  /**
   * Get total count of registered plugins
   */
  async getPluginCount(): Promise<number> {
    return this.integratedPlugins.size;
  }
}