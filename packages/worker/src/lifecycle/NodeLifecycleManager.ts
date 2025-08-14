import type { TreeNodeId, TreeNode, TreeNodeType } from '@hierarchidb/core';
import type { NodeLifecycleHooks, LifecycleEvent, LifecycleContext } from './types';
import type { SimpleNodeTypeRegistry } from '../registry/SimpleNodeTypeRegistry';
import type { CoreDB } from '../db/CoreDB';
import type { EphemeralDB } from '../db/EphemeralDB';
import { workerError } from '../utils/workerLogger';

/**
 * Manages lifecycle hooks for node operations
 */
export class NodeLifecycleManager {
  private events: LifecycleEvent[] = [];

  constructor(
    private registry: SimpleNodeTypeRegistry,
    private coreDB: CoreDB,
    private ephemeralDB: EphemeralDB
  ) {}

  /**
   * Execute a specific lifecycle hook
   */
  async executeLifecycleHook<THookName extends keyof NodeLifecycleHooks>(
    hookName: THookName,
    nodeType: TreeNodeType,
    ...args: any[]
  ): Promise<void> {
    const config = this.registry.getNodeTypeConfig(nodeType);
    const lifecycle = (config as any)?.lifecycle as NodeLifecycleHooks | undefined;
    const hook = lifecycle?.[hookName];

    if (!hook) {
      return; // No hook defined, silently continue
    }

    const startTime = Date.now();
    let success = true;
    let error: string | undefined;

    try {
      await (hook as Function)(...args);
    } catch (e) {
      success = false;
      error = e instanceof Error ? e.message : 'Unknown error';

      // Check if we should stop on error
      if (lifecycle?.stopOnError) {
        throw e;
      }

      // Otherwise, log and continue
      workerError(`Lifecycle hook ${hookName} failed for ${nodeType}:`, e as Record<string, any>);
    } finally {
      // Record event
      this.recordEvent({
        type: hookName,
        nodeType,
        nodeId: args[0] as TreeNodeId | undefined,
        timestamp: startTime,
        duration: Date.now() - startTime,
        success,
        error,
      });
    }
  }

  /**
   * Handle node creation with lifecycle hooks
   */
  async handleNodeCreation(
    parentId: TreeNodeId,
    nodeData: Partial<TreeNode>,
    nodeType: TreeNodeType
  ): Promise<TreeNodeId> {
    // Execute beforeCreate hook
    await this.executeLifecycleHook('beforeCreate', nodeType, parentId, nodeData);

    // Create the node
    const nodeId = await this.createNodeCore(parentId, nodeData);

    // Execute afterCreate hook
    await this.executeLifecycleHook('afterCreate', nodeType, nodeId);

    return nodeId;
  }

  /**
   * Handle node update with lifecycle hooks
   */
  async handleNodeUpdate(
    nodeId: TreeNodeId,
    updates: Partial<TreeNode>,
    nodeType: TreeNodeType
  ): Promise<void> {
    // Execute beforeUpdate hook
    await this.executeLifecycleHook('beforeUpdate', nodeType, nodeId, updates);

    // Update the node
    await this.updateNodeCore(nodeId, updates);

    // Execute afterUpdate hook
    await this.executeLifecycleHook('afterUpdate', nodeType, nodeId, updates);
  }

  /**
   * Handle node deletion with lifecycle hooks
   */
  async handleNodeDeletion(nodeId: TreeNodeId, nodeType: TreeNodeType): Promise<void> {
    // Execute beforeDelete hook
    await this.executeLifecycleHook('beforeDelete', nodeType, nodeId);

    // Delete the node
    await this.deleteNodeCore(nodeId);

    // Execute afterDelete hook
    await this.executeLifecycleHook('afterDelete', nodeType, nodeId);
  }

  /**
   * Handle node move with lifecycle hooks
   */
  async handleNodeMove(
    nodeId: TreeNodeId,
    oldParentId: TreeNodeId,
    newParentId: TreeNodeId,
    nodeType: TreeNodeType
  ): Promise<void> {
    // Execute beforeMove hook
    await this.executeLifecycleHook('beforeMove', nodeType, nodeId, oldParentId, newParentId);

    // Move the node
    await this.moveNodeCore(nodeId, newParentId);

    // Execute afterMove hook
    await this.executeLifecycleHook('afterMove', nodeType, nodeId, oldParentId, newParentId);
  }

  /**
   * Handle node load
   */
  async handleNodeLoad(nodeId: TreeNodeId, nodeType: TreeNodeType): Promise<void> {
    await this.executeLifecycleHook('onLoad', nodeType, nodeId);
  }

  /**
   * Handle node unload
   */
  async handleNodeUnload(nodeId: TreeNodeId, nodeType: TreeNodeType): Promise<void> {
    await this.executeLifecycleHook('onUnload', nodeType, nodeId);
  }

  /**
   * Handle batch node creation
   */
  async handleBatchCreate(
    parentId: TreeNodeId,
    nodes: Array<Partial<TreeNode>>,
    nodeType: TreeNodeType
  ): Promise<TreeNodeId[]> {
    const nodeIds: TreeNodeId[] = [];

    for (const nodeData of nodes) {
      const nodeId = await this.handleNodeCreation(parentId, nodeData, nodeType);
      nodeIds.push(nodeId);
    }

    return nodeIds;
  }

  /**
   * Handle batch node deletion
   */
  async handleBatchDelete(nodeIds: TreeNodeId[], nodeType: TreeNodeType): Promise<void> {
    for (const nodeId of nodeIds) {
      await this.handleNodeDeletion(nodeId, nodeType);
    }
  }

  /**
   * Get lifecycle events for debugging/monitoring
   */
  getEvents(filter?: {
    nodeType?: TreeNodeType;
    type?: keyof NodeLifecycleHooks;
  }): LifecycleEvent[] {
    let events = [...this.events];

    if (filter?.nodeType) {
      events = events.filter((e) => e.nodeType === filter.nodeType);
    }

    if (filter?.type) {
      events = events.filter((e) => e.type === filter.type);
    }

    return events;
  }

  /**
   * Clear event history
   */
  clearEvents(): void {
    this.events = [];
  }

  // Core operations (without hooks)

  private async createNodeCore(
    parentId: TreeNodeId,
    nodeData: Partial<TreeNode>
  ): Promise<TreeNodeId> {
    // In real implementation, this would create the node in CoreDB
    return (this.coreDB as any).createNode?.(nodeData) || (`node-${Date.now()}` as TreeNodeId);
  }

  private async updateNodeCore(nodeId: TreeNodeId, updates: Partial<TreeNode>): Promise<void> {
    // In real implementation, this would update the node in CoreDB
    if ((this.coreDB as any).updateNode) {
      await (this.coreDB as any).updateNode(nodeId, updates);
    }
  }

  private async deleteNodeCore(nodeId: TreeNodeId): Promise<void> {
    // In real implementation, this would delete the node from CoreDB
    await (this.coreDB as any).deleteNode?.(nodeId);
  }

  private async moveNodeCore(nodeId: TreeNodeId, newParentId: TreeNodeId): Promise<void> {
    // In real implementation, this would update the parent in CoreDB
    await this.updateNodeCore(nodeId, { parentTreeNodeId: newParentId });
  }

  private recordEvent(event: LifecycleEvent): void {
    this.events.push(event);

    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
  }

  /**
   * Create lifecycle context for hooks
   */
  createContext(metadata?: Record<string, unknown>): LifecycleContext {
    return {
      nodeType: 'unknown' as TreeNodeType,
      timestamp: Date.now(),
      metadata,
    };
  }

  /**
   * Execute hooks with context
   */
  async executeHookWithContext<THookName extends keyof NodeLifecycleHooks>(
    hookName: THookName,
    nodeType: TreeNodeType,
    context: LifecycleContext,
    ...args: any[]
  ): Promise<void> {
    const enrichedContext = {
      ...context,
      nodeType,
    };

    // Store context for hook execution
    (globalThis as any).__lifecycleContext = enrichedContext;

    try {
      await this.executeLifecycleHook(hookName, nodeType, ...args);
    } finally {
      delete (globalThis as any).__lifecycleContext;
    }
  }
}
