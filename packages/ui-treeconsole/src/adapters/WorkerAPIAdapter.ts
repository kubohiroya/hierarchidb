/**
 * WorkerAPIAdapter
 * 
 * TreeConsole用のメインアダプタークラス。
 * 新しいWorkerAPIを既存のTreeConsoleコードが期待する形式に変換します。
 * すべての個別アダプターを統合し、統一されたインターフェースを提供します。
 */

import type { WorkerAPI } from '@hierarchidb/api';
import type { TreeNodeId } from '@hierarchidb/core';
// import { TreeObservableAdapter } from './subscriptions/TreeObservableAdapter'; // Currently unused
import { TreeMutationCommandsAdapter } from './commands/TreeMutationCommands';
import { WorkingCopyCommandsAdapter, WorkingCopyEditSession } from './commands/WorkingCopyCommands';
import { SubscriptionManager } from './subscriptions/SubscriptionManager';
import { createAdapterGroupId } from './utils';
import type {
  WorkerAPIAdapterConfig,
  AdapterContext,
  CommandAdapterOptions,
  LegacyCallback,
  LegacyUnsubscribe,
  LegacyExpandedStateChanges,
  LegacySubTreeChanges,
  // TreeConsoleAdapterError // Removed - unused
} from './types';

export class WorkerAPIAdapter {
  private workerAPI: WorkerAPI;
  private viewId: string;
  private defaultOnNameConflict: string;
  
  // Individual adapters
  // private _observableAdapter: TreeObservableAdapter; // Currently unused - remove until needed
  private mutationAdapter: TreeMutationCommandsAdapter;
  private workingCopyAdapter: WorkingCopyCommandsAdapter;
  private subscriptionManager: SubscriptionManager;

  constructor(config: WorkerAPIAdapterConfig) {
    this.workerAPI = config.workerAPI;
    this.viewId = config.defaultViewId;
    this.defaultOnNameConflict = config.defaultOnNameConflict || 'auto-rename';

    // Initialize adapters
    // this._observableAdapter = new TreeObservableAdapter(this.workerAPI); // Currently unused
    this.mutationAdapter = new TreeMutationCommandsAdapter(this.workerAPI);
    this.workingCopyAdapter = new WorkingCopyCommandsAdapter(this.workerAPI);
    this.subscriptionManager = new SubscriptionManager(this.workerAPI, this.viewId);
  }

  /**
   * デフォルトのアダプターコンテキストを作成
   * 
   * @param overrides 上書きしたい設定
   * @returns AdapterContext
   */
  private createDefaultContext(overrides?: Partial<AdapterContext>): AdapterContext {
    return {
      viewId: this.viewId,
      groupId: createAdapterGroupId(),
      onNameConflict: this.defaultOnNameConflict as any,
      ...overrides
    };
  }

  /**
   * デフォルトのコマンドオプションを作成
   * 
   * @param contextOverrides コンテキストの上書き設定
   * @returns CommandAdapterOptions
   */
  private createDefaultOptions(contextOverrides?: Partial<AdapterContext>): CommandAdapterOptions {
    return {
      context: this.createDefaultContext(contextOverrides)
    };
  }

  // =====================
  // Observable Operations (Subscription)
  // =====================

  /**
   * 部分木の変更を監視（既存のsubscribeSubTreeに相当）
   */
  async subscribeToSubtree(
    nodeId: TreeNodeId,
    expandedChangesCallback: LegacyCallback<LegacyExpandedStateChanges>,
    subtreeChangesCallback: LegacyCallback<LegacySubTreeChanges>,
    contextOverrides?: Partial<AdapterContext>
  ): Promise<LegacyUnsubscribe> {
    const context = this.createDefaultContext(contextOverrides);
    return this.subscriptionManager.subscribeToSubtree(
      nodeId,
      expandedChangesCallback,
      subtreeChangesCallback,
      context
    ).then(subscriptionId => () => this.subscriptionManager.unsubscribe(subscriptionId));
  }

  /**
   * 単一ノードの変更を監視
   */
  async subscribeToNode(
    nodeId: TreeNodeId,
    callback: LegacyCallback<any>,
    contextOverrides?: Partial<AdapterContext>
  ): Promise<LegacyUnsubscribe> {
    const context = this.createDefaultContext(contextOverrides);
    return this.subscriptionManager.subscribeToNode(nodeId, callback, context)
      .then(subscriptionId => () => this.subscriptionManager.unsubscribe(subscriptionId));
  }

  /**
   * 子ノードリストの変更を監視
   */
  async subscribeToChildren(
    parentNodeId: TreeNodeId,
    callback: LegacyCallback<any>,
    contextOverrides?: Partial<AdapterContext>
  ): Promise<LegacyUnsubscribe> {
    const context = this.createDefaultContext(contextOverrides);
    return this.subscriptionManager.subscribeToChildren(parentNodeId, callback, context)
      .then(subscriptionId => () => this.subscriptionManager.unsubscribe(subscriptionId));
  }

  // =====================
  // Mutation Operations (CRUD)
  // =====================

  /**
   * ノードを移動（既存のmoveNodesに相当）
   */
  async moveNodes(
    nodeIds: TreeNodeId[],
    targetParentId: TreeNodeId,
    contextOverrides?: Partial<AdapterContext>
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.mutationAdapter.moveNodes(nodeIds, targetParentId, options);
  }

  /**
   * ノードを削除（ゴミ箱に移動）
   */
  async deleteNodes(
    nodeIds: TreeNodeId[],
    contextOverrides?: Partial<AdapterContext>
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.mutationAdapter.deleteNodes(nodeIds, options);
  }

  /**
   * ノードを複製
   */
  async duplicateNodes(
    nodeIds: TreeNodeId[],
    targetParentId: TreeNodeId,
    contextOverrides?: Partial<AdapterContext>
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.mutationAdapter.duplicateNodes(nodeIds, targetParentId, options);
  }

  /**
   * ノードを貼り付け
   */
  async pasteNodes(
    targetParentId: TreeNodeId,
    contextOverrides?: Partial<AdapterContext>
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.mutationAdapter.pasteNodes(targetParentId, options);
  }

  /**
   * ノードを完全削除
   */
  async permanentDeleteNodes(
    nodeIds: TreeNodeId[],
    contextOverrides?: Partial<AdapterContext>
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.mutationAdapter.permanentDeleteNodes(nodeIds, options);
  }

  /**
   * ゴミ箱からノードを復元
   */
  async recoverFromTrash(
    nodeIds: TreeNodeId[],
    targetParentId?: TreeNodeId,
    contextOverrides?: Partial<AdapterContext>
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.mutationAdapter.recoverFromTrash(nodeIds, targetParentId, options);
  }

  // =====================
  // Working Copy Operations (Editing)
  // =====================

  /**
   * 既存ノードの編集を開始
   */
  async startNodeEdit(
    sourceNodeId: TreeNodeId,
    contextOverrides?: Partial<AdapterContext>
  ): Promise<WorkingCopyEditSession> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.workingCopyAdapter.startNodeEdit(sourceNodeId, options);
  }

  /**
   * 新規ノードの作成を開始
   */
  async startNodeCreate(
    parentNodeId: TreeNodeId,
    name: string,
    description?: string,
    contextOverrides?: Partial<AdapterContext>
  ): Promise<WorkingCopyEditSession> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.workingCopyAdapter.startNodeCreate(parentNodeId, name, description, options);
  }

  /**
   * Working Copyの変更を保存（既存ノード編集）
   */
  async commitNodeEdit(
    editSession: WorkingCopyEditSession,
    contextOverrides?: Partial<AdapterContext>
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.workingCopyAdapter.commitNodeEdit(editSession, options);
  }

  /**
   * Working Copyの変更を保存（新規ノード作成）
   */
  async commitNodeCreate(
    editSession: WorkingCopyEditSession,
    contextOverrides?: Partial<AdapterContext>
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.workingCopyAdapter.commitNodeCreate(editSession, options);
  }

  /**
   * Working Copyの変更を破棄
   */
  async discardChanges(
    editSession: WorkingCopyEditSession,
    contextOverrides?: Partial<AdapterContext>
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.workingCopyAdapter.discardChanges(editSession, options);
  }

  // =====================
  // Lifecycle Management
  // =====================

  /**
   * すべてのサブスクリプションをクリーンアップ
   * コンポーネントのunmount時に呼び出す
   */
  cleanup(): void {
    this.subscriptionManager.cleanupAll();
  }

  /**
   * 指定されたノードに関連するすべてのサブスクリプションを解除
   */
  cleanupNodeSubscriptions(nodeId: TreeNodeId): void {
    this.subscriptionManager.unsubscribeByNodeId(nodeId);
  }

  /**
   * アダプターの設定情報を取得（デバッグ用）
   */
  getAdapterInfo(): {
    viewId: string;
    defaultOnNameConflict: string;
    subscriptionStats: ReturnType<SubscriptionManager['getSubscriptionStats']>;
  } {
    return {
      viewId: this.viewId,
      defaultOnNameConflict: this.defaultOnNameConflict,
      subscriptionStats: this.subscriptionManager.getSubscriptionStats()
    };
  }

  /**
   * viewIdを更新（通常は不要だが、動的に変更する場合用）
   */
  updateViewId(newViewId: string): void {
    this.viewId = newViewId;
  }
}