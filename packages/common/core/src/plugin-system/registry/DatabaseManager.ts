/**
 * @file IPluginDatabaseManager.ts
 * @description Interface for plugin database management
 */

import { NodeType, PluginDatabaseConfig } from '@hierarchidb/common-type';

/**
 * Interface for plugin database operations
 */
export interface IPluginDatabaseManager {
  /**
   * Register a plugin database
   */
  registerPluginDatabase(
    nodeType: NodeType,
    config: PluginDatabaseConfig,
    dependencies?: NodeType[]
  ): Promise<any>;

  /**
   * Unregister a plugin database
   */
  unregisterPluginDatabase(
    nodeType: NodeType,
    options?: {
      clearData?: boolean;
      dropDatabase?: boolean;
    }
  ): Promise<void>;

  /**
   * Get plugin database
   */
  getPluginDatabase(nodeType: NodeType): any;

  /**
   * Get dependency database for a plugin
   */
  getDependencyDatabase(nodeType: NodeType, dependencyType: NodeType): any;

  /**
   * Clear all databases
   */
  clearAll(): Promise<void>;
}