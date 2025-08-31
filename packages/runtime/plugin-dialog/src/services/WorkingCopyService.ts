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
    // Subscribe to working copy changes from Worker
    // This would use Comlink's proxy mechanism
    if (this.workerAPI.subscribeToWorkingCopyChanges) {
      this.workerAPI.subscribeToWorkingCopyChanges((nodeId: NodeId, state: any) => {
        this.handleWorkingCopyChange(nodeId, state);
      });
    }
  }

  /**
   * Handle working copy change from Worker
   */
  private handleWorkingCopyChange(nodeId: NodeId, state: any) {
    // Evaluate capabilities based on new state
    const evaluatedState = this.evaluateCapabilities(nodeId, state);
    
    // Update cache
    this.stateCache.set(nodeId, evaluatedState);
    
    // Notify subscribers
    const subscriber = this.subscribers.get(nodeId as string);
    if (subscriber) {
      subscriber(evaluatedState);
    }
  }

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
      const response = await this.workerAPI.getWorkingCopy(nodeId);
      
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
      const response = await this.workerAPI.updateWorkingCopy(nodeId, {
        data: updates.data,
        currentStep: updates.currentStep,
        completedSteps: Array.from(updates.completedSteps || []),
      });

      // The Worker will trigger a state change notification
      // which will be handled by handleWorkingCopyChange
      
      return this.evaluateCapabilities(nodeId, response);
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
    nodeId: NodeId,
    stepIndex: number,
    data: any
  ): Promise<StepCapabilitiesState> {
    try {
      // Call Worker API to evaluate capabilities
      // The Worker has access to the plugin and can run the capability functions
      const capabilities = await this.workerAPI.evaluateStepCapabilities(
        nodeId,
        stepIndex,
        data
      );

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
      const result = await this.workerAPI.saveWorkingCopy(nodeId, { isDraft: asDraft });
      
      // Clear cache after save
      if (!asDraft) {
        this.stateCache.delete(nodeId);
        this.subscribers.delete(nodeId as string);
      }
      
      return result.nodeId;
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
      await this.workerAPI.discardWorkingCopy(nodeId);
      
      // Clear cache
      this.stateCache.delete(nodeId);
      this.subscribers.delete(nodeId as string);
    } catch (error) {
      console.error('Failed to discard working copy:', error);
      throw error;
    }
  }
}