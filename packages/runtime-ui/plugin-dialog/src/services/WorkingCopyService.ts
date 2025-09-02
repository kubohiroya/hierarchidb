/**
 * Working Copy Service
 * Manages working copy state and capabilities evaluation on Worker side
 */

import { NodeId, TreeId } from '@hierarchidb/common-type';
import type { WorkerAPI } from '@hierarchidb/common-api';

/**
 * Working copy state with capabilities
 */
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

/**
 * Evaluated capabilities for current state
 */
export interface StepCapabilitiesState {
  canNavigateToSteps: Map<number, boolean>;
  canProceedToNext: boolean;
  canBackToPrevious: boolean;
  canSave: boolean;
  canStartBatch: boolean;
}

/**
 * Working Copy Service
 */
export class WorkingCopyService {
  private workerAPI: WorkerAPI;
  private subscribers: Map<string, (state: WorkingCopyState) => void> = new Map();
  private stateCache: Map<NodeId, WorkingCopyState> = new Map();

  constructor(workerAPI: WorkerAPI) {
    this.workerAPI = workerAPI;
    this.initializeSubscriptions();
  }

  /**
   * Initialize Worker subscriptions for state changes
   */
  private initializeSubscriptions() {
    // Subscribe to working copy changes from Worker (method doesn't exist)
    // This would use Comlink's proxy mechanism
    // if (this.workerAPI.subscribeToWorkingCopyChanges) {
    //   this.workerAPI.subscribeToWorkingCopyChanges((nodeId: NodeId, state: any) => {
    //     this.handleWorkingCopyChange(nodeId, state);
    //   });
    // }
  }

  // Note: no subscription handler wiring for now

  /**
   * Evaluate capabilities for current state
   */
  private evaluateCapabilities(nodeId: NodeId, state: any): WorkingCopyState {
    // This would call the plugin's capability functions
    // In practice, this evaluation happens on the Worker side
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
    };
  }

  /**
   * Load working copy
   */
  async loadWorkingCopy(nodeId: NodeId): Promise<WorkingCopyState> {
    try {
      // Call Worker API to load working copy
      const workingCopyAPI = await this.workerAPI.getWorkingCopyAPI();
      const response = await workingCopyAPI.getWorkingCopy(nodeId);
      
      if (!response) {
        throw new Error(`Working copy not found: ${nodeId}`);
      }

      // Evaluate capabilities
      const state = this.evaluateCapabilities(nodeId, response);
      
      // Cache the state
      this.stateCache.set(nodeId, state);
      
      return state;
    } catch (error) {
      console.error('Failed to load working copy:', error);
      throw error;
    }
  }

  /**
   * Update working copy
   */
  async updateWorkingCopy(
    nodeId: NodeId,
    updates: Partial<WorkingCopyState>
  ): Promise<WorkingCopyState> {
    try {
      // Call Worker API to update
      const workingCopyAPI = await this.workerAPI.getWorkingCopyAPI();
      await workingCopyAPI.updateWorkingCopy(nodeId, {});

      const prev = this.stateCache.get(nodeId) || ({} as WorkingCopyState);
      const merged: WorkingCopyState = {
        nodeId,
        treeId: updates.treeId ?? prev.treeId!,
        nodeType: updates.nodeType ?? prev.nodeType!,
        data: updates.data ?? prev.data ?? {},
        currentStep: updates.currentStep ?? prev.currentStep ?? 0,
        completedSteps: updates.completedSteps ?? prev.completedSteps ?? new Set(),
        capabilities: updates.capabilities ?? prev.capabilities ?? {
          canNavigateToSteps: new Map(),
          canProceedToNext: true,
          canBackToPrevious: true,
          canSave: true,
          canStartBatch: false,
        },
        isDraft: updates.isDraft ?? prev.isDraft,
        lastModified: Date.now(),
      };
      this.stateCache.set(nodeId, merged);
      return merged;
    } catch (error) {
      console.error('Failed to update working copy:', error);
      throw error;
    }
  }

  /**
   * Subscribe to working copy changes
   */
  subscribe(nodeId: NodeId, callback: (state: WorkingCopyState) => void): () => void {
    const key = nodeId as string;
    this.subscribers.set(key, callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(key);
    };
  }

  /**
   * Evaluate step capabilities
   */
  async evaluateStepCapabilities(
    _nodeId: NodeId,
    _stepIndex: number,
    _data: any
  ): Promise<StepCapabilitiesState> {
    try {
      // Call Worker API to evaluate capabilities (method doesn't exist, return mock)
      // The Worker has access to the plugin and can run the capability functions
      const capabilities = {
        canNavigateToSteps: new Map(),
        canProceedToNext: true,
        canBackToPrevious: _stepIndex > 0,
        canSave: true,
        canStartBatch: false,
      };

      return capabilities;
    } catch (error) {
      console.error('Failed to evaluate capabilities:', error);
      // Return default capabilities on error
      return {
        canNavigateToSteps: new Map(),
        canProceedToNext: false,
        canBackToPrevious: true,
        canSave: false,
        canStartBatch: false,
      };
    }
  }

  /**
   * Save working copy
   */
  async saveWorkingCopy(nodeId: NodeId, asDraft: boolean = false): Promise<NodeId> {
    try {
      const workingCopyAPI = await this.workerAPI.getWorkingCopyAPI();
      const result = await workingCopyAPI.commitWorkingCopy(nodeId);
      
      // Clear cache after save
      if (!asDraft && result.success) {
        this.stateCache.delete(nodeId);
        this.subscribers.delete(nodeId as string);
      }
      
      if (result.success) return nodeId;
      throw new Error(result.error || 'Save failed');
    } catch (error) {
      console.error('Failed to save working copy:', error);
      throw error;
    }
  }

  /**
   * Discard working copy
   */
  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    try {
      const workingCopyAPI = await this.workerAPI.getWorkingCopyAPI();
      await workingCopyAPI.discardWorkingCopy(nodeId);
      
      // Clear cache
      this.stateCache.delete(nodeId);
      this.subscribers.delete(nodeId as string);
    } catch (error) {
      console.error('Failed to discard working copy:', error);
      throw error;
    }
  }
}
