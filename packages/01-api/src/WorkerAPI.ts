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
import type { Remote } from 'comlink';
import type { Tree, TreeId, TreeNode, NodeId } from '@hierarchidb/00-core';

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
  getQueryAPI(): Remote<TreeQueryAPI>;

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
  getMutationAPI(): Remote<TreeMutationAPI>;

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
  getSubscriptionAPI(): Remote<TreeSubscriptionAPI>;

  /**
   * Get the plugin registry API for plugin system management
   * 
   * @returns Proxy to the PluginRegistryAPI singleton
   * 
   * @example
   * ```typescript
   * const pluginRegistryAPI = await workerAPI.getPluginRegistryAPI();
   * const nodeTypes = await pluginRegistryAPI.listSupportedNodeTypes();
   * ```
   */
  getPluginRegistryAPI(): Remote<PluginRegistryAPI>;

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
   *   parentNodeId
   * );
   * ```
   */
  getWorkingCopyAPI(): Remote<WorkingCopyAPI>;

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
  getChildren(params: { parentNodeId: NodeId }): Promise<TreeNode[]>;
  create(params: any): Promise<any>;
  recoverFromTrash(params: { nodeIds: NodeId[]; toParentId?: NodeId }): Promise<{ success: boolean; error?: string }>;
  getPluginsForTree(treeId: TreeId): Promise<any[]>;
  removeNodes(nodeIds: NodeId[]): Promise<{ success: boolean; error?: string }>;
}

/**
 * Default export for the WorkerAPI interface
 */
export default WorkerAPI;