import type { CommitResult, NodeId, TreeId } from '@hierarchidb/common-types';
import type { CommitDraftOptions, DiscardDraftOptions, WorkerAPI } from '@hierarchidb/common-api';

export interface StepCapabilitiesState {
  canNavigateToSteps: Map<number, boolean>;
  canProceedToNext: boolean;
  canBackToPrevious: boolean;
  canSave: boolean;
  canStartBatch: boolean;
}

export interface DialogState<T> {
  nodeId: NodeId;
  treeId: TreeId;
  nodeType: string;
  data: T;
  currentStep: number;
  completedSteps: Set<number>;
  capabilities: StepCapabilitiesState;
  lastModified: number;
}

export class DialogService<T> {
  private workerAPI: WorkerAPI;
  private subscribers: Map<string, (state: DialogState<T>) => void> = new Map();
  private stateCache: Map<NodeId, DialogState<T>> = new Map();

  constructor(workerAPI: WorkerAPI) {
    this.workerAPI = workerAPI;
    this.initializeSubscriptions();
  }

  private initializeSubscriptions(): void {
    // Placeholder for worker-driven subscription wiring.
  }

  /*
  private evaluateCapabilities(treeId: TreeId, nodeId: NodeId, treeNode: TreeNode<T>): DialogState<T> {
    return {
      nodeId,
      treeId,
      nodeType: treeNode.nodeType,
      data: treeNode.data,
      currentStep: state.currentStep || 0,
      completedSteps: new Set(state.completedSteps || []),
      capabilities: {
        canNavigateToSteps: new Map(),
        canProceedToNext: true,
        canBackToPrevious: true,
        canSave: true,
        canStartBatch: false,
      },
      lastModified: Date.now(),
    } satisfies DialogState<T>;
  }
   */

  async loadDraft<T>(nodeId: NodeId): Promise<DialogState<T>|null> {
    try {
      const draftAPI = await this.workerAPI.getDraftAPI();
      const treeNode = await draftAPI.getTreeNode(nodeId);

      if (!treeNode) {
        throw new Error(`TreeNode not found: ${nodeId}`);
      }

      //const state = this.evaluateCapabilities(treeId, nodeId, treeNode);
      //this.stateCache.set(nodeId, state);
      //return state;
      return null;
    } catch (error) {
      console.error('Failed to load working copy:', error);
      throw error;
    }
  }

  async updateDraft(
    nodeId: NodeId,
    updates: DialogState<T>,
  ): Promise<DialogState<T>> {
    try {
      const draftAPI = await this.workerAPI.getDraftAPI();
      await draftAPI.updateTreeNodeDraftData(
        nodeId,
        updates as unknown as Record<string, unknown>
      );

      const prev = this.stateCache.get(nodeId) ?? ({} as DialogState<T>);
      const merged: DialogState<T> = {
        nodeId,
        treeId: updates.treeId ?? prev.treeId!,
        nodeType: updates.nodeType ?? prev.nodeType!,
        data: updates.data ?? prev.data,
        currentStep: updates.currentStep ?? prev.currentStep ?? 0,
        completedSteps: updates.completedSteps ?? prev.completedSteps ?? new Set(),
        capabilities:
          updates.capabilities ??
          prev.capabilities ?? {
            canNavigateToSteps: new Map(),
            canProceedToNext: true,
            canBackToPrevious: true,
            canSave: true,
            canStartBatch: false,
          },
        lastModified: Date.now(),
      } satisfies DialogState<T>;

      this.stateCache.set(nodeId, merged);
      return merged;
    } catch (error) {
      console.error('Failed to update working copy:', error);
      throw error;
    }
  }

  subscribe(nodeId: NodeId, callback: (state: DialogState<T>) => void): () => void {
    const key = nodeId as string;
    this.subscribers.set(key, callback);
    return () => {
      this.subscribers.delete(key);
    };
  }

  async evaluateStepCapabilities(
    _nodeId: NodeId,
    _stepIndex: number,
    _data: T,
  ): Promise<StepCapabilitiesState> {
    try {
      const capabilities: StepCapabilitiesState = {
        canNavigateToSteps: new Map(),
        canProceedToNext: true,
        canBackToPrevious: _stepIndex > 0,
        canSave: true,
        canStartBatch: false,
      };

      return capabilities;
    } catch (error) {
      console.error('Failed to evaluate capabilities:', error);
      return {
        canNavigateToSteps: new Map(),
        canProceedToNext: false,
        canBackToPrevious: true,
        canSave: false,
        canStartBatch: false,
      } satisfies StepCapabilitiesState;
    }
  }

  async saveDraft(
    nodeId: NodeId,
    asDraft: boolean = false,
    options?: CommitDraftOptions,
  ): Promise<NodeId> {
    try {
      const draftAPI = await this.workerAPI.getDraftAPI();
      const result = await draftAPI.commitDraft(nodeId, options);

      if (result.status === 'ok') {
        const canonicalId = (result.nodeId as NodeId | undefined) ?? nodeId;
        if (!asDraft) {
          this.stateCache.delete(nodeId);
          this.subscribers.delete(nodeId as string);
          if (canonicalId !== nodeId) {
            this.stateCache.delete(canonicalId);
            this.subscribers.delete(canonicalId as string);
          }
        }
        return canonicalId;
      }

      if (result.status === 'NAME_CONFLICT') {
        const error = new Error(`Save failed: name conflict (suggested: ${result.suggestedName})`);
        Object.assign(error, {
          name: 'DraftCommitError',
          status: result.status,
          suggestedName: result.suggestedName,
          onNameConflict: options?.onNameConflict,
        });
        throw error;
      }

      if (result.status === 'COMMIT_CONFLICT') {
        const error = new Error('Save failed: version conflict detected');
        Object.assign(error, {
          name: 'DraftCommitError',
          status: result.status,
          originalVersion: result.originalVersion,
          wcVersion: result.wcVersion,
          onNameConflict: options?.onNameConflict,
        });
        throw error;
      }

      const fallbackResult = result as CommitResult;
      const error = new Error('Save failed: unexpected status');
      Object.assign(error, {
        name: 'DraftCommitError',
        status: fallbackResult.status,
        onNameConflict: options?.onNameConflict,
      });
      throw error;
    } catch (error) {
      console.error('Failed to save working copy:', error);
      throw error;
    }
  }

  async discardDraft(nodeId: NodeId, options?: DiscardDraftOptions): Promise<void> {
    try {
      const draftAPI = await this.workerAPI.getDraftAPI();
      await draftAPI.discardDraft(nodeId, options);

      this.stateCache.delete(nodeId);
      this.subscribers.delete(nodeId as string);
    } catch (error) {
      console.error('Failed to discard working copy:', error);
      throw error;
    }
  }
}
