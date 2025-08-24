/**
 * TreeObservableAdapter
 *
 * 新しいObservable形式のWorkerAPIを既存のコールバック形式に変換します。
 * 既存TreeConsoleコードのサブスクリプションパターンを新APIに対応させます。
 */

// import { Observable } from 'rxjs'; // TODO: will be used when implementing actual Observable subscriptions
import type { WorkerAPI } from '@hierarchidb/common-api';
import type {
  NodeId,
  TreeNodeEvent,
} from '@hierarchidb/common-core';
import type {
  UnsubscribeFunction,
  AdapterContext,
} from '../../types/index';

type TreeNodeEventCallback = (event: TreeNodeEvent) => void;
import { TreeConsoleAdapterError } from '../../types/index';

export class TreeObservableAdapter {
  private subscriptions = new Map<string, () => void>();

  constructor(private workerAPI: WorkerAPI) {}

  /**
   * 部分木の変更監視（既存のsubscribeSubTreeに相当）
   *
   * @param nodeId 監視するルートノードID
   * @param expandedChangesCallback 展開状態変更時のコールバック
   * @param subtreeChangesCallback 部分木変更時のコールバック
   * @param context アダプター実行コンテキスト
   * @returns サブスクリプション解除関数
   */
  async subscribeToSubtree(
    nodeId: NodeId,
    callback: TreeNodeEventCallback,
    context: AdapterContext
  ): Promise<UnsubscribeFunction> {
    try {
      const subscriptionAPI = await this.workerAPI.getSubscriptionAPI();
      
      const subscriptionId = await subscriptionAPI.subscribeSubtree(
        nodeId,
        callback
      );

      const internalSubscriptionId = `subtree_${nodeId}_${context.viewId}`;
      const wrappedUnsubscribe = async () => {
        await subscriptionAPI.unsubscribe(subscriptionId);
        this.subscriptions.delete(internalSubscriptionId);
      };

      this.subscriptions.set(internalSubscriptionId, wrappedUnsubscribe);

      return wrappedUnsubscribe;
    } catch (error) {
      throw new TreeConsoleAdapterError(
        `Failed to subscribe to subtree for node ${nodeId}`,
        'SUBTREE_SUBSCRIPTION_INIT_ERROR',
        error as Error
      );
    }
  }

  /**
   * 単一ノードの変更監視
   *
   * @param nodeId 監視するノードID
   * @param callback ノード変更時のコールバック
   * @param context アダプター実行コンテキスト
   * @returns サブスクリプション解除関数
   */
  async subscribeToNode(
    nodeId: NodeId,
    callback: TreeNodeEventCallback,
    context: AdapterContext
  ): Promise<UnsubscribeFunction> {
    try {
      const subscriptionAPI = await this.workerAPI.getSubscriptionAPI();
      
      const subscriptionId = await subscriptionAPI.subscribeNode(
        nodeId,
        callback
      );

      const internalSubscriptionId = `node_${nodeId}_${context.viewId}`;
      const wrappedUnsubscribe = async () => {
        await subscriptionAPI.unsubscribe(subscriptionId);
        this.subscriptions.delete(internalSubscriptionId);
      };

      this.subscriptions.set(internalSubscriptionId, wrappedUnsubscribe);

      return wrappedUnsubscribe;
    } catch (error) {
      throw new TreeConsoleAdapterError(
        `Failed to subscribe to node ${nodeId}`,
        'NODE_SUBSCRIPTION_INIT_ERROR',
        error as Error
      );
    }
  }

  /**
   * 子ノード一覧の変更監視
   *
   * @param parentNodeId 親ノードID
   * @param callback 子ノード変更時のコールバック
   * @param context アダプター実行コンテキスト
   * @returns サブスクリプション解除関数
   */
  async subscribeToChildren(
    parentNodeId: NodeId,
    callback: TreeNodeEventCallback,
    context: AdapterContext
  ): Promise<UnsubscribeFunction> {
    try {
      const subscriptionAPI = await this.workerAPI.getSubscriptionAPI();
      
      // Subscribe to subtree with depth 1 to get only direct children
      const subscriptionId = await subscriptionAPI.subscribeSubtree(
        parentNodeId,
        callback
      );

      const internalSubscriptionId = `children_${parentNodeId}_${context.viewId}`;
      const wrappedUnsubscribe = async () => {
        await subscriptionAPI.unsubscribe(subscriptionId);
        this.subscriptions.delete(internalSubscriptionId);
      };

      this.subscriptions.set(internalSubscriptionId, wrappedUnsubscribe);

      return wrappedUnsubscribe;
    } catch (error) {
      throw new TreeConsoleAdapterError(
        `Failed to subscribe to children of node ${parentNodeId}`,
        'CHILDREN_SUBSCRIPTION_INIT_ERROR',
        error as Error
      );
    }
  }

  /**
   * すべてのサブスクリプションを解除
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
   * アクティブなサブスクリプション数を取得
   */
  getActiveSubscriptionCount(): number {
    return this.subscriptions.size;
  }




}
