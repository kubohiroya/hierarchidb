/**
 * Worker entry point for the application
 * This file is responsible for exposing the WorkerAPI via Comlink
 */

import * as Comlink from 'comlink';
import { WorkerAPIImpl } from '@hierarchidb/runtime-worker';
import type { TreeId, NodeId } from '@hierarchidb/common-core';

// Get app name from environment
const appName = import.meta.env.VITE_APP_NAME || 'hierarchidb';

console.log('[App Worker] Starting initialization...');

// Create a minimal wrapper that handles lazy initialization
class WorkerAPIProxy {
  private instancePromise: Promise<WorkerAPIImpl> | null = null;

  private async getInstance(): Promise<WorkerAPIImpl> {
    if (!this.instancePromise) {
      console.log('[App Worker] Creating WorkerAPIImpl singleton...');
      this.instancePromise = WorkerAPIImpl.getSingleton(appName);
      this.instancePromise.then(
        () => console.log('[App Worker] WorkerAPIImpl initialized successfully'),
        (error) => {
          console.error('[App Worker] WorkerAPIImpl initialization failed:', error);
          this.instancePromise = null; // Allow retry
        }
      );
    }
    
    try {
      const instance = await this.instancePromise;
      if (!instance) {
        throw new Error('WorkerAPIImpl instance is null');
      }
      return instance;
    } catch (error) {
      console.error('[App Worker] getInstance failed:', error);
      this.instancePromise = null; // Reset for retry
      throw error;
    }
  }

  // System methods only - ping doesn't need WorkerAPIImpl instance
  ping() {
    console.log('[App Worker Proxy] ping() called - no instance needed');
    return {
      response: 'pong',
      timestamp: Date.now(),
    };
  }

  async initialize() {
    const instance = await this.getInstance();
    return instance.initialize();
  }

  async shutdown() {
    const instance = await this.getInstance();
    return instance.shutdown();
  }

  async getSystemHealth() {
    const instance = await this.getInstance();
    return instance.getSystemHealth();
  }

  // Facade APIs only - no direct methods!
  async getQueryAPI() {
    const instance = await this.getInstance();
    return instance.getQueryAPI();
  }

  async getMutationAPI() {
    const instance = await this.getInstance();
    return instance.getMutationAPI();
  }

  async getSubscriptionAPI() {
    const instance = await this.getInstance();
    return instance.getSubscriptionAPI();
  }

  async getPluginRegistryAPI() {
    const instance = await this.getInstance();
    return instance.getPluginRegistryAPI();
  }

  async getWorkingCopyAPI() {
    const instance = await this.getInstance();
    return instance.getWorkingCopyAPI();
  }

  async getPluginTreeAPI() {
    const instance = await this.getInstance();
    return instance.getPluginTreeAPI();
  }

  async getNodeTypeAPI() {
    const instance = await this.getInstance();
    return instance.getNodeTypeAPI();
  }

  async getPluginManagementAPI() {
    const instance = await this.getInstance();
    return instance.getPluginManagementAPI();
  }

  /**
   * @deprecated Use getQueryAPI().getTree() instead. Will be removed in v2.0.
   */
  async getTree(params: { treeId: string }) {
    try {
      console.log('[App Worker Proxy] getTree called with:', params);
      const instance = await this.getInstance();
      const queryAPI = await instance.getQueryAPI();
      console.log('[App Worker Proxy] getInstance successful, calling queryAPI.getTree');
      const result = await queryAPI.getTree(params.treeId as TreeId);
      console.log('[App Worker Proxy] getTree result:', !!result);
      return result;
    } catch (error) {
      console.error('[App Worker Proxy] getTree failed:', error);
      throw error;
    }
  }

  /**
   * @deprecated Use getQueryAPI().listTrees() instead. Will be removed in v2.0.
   */
  async listTrees() {
    const instance = await this.getInstance();
    const queryAPI = await instance.getQueryAPI();
    return queryAPI.listTrees();
  }

  /**
   * @deprecated Use getQueryAPI().listTrees() instead. Will be removed in v2.0.
   */
  async getTrees() {
    // Alias for listTrees for compatibility
    const instance = await this.getInstance();
    const queryAPI = await instance.getQueryAPI();
    return queryAPI.listTrees();
  }

  /**
   * @deprecated Use getQueryAPI().getNode() instead. Will be removed in v2.0.
   */
  async getNode(nodeId: string) {
    const instance = await this.getInstance();
    const queryAPI = await instance.getQueryAPI();
    return queryAPI.getNode(nodeId as NodeId);
  }

  // Additional methods required by WorkerAPI interface
  async getChildren(parentId: string) {
    const instance = await this.getInstance();
    const queryAPI = await instance.getQueryAPI();
    return queryAPI.listChildren(parentId as NodeId);
  }

  async create(params: any) {
    const instance = await this.getInstance();
    const mutationAPI = await instance.getMutationAPI();
    return mutationAPI.createNode(params);
  }

  async recoverFromTrash(params: any) {
    const instance = await this.getInstance();
    const mutationAPI = await instance.getMutationAPI();
    return mutationAPI.recoverNodesFromTrash(params);
  }

  async removeNodes(nodeIds: any) {
    const instance = await this.getInstance();
    const mutationAPI = await instance.getMutationAPI();
    return mutationAPI.removeNodes(nodeIds);
  }

  /**
   * @deprecated Use getPluginTreeAPI().getPluginsForTree() for better type safety
   */
  async getPluginsForTree(treeId: string) {
    const instance = await this.getInstance();
    return instance.getPluginsForTree(treeId as TreeId);
  }
}

// Create and expose the worker API proxy immediately
const workerAPI = new WorkerAPIProxy();
console.log('[App Worker] Exposing WorkerAPI via Comlink...');
Comlink.expose(workerAPI);
console.log('[App Worker] Worker ready - will initialize on first call');

// Export for type safety
export default workerAPI;