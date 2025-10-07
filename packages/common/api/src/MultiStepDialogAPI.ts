/**
 * @file MultiStepDialogAPI.ts
 * @description API for managing multi-step dialog workflows with working copies
 */

import type { NodeId, ValidationResult } from '@hierarchidb/common-types';
import type { ProxyMarked } from 'comlink';

/**
 * Working copy data structure
 */
export interface WorkingCopyData {
  id: NodeId;
  nodeType: string;
  parentNodeId?: NodeId;
  data: Record<string, any>;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    currentStep: number;
    validationState: Record<string, any>;
  };
}

/**
 * Step capabilities
 */
export interface StepCapabilities {
  canNavigateTo: boolean;
  canStartBatch: boolean;
  canSave: boolean;
  canProceedToNext: boolean;
  canBackToPrevious: boolean;
}

/**
 * Multi-Step Dialog API interface
 *
 * Provides methods for managing working copies and evaluating
 * capabilities for multi-step dialog workflows.
 */
export interface MultiStepDialogAPI {
  /**
   * Create a new working copy
   *
   * @param nodeType - The type of node to create
   * @param parentNodeId - Optional parent node ID
   * @returns The ID of the created working copy
   */
  createWorkingCopy(nodeType: string, parentNodeId?: NodeId): Promise<NodeId>;

  /**
   * Get a working copy by ID
   *
   * @param workingCopyId - The ID of the working copy
   * @returns The working copy data or undefined if not found
   */
  getWorkingCopy(workingCopyId: NodeId): Promise<WorkingCopyData | undefined>;

  /**
   * Update a working copy
   *
   * @param workingCopyId - The ID of the working copy
   * @param updates - Partial updates to apply
   * @returns The updated working copy data
   */
  updateWorkingCopy(
    workingCopyId: NodeId,
    updates: Partial<WorkingCopyData>,
  ): Promise<WorkingCopyData>;

  /**
   * Delete a working copy
   *
   * @param workingCopyId - The ID of the working copy to delete
   */
  deleteWorkingCopy(workingCopyId: NodeId): Promise<void>;

  /**
   * Validate multiple working copies
   *
   * @param workingCopyIds - Array of working copy IDs to validate
   * @returns Map of working copy IDs to validation results
   */
  batchValidate(workingCopyIds: NodeId[]): Promise<Record<NodeId, ValidationResult>>;

  /**
   * Evaluate step capabilities for a working copy
   *
   * @param workingCopyId - The ID of the working copy
   * @param step - The step number (0-based)
   * @returns The capabilities for the specified step
   */
  evaluateCapabilities(workingCopyId: NodeId, step: number): Promise<StepCapabilities>;

  /**
   * Batch evaluate capabilities for multiple working copies and steps
   *
   * @param requests - Array of working copy ID and step pairs
   * @returns Map of working copy IDs to step capabilities
   */
  batchEvaluateCapabilities(
    requests: Array<{ workingCopyId: NodeId; step: number }>,
  ): Promise<Record<NodeId, StepCapabilities>>;

  /**
   * Save a working copy as a permanent entity
   *
   * @param workingCopyId - The ID of the working copy to save
   * @returns The ID of the created entity
   */
  saveWorkingCopy(workingCopyId: NodeId): Promise<NodeId>;
}

/**
 * Multi-Step Dialog API with Comlink proxy marking
 */
export type MultiStepDialogAPIProxy = MultiStepDialogAPI & ProxyMarked;
