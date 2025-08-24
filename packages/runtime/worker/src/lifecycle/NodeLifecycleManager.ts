import type { TreeNode, NodeId, NodeType, EntityReferenceHints } from '@hierarchidb/common-core';
import type { CoreDB } from '../db/CoreDB';
import type { EphemeralDB } from '../db/EphemeralDB';
import type { SimpleNodeTypeRegistry } from '../registry/SimpleNodeTypeRegistry';
import { workerError } from '../utils/workerLogger';
import type { LifecycleContext, LifecycleEvent, NodeLifecycleHooks } from './types';
import { isReferenceCountingHandler } from '../handlers/ReferenceCountingHandler';

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
    nodeType: NodeType,
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
        nodeId: args[0] as NodeId | undefined,
        timestamp: startTime,
        duration: Date.now() - startTime,
        success,
        error,
      });
    }
  }

  /**
   * Handle node creation with lifecycle hooks and reference counting
   */
  async handleNodeCreation(
    parentId: NodeId,
    nodeData: Partial<TreeNode>,
    nodeType: NodeType
  ): Promise<NodeId> {
    // Execute beforeCreate hook
    await this.executeLifecycleHook('beforeCreate', nodeType, parentId, nodeData);

    // Create the node
    const nodeId = await this.createNodeCore(parentId, nodeData);

    // Handle reference counting after node creation (when PeerEntity is created)
    await this.handleReferenceCountIncrement(nodeId, nodeType);

    // Execute afterCreate hook
    await this.executeLifecycleHook('afterCreate', nodeType, nodeId);

    return nodeId;
  }

  /**
   * Handle node update with lifecycle hooks
   */
  async handleNodeUpdate(
    nodeId: NodeId,
    updates: Partial<TreeNode>,
    nodeType: NodeType
  ): Promise<void> {
    // Execute beforeUpdate hook
    await this.executeLifecycleHook('beforeUpdate', nodeType, nodeId, updates);

    // Update the node
    await this.updateNodeCore(nodeId, updates);

    // Execute afterUpdate hook
    await this.executeLifecycleHook('afterUpdate', nodeType, nodeId, updates);
  }

  /**
   * Handle node deletion with lifecycle hooks and reference counting
   */
  async handleNodeDeletion(nodeId: NodeId, nodeType: NodeType): Promise<void> {
    // Execute beforeDelete hook
    await this.executeLifecycleHook('beforeDelete', nodeType, nodeId);

    // Handle reference counting before actual node deletion
    await this.handleReferenceCountDecrement(nodeId, nodeType);

    // Delete the node
    await this.deleteNodeCore(nodeId);

    // Execute afterDelete hook
    await this.executeLifecycleHook('afterDelete', nodeType, nodeId);
  }

  /**
   * Handle node move with lifecycle hooks
   */
  async handleNodeMove(
    nodeId: NodeId,
    oldParentId: NodeId,
    newParentId: NodeId,
    nodeType: NodeType
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
  async handleNodeLoad(nodeId: NodeId, nodeType: NodeType): Promise<void> {
    await this.executeLifecycleHook('onLoad', nodeType, nodeId);
  }

  /**
   * Handle node unload
   */
  async handleNodeUnload(nodeId: NodeId, nodeType: NodeType): Promise<void> {
    await this.executeLifecycleHook('onUnload', nodeType, nodeId);
  }

  /**
   * Handle batch node creation
   */
  async handleBatchCreate(
    parentId: NodeId,
    nodes: Array<Partial<TreeNode>>,
    nodeType: NodeType
  ): Promise<NodeId[]> {
    const nodeIds: NodeId[] = [];

    for (const nodeData of nodes) {
      const nodeId = await this.handleNodeCreation(parentId, nodeData, nodeType);
      nodeIds.push(nodeId);
    }

    return nodeIds;
  }

  /**
   * Handle batch node deletion
   */
  async handleBatchDelete(nodeIds: NodeId[], nodeType: NodeType): Promise<void> {
    for (const nodeId of nodeIds) {
      await this.handleNodeDeletion(nodeId, nodeType);
    }
  }

  /**
   * Get lifecycle events for debugging/monitoring
   */
  getEvents(filter?: { nodeType?: NodeType; type?: keyof NodeLifecycleHooks }): LifecycleEvent[] {
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

  private async createNodeCore(parentId: NodeId, nodeData: Partial<TreeNode>): Promise<NodeId> {
    // In real implementation, this would create the node in CoreDB
    return (this.coreDB as any).createNode?.(nodeData) || (`node-${Date.now()}` as NodeId);
  }

  private async updateNodeCore(nodeId: NodeId, updates: Partial<TreeNode>): Promise<void> {
    // In real implementation, this would update the node in CoreDB
    if ((this.coreDB as any).updateNode) {
      await (this.coreDB as any).updateNode(nodeId, updates);
    }
  }

  private async deleteNodeCore(nodeId: NodeId): Promise<void> {
    // In real implementation, this would delete the node from CoreDB
    await (this.coreDB as any).deleteNode?.(nodeId);
  }

  private async moveNodeCore(nodeId: NodeId, newParentId: NodeId): Promise<void> {
    // In real implementation, this would update the parent in CoreDB
    await this.updateNodeCore(nodeId, { parentId: newParentId });
  }

  private recordEvent(event: LifecycleEvent): void {
    this.events.push(event);

    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
  }

  /**
   * Handle reference count increment when PeerEntity is created
   */
  private async handleReferenceCountIncrement(nodeId: NodeId, nodeType: NodeType): Promise<void> {
    try {
      const config = this.registry.getNodeTypeConfig(nodeType);
      const entityHints = (config as any)?.metadata?.entityHints as
        | EntityReferenceHints
        | undefined;

      if (!entityHints?.relRefField) {
        return; // No RelationalEntity to manage
      }

      // TODO: Implement getHandler method in registry
      // const handler = this.registry.getHandler(nodeType);
      // if (!isReferenceCountingHandler(handler)) {
      //   return; // Handler doesn't support reference counting
      // }
      //
      // await handler.incrementReferenceCount(nodeId);
    } catch (e) {
      workerError(
        `Failed to increment reference count for ${nodeType} node ${nodeId}:`,
        e as Record<string, any>
      );
    }
  }

  /**
   * Handle reference count decrement when PeerEntity is deleted
   */
  private async handleReferenceCountDecrement(nodeId: NodeId, nodeType: NodeType): Promise<void> {
    try {
      const config = this.registry.getNodeTypeConfig(nodeType);
      const entityHints = (config as any)?.metadata?.entityHints as
        | EntityReferenceHints
        | undefined;

      if (!entityHints?.relRefField) {
        return; // No RelationalEntity to manage
      }

      // TODO: Implement getHandler method in registry
      // const handler = this.registry.getHandler(nodeType);
      // if (!isReferenceCountingHandler(handler)) {
      //   return; // Handler doesn't support reference counting
      // }
      //
      // await handler.decrementReferenceCount(nodeId);
    } catch (e) {
      workerError(
        `Failed to decrement reference count for ${nodeType} node ${nodeId}:`,
        e as Record<string, any>
      );
    }
  }

  /**
   * Create lifecycle context for hooks
   */
  createContext(metadata?: Record<string, unknown>): LifecycleContext {
    return {
      nodeType: 'unknown' as NodeType,
      timestamp: Date.now(),
      metadata,
    };
  }

  /**
   * Execute hooks with context
   */
  async executeHookWithContext<THookName extends keyof NodeLifecycleHooks>(
    hookName: THookName,
    nodeType: NodeType,
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
