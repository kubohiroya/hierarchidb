import type { CommitResult, NodeId, TreeId } from '@hierarchidb/common-types';
import type { CommitWorkingCopyOptions, WorkerAPI } from '@hierarchidb/common-api';

export interface StepCapabilitiesState {
  canNavigateToSteps: Map<number, boolean>;
  canProceedToNext: boolean;
  canBackToPrevious: boolean;
  canSave: boolean;
  canStartBatch: boolean;
}

export interface WorkingCopyState {
  nodeId: NodeId;
  treeId: TreeId;
  nodeType: string;
  data: any;
  currentStep: number;
  completedSteps: Set<number>;
  capabilities: StepCapabilitiesState;
  isDraft?: boolean;
  lastModified: number;
}

export class WorkingCopyService {
  private workerAPI: WorkerAPI;
  private subscribers: Map<string, (state: WorkingCopyState) => void> = new Map();
  private stateCache: Map<NodeId, WorkingCopyState> = new Map();

  constructor(workerAPI: WorkerAPI) {
    this.workerAPI = workerAPI;
    this.initializeSubscriptions();
  }

  private initializeSubscriptions(): void {
    // Placeholder for worker-driven subscription wiring.
  }

  private evaluateCapabilities(nodeId: NodeId, state: any): WorkingCopyState {
    return {
      nodeId,
      treeId: state.treeId,
      nodeType: state.nodeType,
      data: state.data,
      currentStep: state.currentStep || 0,
      completedSteps: new Set(state.completedSteps || []),
      capabilities: {
        canNavigateToSteps: new Map(),
        canProceedToNext: true,
        canBackToPrevious: true,
        canSave: true,
        canStartBatch: false,
      },
      isDraft: state.isDraft,
      lastModified: Date.now(),
    } satisfies WorkingCopyState;
  }

  async loadWorkingCopy(nodeId: NodeId): Promise<WorkingCopyState> {
    try {
      const workingCopyAPI = await this.workerAPI.getWorkingCopyAPI();
      const response = await workingCopyAPI.getWorkingCopy(nodeId);

      if (!response) {
        throw new Error(`Working copy not found: ${nodeId}`);
      }

      const state = this.evaluateCapabilities(nodeId, response);
      this.stateCache.set(nodeId, state);
      return state;
    } catch (error) {
      console.error('Failed to load working copy:', error);
      throw error;
    }
  }

  async updateWorkingCopy(
    nodeId: NodeId,
    updates: Partial<WorkingCopyState>,
  ): Promise<WorkingCopyState> {
    try {
      const workingCopyAPI = await this.workerAPI.getWorkingCopyAPI();
      await workingCopyAPI.updateWorkingCopy(nodeId, updates as unknown as Record<string, unknown>);

      const prev = this.stateCache.get(nodeId) ?? ({} as WorkingCopyState);
      const merged: WorkingCopyState = {
        nodeId,
        treeId: updates.treeId ?? prev.treeId!,
        nodeType: updates.nodeType ?? prev.nodeType!,
        data: updates.data ?? prev.data ?? {},
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
        isDraft: updates.isDraft ?? prev.isDraft,
        lastModified: Date.now(),
      } satisfies WorkingCopyState;

      this.stateCache.set(nodeId, merged);
      return merged;
    } catch (error) {
      console.error('Failed to update working copy:', error);
      throw error;
    }
  }

  subscribe(nodeId: NodeId, callback: (state: WorkingCopyState) => void): () => void {
    const key = nodeId as string;
    this.subscribers.set(key, callback);
    return () => {
      this.subscribers.delete(key);
    };
  }

  async evaluateStepCapabilities(
    _nodeId: NodeId,
    _stepIndex: number,
    _data: any,
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

  async saveWorkingCopy(
    nodeId: NodeId,
    asDraft: boolean = false,
    options?: CommitWorkingCopyOptions,
  ): Promise<NodeId> {
    try {
      const workingCopyAPI = await this.workerAPI.getWorkingCopyAPI();
      const result = await workingCopyAPI.commitWorkingCopy(nodeId, options);

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
          name: 'WorkingCopyCommitError',
          status: result.status,
          suggestedName: result.suggestedName,
          onNameConflict: options?.onNameConflict,
        });
        throw error;
      }

      if (result.status === 'COMMIT_CONFLICT') {
        const error = new Error('Save failed: version conflict detected');
        Object.assign(error, {
          name: 'WorkingCopyCommitError',
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
        name: 'WorkingCopyCommitError',
        status: fallbackResult.status,
        onNameConflict: options?.onNameConflict,
      });
      throw error;
    } catch (error) {
      console.error('Failed to save working copy:', error);
      throw error;
    }
  }

  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    try {
      const workingCopyAPI = await this.workerAPI.getWorkingCopyAPI();
      await workingCopyAPI.discardWorkingCopy(nodeId);

      this.stateCache.delete(nodeId);
      this.subscribers.delete(nodeId as string);
    } catch (error) {
      console.error('Failed to discard working copy:', error);
      throw error;
    }
  }
}
