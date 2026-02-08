import type { WorkerAPI } from '@hierarchidb/worker-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { OnNameConflict, TreeNodeEvent } from '@hierarchidb/tree-api';
import { TreeMutationCommandsAdapter } from './commands/TreeMutationCommands.js';
import { DraftCommandsAdapter, type DraftEditSession } from './commands/DraftCommands.js';
import { SubscriptionManager } from './subscriptions/SubscriptionManager.js';
import { createAdapterGroupId } from './utils.js';
import type { AdapterContext, CommandAdapterOptions, UnsubscribeFunction, WorkerAPIAdapterConfig } from './types.js';

type TreeNodeEventCallback = (event: TreeNodeEvent) => void;

export class WorkerAPIAdapter<T> {
  private workerAPI: WorkerAPI<T>;
  private viewId: string;
  private defaultOnNameConflict: OnNameConflict;

  private mutationAdapter: TreeMutationCommandsAdapter<T>;
  private draftAdapter: DraftCommandsAdapter<T>;
  private subscriptionManager: SubscriptionManager<T>;

  constructor(config: WorkerAPIAdapterConfig<T>) {
    this.workerAPI = config.workerAPI;
    this.viewId = config.defaultViewId;
    this.defaultOnNameConflict = config.defaultOnNameConflict ?? 'auto-rename';

    this.mutationAdapter = new TreeMutationCommandsAdapter(this.workerAPI);
    this.draftAdapter = new DraftCommandsAdapter(this.workerAPI);
    this.subscriptionManager = new SubscriptionManager(this.workerAPI, this.viewId);
  }

  private createDefaultContext(overrides?: Partial<AdapterContext>): AdapterContext {
    return {
      viewId: this.viewId,
      groupId: createAdapterGroupId(),
      onNameConflict: this.defaultOnNameConflict,
      ...overrides,
    };
  }

  private createDefaultOptions(contextOverrides?: Partial<AdapterContext>): CommandAdapterOptions {
    return {
      context: this.createDefaultContext(contextOverrides),
    };
  }

  async subscribeToSubtree(
    nodeId: NodeId,
    callback: TreeNodeEventCallback,
    contextOverrides?: Partial<AdapterContext>,
  ): Promise<UnsubscribeFunction> {
    const context = this.createDefaultContext(contextOverrides);
    return this.subscriptionManager
      .subscribeToSubtree(nodeId, callback, context)
      .then((subscriptionId) => () => this.subscriptionManager.unsubscribe(subscriptionId));
  }

  async subscribeToNode(
    nodeId: NodeId,
    callback: TreeNodeEventCallback,
    contextOverrides?: Partial<AdapterContext>,
  ): Promise<UnsubscribeFunction> {
    const context = this.createDefaultContext(contextOverrides);
    return this.subscriptionManager
      .subscribeToNode(nodeId, callback, context)
      .then((subscriptionId) => () => this.subscriptionManager.unsubscribe(subscriptionId));
  }

  async subscribeToChildren(
    parentId: NodeId,
    callback: TreeNodeEventCallback,
    contextOverrides?: Partial<AdapterContext>,
  ): Promise<UnsubscribeFunction> {
    const context = this.createDefaultContext(contextOverrides);
    return this.subscriptionManager
      .subscribeToChildren(parentId, callback, context)
      .then((subscriptionId) => () => this.subscriptionManager.unsubscribe(subscriptionId));
  }

  async moveNodes(
    nodeIds: NodeId[],
    targetParentId: NodeId,
    contextOverrides?: Partial<AdapterContext>,
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.mutationAdapter.moveNodes(nodeIds, targetParentId, options);
  }

  async trashNodes(nodeIds: NodeId[], contextOverrides?: Partial<AdapterContext>): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.mutationAdapter.deleteNodes(nodeIds, options);
  }

  async duplicateNodes(
    nodeIds: NodeId[],
    targetParentId: NodeId,
    contextOverrides?: Partial<AdapterContext>,
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.mutationAdapter.duplicateNodes(nodeIds, targetParentId, options);
  }

  async pasteNodes(
    targetParentId: NodeId,
    contextOverrides?: Partial<AdapterContext>,
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.mutationAdapter.pasteNodes(targetParentId, options);
  }

  async removeNodes(nodeIds: NodeId[], contextOverrides?: Partial<AdapterContext>): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.mutationAdapter.removeNodes(nodeIds, options);
  }

  async restoreFromTrash(
    nodeIds: NodeId[],
    targetParentId?: NodeId,
    contextOverrides?: Partial<AdapterContext>,
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.mutationAdapter.restoreFromTrash(nodeIds, targetParentId, options);
  }

  // =====================
  // Working Copy Operations (Editing)
  // =====================

  async startNodeEdit(
    sourceNodeId: NodeId,
    contextOverrides?: Partial<AdapterContext>,
  ): Promise<DraftEditSession> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.draftAdapter.startNodeEdit(sourceNodeId, options);
  }

  async startNodeCreate(
    parentId: NodeId,
    name: string,
    description?: string,
    nodeType: string = 'folder',
    contextOverrides?: Partial<AdapterContext>,
  ): Promise<DraftEditSession> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.draftAdapter.startNodeCreate(parentId, name, description, nodeType, options);
  }

  async commitNodeEdit(
    editSession: DraftEditSession,
    contextOverrides?: Partial<AdapterContext>,
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.draftAdapter.commitNodeEdit(editSession, options);
  }

  async commitNodeCreate(
    editSession: DraftEditSession,
    contextOverrides?: Partial<AdapterContext>,
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.draftAdapter.commitNodeCreate(editSession, options);
  }

  async discardDraft(
    editSession: DraftEditSession,
    contextOverrides?: Partial<AdapterContext>,
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.draftAdapter.discardDraft(editSession, options);
  }

  // =====================
  // Lifecycle Management
  // =====================

  cleanup(): void {
    this.subscriptionManager.cleanupAll();
  }

  cleanupNodeSubscriptions(nodeId: NodeId): void {
    this.subscriptionManager.unsubscribeByNodeId(nodeId);
  }

  getAdapterInfo(): {
    viewId: string;
    defaultOnNameConflict: OnNameConflict;
    subscriptionStats: ReturnType<SubscriptionManager<T>['getSubscriptionStats']>;
  } {
    return {
      viewId: this.viewId,
      defaultOnNameConflict: this.defaultOnNameConflict,
      subscriptionStats: this.subscriptionManager.getSubscriptionStats(),
    };
  }

  updateViewId(newViewId: string): void {
    this.viewId = newViewId;
  }
}
