/**
  * TreeObservableAdapter
  * ObservableWorkerAPI
 * TreeConsoleAPI
  */

// import { Observable } from 'rxjs'; // TODO: will be used when implementing actual Observable subscriptions
import type { WorkerAPI } from '@hierarchidb/worker-api';
import * as Comlink from 'comlink';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNodeEvent } from '@hierarchidb/tree-api';
import type { AdapterContext, UnsubscribeFunction } from '../../types/index.js';
import { TreeConsoleAdapterError } from '../../types/index.js';
import { createCommand } from '../utils.js';

type TreeNodeEventCallback = (event: TreeNodeEvent) => void;

export class TreeObservableAdapter {
  private subscriptions = new Map<string, () => void>();
  private proxiedCallbacks = new Map<string, any>();

  constructor(private workerAPI: WorkerAPI) {
  }

  /**
      * subscribeSubTree
      * @param nodeId ID
   * @param expandedChangesCallback
   * @param subtreeChangesCallback
   * @param context
   * @returns
      */
  async subscribeToSubtree(
    nodeId: NodeId,
    callback: TreeNodeEventCallback,
    context: AdapterContext,
  ): Promise<UnsubscribeFunction> {
    try {
      console.log('[TreeObservableAdapter] subscribeToSubtree called', {
        nodeId: String(nodeId),
        viewId: context.viewId,
      });
      // Prefer legacy observable-style API if present (for tests)
      const workerRecord = this.workerAPI as unknown as Record<string, unknown>;
      const observeCandidate = workerRecord.observeSubtree;
      const maybeObserve = typeof observeCandidate === 'function'
        ? observeCandidate.bind(this.workerAPI) as
          (envelope: unknown) => Promise<{ subscribe: (cb: (e: TreeNodeEvent) => void) => { unsubscribe: () => void } }>
        : undefined;

      const internalSubscriptionId = `subtree_${nodeId}_${context.viewId}`;

      if (typeof maybeObserve === 'function') {
        const envelope = createCommand('observeSubtree', {
          rootNodeId: nodeId,
          includeInitialSnapshot: true,
        }, { groupId: context.groupId, sourceViewId: context.viewId });

        const observable: any = await maybeObserve(envelope);
        const sub = observable.subscribe((event: TreeNodeEvent) => setTimeout(() => callback(event), 0));

        const wrappedUnsubscribe = () => {
          try { sub.unsubscribe?.(); } finally { this.subscriptions.delete(internalSubscriptionId); }
        };
        this.subscriptions.set(internalSubscriptionId, wrappedUnsubscribe);
        return wrappedUnsubscribe;
      }

      // Fallback to current subscription API
      const subscriptionAPI = await this.workerAPI.getSubscriptionAPI();
      const proxied = Comlink.proxy((e: TreeNodeEvent) => {
        console.log('[TreeObservableAdapter] event forwarded', {
          type: e.type,
          nodeId: String(e.nodeId),
          hasNode: Boolean(e.node),
        });
        setTimeout(() => callback(e), 0);
      });
      const prefetchDepth = context.prefetchDepth ?? 2;
      const subscriptionId = await subscriptionAPI.subscribeSubtree(
        nodeId,
        proxied,
        {
          prefetch: { depth: prefetchDepth },
        },
      );
      console.log('[TreeObservableAdapter] subscribeSubtree success', {
        nodeId: String(nodeId),
        subscriptionId,
        prefetchDepth,
      });
      this.proxiedCallbacks.set(internalSubscriptionId, proxied);

      const wrappedUnsubscribe = async () => {
        await subscriptionAPI.unsubscribe(subscriptionId);
        this.proxiedCallbacks.delete(internalSubscriptionId);
        this.subscriptions.delete(internalSubscriptionId);
      };
      this.subscriptions.set(internalSubscriptionId, wrappedUnsubscribe);
      return wrappedUnsubscribe;
    } catch (error) {
      throw new TreeConsoleAdapterError(
        `Failed to subscribe to subtree for node ${nodeId}`,
        'SUBTREE_SUBSCRIPTION_INIT_ERROR',
        error as Error,
      );
    }
  }

  /**
            * @param nodeId ID
   * @param callback
   * @param context
   * @returns
      */
  async subscribeToNode(
    nodeId: NodeId,
    callback: TreeNodeEventCallback,
    context: AdapterContext,
  ): Promise<UnsubscribeFunction> {
    try {
      const subscriptionAPI = await this.workerAPI.getSubscriptionAPI();
      const internalSubscriptionId = `node_${nodeId}_${context.viewId}`;
      const proxied = Comlink.proxy((e: TreeNodeEvent) => setTimeout(() => callback(e), 0));
      const subscriptionId = await subscriptionAPI.subscribeNode(nodeId, proxied);
      this.proxiedCallbacks.set(internalSubscriptionId, proxied);
      const wrappedUnsubscribe = async () => {
        await subscriptionAPI.unsubscribe(subscriptionId);
        this.subscriptions.delete(internalSubscriptionId);
        this.proxiedCallbacks.delete(internalSubscriptionId);
      };

      this.subscriptions.set(internalSubscriptionId, wrappedUnsubscribe);

      return wrappedUnsubscribe;
    } catch (error) {
      throw new TreeConsoleAdapterError(
        `Failed to subscribe to node ${nodeId}`,
        'NODE_SUBSCRIPTION_INIT_ERROR',
        error as Error,
      );
    }
  }

  /**
            * @param parentId ID
   * @param callback
   * @param context
   * @returns
      */
  async subscribeToChildren(
    parentId: NodeId,
    callback: TreeNodeEventCallback,
    context: AdapterContext,
  ): Promise<UnsubscribeFunction> {
    try {
      const subscriptionAPI = await this.workerAPI.getSubscriptionAPI();
      const internalSubscriptionId = `children_${parentId}_${context.viewId}`;
      const proxied = Comlink.proxy((e: TreeNodeEvent) => setTimeout(() => callback(e), 0));
      // Subscribe to subtree; consumer treats it as children-only
      const subscriptionId = await subscriptionAPI.subscribeSubtree(parentId, proxied);
      this.proxiedCallbacks.set(internalSubscriptionId, proxied);
      const wrappedUnsubscribe = async () => {
        await subscriptionAPI.unsubscribe(subscriptionId);
        this.subscriptions.delete(internalSubscriptionId);
        this.proxiedCallbacks.delete(internalSubscriptionId);
      };

      this.subscriptions.set(internalSubscriptionId, wrappedUnsubscribe);

      return wrappedUnsubscribe;
    } catch (error) {
      throw new TreeConsoleAdapterError(
        `Failed to subscribe to children of node ${parentId}`,
        'CHILDREN_SUBSCRIPTION_INIT_ERROR',
        error as Error,
      );
    }
  }

  /**
            */
  cleanupAllSubscriptions(): void {
    this.subscriptions.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('TreeObservableAdapter: cleanup error', error);
      }
    });
    this.subscriptions.clear();
  }

  /**
            */
  getActiveSubscriptionCount(): number {
    return this.subscriptions.size;
  }
}
