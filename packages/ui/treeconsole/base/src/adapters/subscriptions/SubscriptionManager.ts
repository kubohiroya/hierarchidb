/**
  * SubscriptionManager
  * TreeConsole
   */

import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, TreeNodeEvent } from '@hierarchidb/common-type';
import { TreeObservableAdapter } from './TreeObservableAdapter.js';
import type { AdapterContext, UnsubscribeFunction } from '../../types/index.js';
import { TreeConsoleAdapterError } from '../../types/index.js';

type TreeNodeEventCallback = (event: TreeNodeEvent) => void;

interface SubscriptionEntry {
  id: string;
  type: 'subtree' | 'node' | 'children';
  nodeId: NodeId;
  unsubscribe: UnsubscribeFunction;
  createdAt: number;
}

export class SubscriptionManager {
  private adapter: TreeObservableAdapter;
  private subscriptions = new Map<string, SubscriptionEntry>();

  // private _viewId: string; // Currently unused

  constructor(workerAPI: WorkerAPI, _viewId: string) {
    this.adapter = new TreeObservableAdapter(workerAPI);
    // this._viewId = _viewId; // Currently unused
  }

  /**
            * @param nodeId ID
   * @param expandedChangesCallback
   * @param subtreeChangesCallback
   * @param context
   * @returns ID
      */
  async subscribeToSubtree(
    nodeId: NodeId,
    callback: TreeNodeEventCallback,
    context: AdapterContext,
  ): Promise<string> {
    try {
      const subscriptionId = `subtree_${nodeId}_${Date.now()}`;

      const unsubscribe = await this.adapter.subscribeToSubtree(nodeId, callback, context);

      const entry: SubscriptionEntry = {
        id: subscriptionId,
        type: 'subtree',
        nodeId,
        unsubscribe,
        createdAt: Date.now(),
      };

      this.subscriptions.set(subscriptionId, entry);
      return subscriptionId;
    } catch (error) {
      throw new TreeConsoleAdapterError(
        `Failed to create subtree subscription for node ${nodeId}`,
        'SUBTREE_SUBSCRIPTION_MANAGER_ERROR',
        error as Error,
      );
    }
  }

  /**
            * @param nodeId ID
   * @param callback
   * @param context
   * @returns ID
      */
  async subscribeToNode(
    nodeId: NodeId,
    callback: TreeNodeEventCallback,
    context: AdapterContext,
  ): Promise<string> {
    try {
      const subscriptionId = `node_${nodeId}_${Date.now()}`;

      const unsubscribe = await this.adapter.subscribeToNode(nodeId, callback, context);

      const entry: SubscriptionEntry = {
        id: subscriptionId,
        type: 'node',
        nodeId,
        unsubscribe,
        createdAt: Date.now(),
      };

      this.subscriptions.set(subscriptionId, entry);
      return subscriptionId;
    } catch (error) {
      throw new TreeConsoleAdapterError(
        `Failed to create node subscription for node ${nodeId}`,
        'NODE_SUBSCRIPTION_MANAGER_ERROR',
        error as Error,
      );
    }
  }

  /**
            * @param parentId ID
   * @param callback
   * @param context
   * @returns ID
      */
  async subscribeToChildren(
    parentId: NodeId,
    callback: TreeNodeEventCallback,
    context: AdapterContext,
  ): Promise<string> {
    try {
      const subscriptionId = `children_${parentId}_${Date.now()}`;

      const unsubscribe = await this.adapter.subscribeToChildren(parentId, callback, context);

      const entry: SubscriptionEntry = {
        id: subscriptionId,
        type: 'children',
        nodeId: parentId,
        unsubscribe,
        createdAt: Date.now(),
      };

      this.subscriptions.set(subscriptionId, entry);
      return subscriptionId;
    } catch (error) {
      throw new TreeConsoleAdapterError(
        `Failed to create children subscription for node ${parentId}`,
        'CHILDREN_SUBSCRIPTION_MANAGER_ERROR',
        error as Error,
      );
    }
  }

  /**
            * @param subscriptionId ID
      */
  unsubscribe(subscriptionId: string): void {
    const entry = this.subscriptions.get(subscriptionId);
    if (entry) {
      try {
        entry.unsubscribe();
        this.subscriptions.delete(subscriptionId);
      } catch (error) {
        console.error(`Failed to unsubscribe ${subscriptionId}:`, error);
      }
    }
  }

  /**
            * @param nodeId ID
      */
  unsubscribeByNodeId(nodeId: NodeId): void {
    const toRemove: string[] = [];

    this.subscriptions.forEach((entry, subscriptionId) => {
      if (entry.nodeId === nodeId) {
        toRemove.push(subscriptionId);
      }
    });

    toRemove.forEach((id) => this.unsubscribe(id));
  }

  /**
            * @param type
      */
  unsubscribeByType(type: 'subtree' | 'node' | 'children'): void {
    const toRemove: string[] = [];

    this.subscriptions.forEach((entry, subscriptionId) => {
      if (entry.type === type) {
        toRemove.push(subscriptionId);
      }
    });

    toRemove.forEach((id) => this.unsubscribe(id));
  }

  /**
            */
  cleanupAll(): void {
    this.subscriptions.forEach((entry, subscriptionId) => {
      try {
        entry.unsubscribe();
      } catch (error) {
        console.error(`Failed to cleanup subscription ${subscriptionId}:`, error);
      }
    });

    this.subscriptions.clear();
    this.adapter.cleanupAllSubscriptions();
  }

  /**
            * @param maxAgeMs 1
      */
  cleanupOldSubscriptions(maxAgeMs: number = 3600000): void {
    const now = Date.now();
    const toRemove: string[] = [];

    this.subscriptions.forEach((entry, subscriptionId) => {
      if (now - entry.createdAt > maxAgeMs) {
        toRemove.push(subscriptionId);
      }
    });

    toRemove.forEach((id) => this.unsubscribe(id));
  }

  /**
            */
  getSubscriptionStats(): {
    total: number;
    byType: Record<string, number>;
    byNodeId: Record<string, number>;
    oldestSubscription?: { id: string; ageMs: number };
  } {
    const stats = {
      total: this.subscriptions.size,
      byType: { subtree: 0, node: 0, children: 0 },
      byNodeId: {} as Record<string, number>,
      oldestSubscription: undefined as { id: string; ageMs: number } | undefined,
    };

    const now = Date.now();
    let oldest: { id: string; ageMs: number } | undefined;

    this.subscriptions.forEach((entry, subscriptionId) => {
      stats.byType[entry.type]++;
      stats.byNodeId[entry.nodeId] = (stats.byNodeId[entry.nodeId] || 0) + 1;

      const ageMs = now - entry.createdAt;
      if (!oldest || ageMs > oldest.ageMs) {
        oldest = { id: subscriptionId, ageMs };
      }
    });

    stats.oldestSubscription = oldest;
    return stats;
  }
}
