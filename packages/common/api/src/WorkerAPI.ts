/**
 * @file WorkerAPI.ts
 * @description Main facade API that routes requests to specialized APIs
 *
 * This is the reception/front desk API that provides access to all specialized
 * APIs through a single entry point. It follows the facade pattern to simplify
 * client interactions with the worker layer.
 */

import type { TreeQueryAPI } from './TreeQueryAPI';
import type { TreeMutationAPI } from './TreeMutationAPI';
import type { TreeSubscriptionAPI } from './TreeSubscriptionAPI';
import type { PluginRegistryAPI } from './PluginRegistryAPI';
import type { WorkingCopyAPI } from './WorkingCopyAPI';
import type { PluginTreeAPI } from './PluginTreeAPI';
import type { NodeTypeAPI } from './NodeTypeAPI';
import type { PluginManagementAPI } from './PluginManagementAPI';
import type { ProxyMarked } from 'comlink';
import type { Tree, TreeId, TreeNode, NodeId } from '@hierarchidb/common-core';

/**
 * Main worker facade API
 *
 * Acts as the reception desk that provides access to all specialized APIs.
 * This is the single entry point exposed through Comlink.
 */
export interface WorkerAPI {
  /**
   * Get the query API for read-only operations
   *
   * @returns Proxy to the QueryAPI singleton
   *
   * @example
   * ```typescript
   * const queryAPI = await workerAPI.getQueryAPI();
   * const tree = await queryAPI.getTree(treeId);
   * ```
   */
  getQueryAPI(): TreeQueryAPI & ProxyMarked;

  /**
   * Get the mutation API for data modification operations
   *
   * @returns Proxy to the MutationAPI singleton
   *
   * @example
   * ```typescript
   * const mutationAPI = await workerAPI.getMutationAPI();
   * const result = await mutationAPI.createNode({
   *   nodeType: 'folder',
   *   name: 'New Folder'
   * });
   * ```
   */
  getMutationAPI(): TreeMutationAPI & ProxyMarked;

  /**
   * Get the subscription API for real-time monitoring
   *
   * @returns Proxy to the SubscriptionAPI singleton
   *
   * @example
   * ```typescript
   * const subscriptionAPI = await workerAPI.getSubscriptionAPI();
   * const subscriptionId = await subscriptionAPI.subscribeNode(
   *   nodeId,
   *   (event) => console.log('Node changed:', event)
   * );
   * ```
   */
  getSubscriptionAPI(): TreeSubscriptionAPI & ProxyMarked;

  /**
   * Get the plugin registry API for plugin system management
   *
   * @deprecated Use specialized APIs instead: getNodeTypeAPI(), getPluginManagementAPI(), getPluginTreeAPI()
   * 
   * This legacy API will be removed in v2.0. Migration guide:
   * - Node type operations → getNodeTypeAPI()
   * - Plugin management → getPluginManagementAPI()
   * - Tree-specific queries → getPluginTreeAPI()
   */
  getPluginRegistryAPI(): PluginRegistryAPI & ProxyMarked;

  /**
   * Get the working copy API for draft and edit operations
   *
   * @returns Proxy to the WorkingCopyAPI singleton
   *
   * @example
   * ```typescript
   * const workingCopyAPI = await workerAPI.getWorkingCopyAPI();
   * const draft = await workingCopyAPI.createDraftWorkingCopy(
   *   'document',
   *   parentId
   * );
   * ```
   */
  getWorkingCopyAPI(): WorkingCopyAPI & ProxyMarked;

  /**
   * Get Plugin Tree API facade
   * 
   * Provides a clean, type-safe interface for retrieving plugins available
   * for specific trees with filtering and sorting capabilities.
   * 
   * @returns Plugin Tree API facade instance
   * 
   * @example
   * ```typescript
   * const pluginTreeAPI = workerAPI.getPluginTreeAPI();
   * const response = await pluginTreeAPI.getPluginsForTree({
   *   treeId: 'my-tree' as TreeId,
   *   filters: { creatableOnly: true }
   * });
   * ```
   */
  getPluginTreeAPI(): PluginTreeAPI & ProxyMarked;

  /**
   * Get Node Type API facade
   * 
   * Provides focused interface for node type operations and capabilities,
   * separated from plugin management concerns.
   * 
   * @returns Node Type API facade instance
   * 
   * @example
   * ```typescript
   * const nodeTypeAPI = workerAPI.getNodeTypeAPI();
   * const isSupported = await nodeTypeAPI.isSupported('folder');
   * ```
   */
  getNodeTypeAPI(): NodeTypeAPI & ProxyMarked;

  /**
   * Get Plugin Management API facade
   * 
   * Provides comprehensive plugin lifecycle management including registration,
   * validation, and health monitoring.
   * 
   * @returns Plugin Management API facade instance
   * 
   * @example
   * ```typescript
   * const pluginMgmtAPI = workerAPI.getPluginManagementAPI();
   * const result = await pluginMgmtAPI.register(myPluginDefinition);
   * ```
   */
  getPluginManagementAPI(): PluginManagementAPI & ProxyMarked;

  /**
   * Simple ping method for health check
   *
   * Returns a simple response to verify Worker is responsive.
   * This is the simplest possible health check.
   *
   * @returns Promise that resolves to "pong" with timestamp
   */
  ping(): { response: 'pong'; timestamp: number };

  /**
   * Initialize the worker system
   *
   * Sets up databases, services, and plugin registry.
   * Should be called once when the worker starts.
   *
   * @returns Promise that resolves when initialization is complete
   */
  initialize(): Promise<void>;

  /**
   * Cleanup and shutdown the worker system
   *
   * Closes databases, unsubscribes all listeners, and cleans up resources.
   * Should be called before worker termination.
   *
   * @returns Promise that resolves when cleanup is complete
   */
  shutdown(): Promise<void>;

  /**
   * Get system health status
   *
   * Returns overall health metrics for all subsystems.
   *
   * @returns System health information
   */
  getSystemHealth(): Promise<{
    databases: {
      coreDB: boolean;
      ephemeralDB: boolean;
    };
    services: {
      query: boolean;
      mutation: boolean;
      subscription: boolean;
      plugin: boolean;
      workingCopy: boolean;
    };
    memory: {
      used: number;
      limit: number;
    };
    uptime: number;
  }>;

  /**
   * @deprecated These methods are for backwards compatibility only.
   * New code should use getQueryAPI(), getMutationAPI(), etc. instead.
   * Will be removed in v2.0.
   */
  // Backwards compatibility methods
  // These provide direct access to common operations without going through sub-APIs
  getTree(params: { treeId: TreeId }): Promise<Tree | undefined>;
  listTrees(): Promise<Tree[]>;
  /**
   * @deprecated Use listTrees() instead. This is a naming mistake.
   */
  getTrees(): Promise<Tree[]>;
  getNode(nodeId: NodeId): Promise<TreeNode | undefined>;
  getChildren(params: { parentId: NodeId }): Promise<TreeNode[]>;
  create(params: any): Promise<any>;
  recoverFromTrash(params: {
    nodeIds: NodeId[];
    toParentId?: NodeId;
  }): Promise<{ success: boolean; error?: string }>;
  /**
   * @deprecated Use getPluginTreeAPI().getPluginsForTree() instead for better type safety and structure.
   * This method provides backward compatibility but delegates to the new PluginTreeAPI facade.
   */
  getPluginsForTree(treeId: TreeId): Promise<any[]>;
  removeNodes(nodeIds: NodeId[]): Promise<{ success: boolean; error?: string }>;
}

/**
 * Default export for the WorkerAPI interface
 */
export default WorkerAPI;
