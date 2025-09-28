/**
  * WorkerAPIAdapter
  * TreeConsole
 * WorkerAPITreeConsole
   */

import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, TreeNodeEvent } from '@hierarchidb/common-type';
// import { TreeObservableAdapter } from './subscriptions/TreeObservableAdapter.js'; // Currently unused
import { TreeMutationCommandsAdapter } from './commands/TreeMutationCommands.js';
import { WorkingCopyCommandsAdapter, type WorkingCopyEditSession } from './commands/WorkingCopyCommands.js';
import { SubscriptionManager } from './subscriptions/SubscriptionManager.js';
import { createAdapterGroupId } from './utils.js';
import type { AdapterContext, CommandAdapterOptions, UnsubscribeFunction, WorkerAPIAdapterConfig } from './types.js';

type TreeNodeEventCallback = (event: TreeNodeEvent) => void;

export class WorkerAPIAdapter {
  private workerAPI: WorkerAPI;
  private viewId: string;
  private defaultOnNameConflict: (name: string) => string;

  // Individual adapters
  // private _observableAdapter: TreeObservableAdapter; // Currently unused - remove until needed
  private mutationAdapter: TreeMutationCommandsAdapter;
  private workingCopyAdapter: WorkingCopyCommandsAdapter;
  private subscriptionManager: SubscriptionManager;

  constructor(config: WorkerAPIAdapterConfig) {
    this.workerAPI = config.workerAPI;
    this.viewId = config.defaultViewId;
    this.defaultOnNameConflict = config.defaultOnNameConflict || ((name: string) => `${name}-copy`);

    // Initialize adapters
    // this._observableAdapter = new TreeObservableAdapter(this.workerAPI); // Currently unused
    this.mutationAdapter = new TreeMutationCommandsAdapter(this.workerAPI);
    this.workingCopyAdapter = new WorkingCopyCommandsAdapter(this.workerAPI);
    this.subscriptionManager = new SubscriptionManager(this.workerAPI, this.viewId);
  }

  /**
            * @param overrides
   * @returns AdapterContext
      */
  private createDefaultContext(overrides?: Partial<AdapterContext>): AdapterContext {
    return {
      viewId: this.viewId,
      groupId: createAdapterGroupId(),
      onNameConflict: this.defaultOnNameConflict,
      ...overrides,
    };
  }

  /**
            * @param contextOverrides
   * @returns CommandAdapterOptions
      */
  private createDefaultOptions(contextOverrides?: Partial<AdapterContext>): CommandAdapterOptions {
    return {
      context: this.createDefaultContext(contextOverrides),
    };
  }

  // =====================
  // Observable Operations (Subscription)
  // =====================

  /**
      * subscribeSubTree
      */
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

  /**
            */
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

  /**
            */
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

  // =====================
  // Mutation Operations (CRUD)
  // =====================

  /**
      * moveNodes
      */
  async moveNodes(
    nodeIds: NodeId[],
    targetParentId: NodeId,
    contextOverrides?: Partial<AdapterContext>,
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.mutationAdapter.moveNodes(nodeIds, targetParentId, options);
  }

  /**
            */
  async deleteNodes(nodeIds: NodeId[], contextOverrides?: Partial<AdapterContext>): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.mutationAdapter.deleteNodes(nodeIds, options);
  }

  /**
            */
  async duplicateNodes(
    nodeIds: NodeId[],
    targetParentId: NodeId,
    contextOverrides?: Partial<AdapterContext>,
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.mutationAdapter.duplicateNodes(nodeIds, targetParentId, options);
  }

  /**
            */
  async pasteNodes(
    targetParentId: NodeId,
    contextOverrides?: Partial<AdapterContext>,
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.mutationAdapter.pasteNodes(targetParentId, options);
  }

  /**
            */
  async removeNodes(nodeIds: NodeId[], contextOverrides?: Partial<AdapterContext>): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.mutationAdapter.removeNodes(nodeIds, options);
  }

  /**
            */
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

  /**
            */
  async startNodeEdit(
    sourceNodeId: NodeId,
    contextOverrides?: Partial<AdapterContext>,
  ): Promise<WorkingCopyEditSession> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.workingCopyAdapter.startNodeEdit(sourceNodeId, options);
  }

  /**
            */
  async startNodeCreate(
    parentId: NodeId,
    name: string,
    description?: string,
    nodeType: string = 'folder',
    contextOverrides?: Partial<AdapterContext>,
  ): Promise<WorkingCopyEditSession> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.workingCopyAdapter.startNodeCreate(parentId, name, description, nodeType, options);
  }

  /**
      * Working Copy
      */
  async commitNodeEdit(
    editSession: WorkingCopyEditSession,
    contextOverrides?: Partial<AdapterContext>,
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.workingCopyAdapter.commitNodeEdit(editSession, options);
  }

  /**
      * Working Copy
      */
  async commitNodeCreate(
    editSession: WorkingCopyEditSession,
    contextOverrides?: Partial<AdapterContext>,
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.workingCopyAdapter.commitNodeCreate(editSession, options);
  }

  /**
      * Working Copy
      */
  async discardWorkingCopy(
    editSession: WorkingCopyEditSession,
    contextOverrides?: Partial<AdapterContext>,
  ): Promise<void> {
    const options = this.createDefaultOptions(contextOverrides);
    return this.workingCopyAdapter.discardWorkingCopy(editSession, options);
  }

  // =====================
  // Lifecycle Management
  // =====================

  /**
         * unmount
      */
  cleanup(): void {
    this.subscriptionManager.cleanupAll();
  }

  /**
            */
  cleanupNodeSubscriptions(nodeId: NodeId): void {
    this.subscriptionManager.unsubscribeByNodeId(nodeId);
  }

  /**
            */
  getAdapterInfo(): {
    viewId: string;
    defaultOnNameConflict: (name: string) => string;
    subscriptionStats: ReturnType<SubscriptionManager['getSubscriptionStats']>;
  } {
    return {
      viewId: this.viewId,
      defaultOnNameConflict: this.defaultOnNameConflict,
      subscriptionStats: this.subscriptionManager.getSubscriptionStats(),
    };
  }

  /**
      * viewId
      */
  updateViewId(newViewId: string): void {
    this.viewId = newViewId;
  }
}
