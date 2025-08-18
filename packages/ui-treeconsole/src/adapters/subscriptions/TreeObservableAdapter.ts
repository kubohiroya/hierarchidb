/**
 * TreeObservableAdapter
 * 
 * 新しいObservable形式のWorkerAPIを既存のコールバック形式に変換します。
 * 既存TreeConsoleコードのサブスクリプションパターンを新APIに対応させます。
 */

// import { Observable } from 'rxjs'; // TODO: will be used when implementing actual Observable subscriptions
import type { WorkerAPI } from '@hierarchidb/api';
import type { 
  TreeNodeId, 
  TreeChangeEvent, 
  ObserveSubtreePayload,
  ObserveChildrenPayload,
  ObserveNodePayload
} from '@hierarchidb/core';
import { createCommand } from '../utils';
import type { 
  LegacyCallback, 
  LegacyUnsubscribe, 
  AdapterContext,
  LegacyExpandedStateChanges,
  LegacySubTreeChanges
} from '../types';
import { TreeConsoleAdapterError } from '../types';

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
    nodeId: TreeNodeId,
    expandedChangesCallback: LegacyCallback<LegacyExpandedStateChanges>,
    subtreeChangesCallback: LegacyCallback<LegacySubTreeChanges>,
    context: AdapterContext
  ): Promise<LegacyUnsubscribe> {
    try {
      const command = createCommand('observeSubtree', {
        rootNodeId: nodeId,
        includeInitialSnapshot: true,
        maxDepth: undefined // 既存実装では深度制限なしと仮定
      } as ObserveSubtreePayload, { 
        groupId: context.groupId 
      });

      const observable = await this.workerAPI.observeSubtree(command);
      
      const subscription = observable.subscribe({
        next: (event: TreeChangeEvent) => {
          this.convertAndDispatchSubtreeEvent(
            event, 
            expandedChangesCallback, 
            subtreeChangesCallback
          );
        },
        error: (error) => {
          console.error('TreeObservableAdapter: subtree subscription error', error);
          // エラーを上位に伝播
          throw new TreeConsoleAdapterError(
            'Subtree subscription failed', 
            'SUBTREE_SUBSCRIPTION_ERROR', 
            error
          );
        }
      });

      const subscriptionId = `subtree_${nodeId}_${context.viewId}`;
      const unsubscribe = () => {
        subscription.unsubscribe();
        this.subscriptions.delete(subscriptionId);
      };

      this.subscriptions.set(subscriptionId, unsubscribe);
      
      return unsubscribe;
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
    nodeId: TreeNodeId,
    callback: LegacyCallback<TreeChangeEvent>,
    context: AdapterContext
  ): Promise<LegacyUnsubscribe> {
    try {
      const command = createCommand('observeNode', {
        treeNodeId: nodeId,
        includeInitialValue: true
      } as ObserveNodePayload, { 
        groupId: context.groupId 
      });

      const observable = await this.workerAPI.observeNode(command);
      
      const subscription = observable.subscribe({
        next: callback,
        error: (error) => {
          console.error('TreeObservableAdapter: node subscription error', error);
          throw new TreeConsoleAdapterError(
            'Node subscription failed', 
            'NODE_SUBSCRIPTION_ERROR', 
            error
          );
        }
      });

      const subscriptionId = `node_${nodeId}_${context.viewId}`;
      const unsubscribe = () => {
        subscription.unsubscribe();
        this.subscriptions.delete(subscriptionId);
      };

      this.subscriptions.set(subscriptionId, unsubscribe);
      
      return unsubscribe;
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
    parentNodeId: TreeNodeId,
    callback: LegacyCallback<TreeChangeEvent>,
    context: AdapterContext
  ): Promise<LegacyUnsubscribe> {
    try {
      const command = createCommand('observeChildren', {
        parentTreeNodeId: parentNodeId,
        includeInitialSnapshot: true
      } as ObserveChildrenPayload, { 
        groupId: context.groupId 
      });

      const observable = await this.workerAPI.observeChildren(command);
      
      const subscription = observable.subscribe({
        next: callback,
        error: (error) => {
          console.error('TreeObservableAdapter: children subscription error', error);
          throw new TreeConsoleAdapterError(
            'Children subscription failed', 
            'CHILDREN_SUBSCRIPTION_ERROR', 
            error
          );
        }
      });

      const subscriptionId = `children_${parentNodeId}_${context.viewId}`;
      const unsubscribe = () => {
        subscription.unsubscribe();
        this.subscriptions.delete(subscriptionId);
      };

      this.subscriptions.set(subscriptionId, unsubscribe);
      
      return unsubscribe;
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

  /**
   * TreeChangeEventを既存形式に変換して適切なコールバックに通知
   * 
   * TODO: 実装時に既存TreeConsoleコードの具体的な形式を確認して詳細化
   */
  private convertAndDispatchSubtreeEvent(
    event: TreeChangeEvent,
    expandedCallback: LegacyCallback<LegacyExpandedStateChanges>,
    subtreeCallback: LegacyCallback<LegacySubTreeChanges>
  ): void {
    // 展開状態に関するイベントの場合
    if (this.isExpandedStateEvent(event)) {
      const expandedChange: LegacyExpandedStateChanges = {
        nodeId: event.nodeId,
        expanded: this.extractExpandedState(event)
        // TODO: 実装時に既存コードから他のプロパティを確認
      };
      expandedCallback(expandedChange);
    }

    // 部分木の構造変更イベントの場合
    if (this.isSubtreeStructureEvent(event)) {
      const subtreeChange: LegacySubTreeChanges = {
        type: event.type === 'node-moved' ? 'node-updated' : event.type as 'node-created' | 'node-updated' | 'node-deleted',
        nodeId: event.nodeId
        // TODO: 実装時に既存コードから他のプロパティを確認
      };
      subtreeCallback(subtreeChange);
    }
  }

  /**
   * 展開状態に関するイベントかどうかを判定
   * TODO: 実装時に既存コードのパターンを確認して適切に実装
   */
  private isExpandedStateEvent(event: TreeChangeEvent): boolean {
    // 仮実装：ノード更新で展開状態が変更された場合
    return event.type === 'node-updated' && 
           event.node?.name !== event.previousNode?.name;
  }

  /**
   * 部分木の構造変更イベントかどうかを判定
   */
  private isSubtreeStructureEvent(event: TreeChangeEvent): boolean {
    return ['node-created', 'node-updated', 'node-deleted', 'node-moved'].includes(event.type);
  }

  /**
   * イベントから展開状態を抽出
   * TODO: 実装時に実際のデータ構造を確認して実装
   */
  private extractExpandedState(_event: TreeChangeEvent): boolean {
    // 仮実装：具体的なロジックは既存コード確認後に実装
    return false;
  }
}