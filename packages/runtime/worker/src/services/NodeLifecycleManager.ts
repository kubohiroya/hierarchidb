import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';
import type { CoreDB } from './CoreDB.js';
import { workerError } from '../utils/workerLogger.js';
import type { LifecycleContext, LifecycleEvent, NodeLifecycleHooks } from './lifecycle-types.js';
import { SingletonMixin } from '@hierarchidb/util';
import { PluginDefinition } from '@hierarchidb/plugin-api';

/**
 * Manages lifecycle hooks for node operations
 */
export class NodeLifecycleManager {
  static async getSingleton(
    coreDB: CoreDB,
    plugins: Record<string, PluginDefinition>,
  ): Promise<NodeLifecycleManager> {
    return SingletonMixin.getSingleton(NodeLifecycleManager.name, () => {
      return new NodeLifecycleManager(coreDB, plugins);
    });
  }

  private events: LifecycleEvent[] = [];

  private refCountRegistry?: ReferenceCountingRegistry;

  constructor(
    private coreDB: CoreDB,
    private plugins: Record<string, PluginDefinition>,
  ) {}

  private getLifecycleHooks(nodeType: NodeType): NodeLifecycleHooks | undefined {
    const definition = this.plugins[nodeType as string];
    if (!definition) return undefined;
    const lifecycle = (definition as { lifecycle?: NodeLifecycleHooks }).lifecycle;
    return lifecycle;
  }

  /**
   * Execute a specific lifecycle hook
   */
  async executeLifecycleHook<THookName extends keyof NodeLifecycleHooks>(
    hookName: THookName,
    nodeType: NodeType,
    ...args: unknown[]
  ): Promise<void> {
    const lifecycle = this.getLifecycleHooks(nodeType);
    const hook = lifecycle?.[hookName];

    if (!hook) {
      return; // No hook defined, silently continue
    }

    const startTime = Date.now();
    let success = true;
    let error: string | undefined;

    try {
      await (hook as (...hookArgs: unknown[]) => unknown)(...args);
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
    nodeData: TreeNode,
    nodeType: NodeType,
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
    nodeType: NodeType,
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
    nodeType: NodeType,
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
    nodes: Array<TreeNode>,
    nodeType: NodeType,
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

  private async createNodeCore(parentId: NodeId, nodeData: TreeNode): Promise<NodeId> {
    // In real implementation, this would create the node in CoreDB
    return this.coreDB.createNode({ ...nodeData, parentId }) || (`node-${Date.now()}` as NodeId);
  }

  private async updateNodeCore(nodeId: NodeId, updates: Partial<TreeNode>): Promise<void> {
    // In real implementation, this would update the node in CoreDB
    await this.coreDB.updateNode({ ...updates, id: nodeId });
  }

  private async deleteNodeCore(nodeId: NodeId): Promise<void> {
    // In real implementation, this would delete the node from CoreDB
    await this.coreDB.deleteNode(nodeId);
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
      const handler = this.refCountRegistry?.[nodeType];
      if (handler && typeof handler.incrementReferenceCount === 'function') {
        await handler.incrementReferenceCount(nodeId);
        return;
      }
      // Fallback: log only
      console.log(`Reference counting not implemented for ${nodeType} node ${nodeId}`);
    } catch (e) {
      workerError(
        `Failed to increment reference count for ${nodeType} node ${nodeId}:`,
        e as Record<string, any>,
      );
    }
  }

  /**
   * Handle reference count decrement when PeerEntity is deleted
   */
  private async handleReferenceCountDecrement(nodeId: NodeId, nodeType: NodeType): Promise<void> {
    try {
      const handler = this.refCountRegistry?.[nodeType];
      if (handler && typeof handler.decrementReferenceCount === 'function') {
        await handler.decrementReferenceCount(nodeId);
        return;
      }
      console.log(`Reference counting decrement not implemented for ${nodeType} node ${nodeId}`);
    } catch (e) {
      workerError(
        `Failed to decrement reference count for ${nodeType} node ${nodeId}:`,
        e as Record<string, any>,
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
   * Inject reference counting handler registry (optional)
   */
  setReferenceCountingRegistry(registry: Record<string, {
    incrementReferenceCount(nodeId: NodeId): Promise<void>;
    decrementReferenceCount(nodeId: NodeId): Promise<void>
  }>) {
    this.refCountRegistry = registry;
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
    const enrichedContext = { ...context, nodeType };
    const lifecycleGlobal = globalThis as LifecycleGlobal;
    lifecycleGlobal.__lifecycleContext = enrichedContext;

    try {
      await this.executeLifecycleHook(hookName, nodeType, ...args);
    } finally {
      delete lifecycleGlobal.__lifecycleContext;
    }
  }
}

type ReferenceCountingHandler = {
  incrementReferenceCount(nodeId: NodeId): Promise<void>;
  decrementReferenceCount(nodeId: NodeId): Promise<void>;
};

type ReferenceCountingRegistry = Record<string, ReferenceCountingHandler>;

interface LifecycleGlobal {
  __lifecycleContext?: LifecycleContext;
}
