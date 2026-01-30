/**
 * API for managing multi-step dialog workflows with working copies.
 */

import type { NodeId, ValidationResult } from '@hierarchidb/core-types';
import type { TreeNodeUpdater } from './tree-node-types.js';
import type { ProxyMarked } from 'comlink';

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
 * Provides methods for managing draft states and evaluating
 * capabilities for multi-step dialog workflows.
 */
export interface PluginDialogAPI {
  /**
   * Create a new draft node
   *
   * @param nodeType - The type of node to create
   * @param parentNodeId - Optional parent node ID
   * @returns The ID of the created draft
   */
  createDraft(nodeType: string, parentNodeId?: NodeId): Promise<NodeId>;

  /**
   * Get a draft by ID
   *
   * @param draftId - The ID of the draft
   * @returns The draft data or undefined if not found
   */
  getDraft(draftId: NodeId): Promise<TreeNodeUpdater | undefined>;

  /**
   * Update a draft
   *
   * @param draftId - The ID of the draft
   * @param updates - Partial updates to apply
   * @returns The updated draft data
   */
  updateDraft(draftId: NodeId, updates: Partial<TreeNodeUpdater>): Promise<TreeNodeUpdater>;

  /**
   * Delete a draft
   *
   * @param draftId - The ID of the draft to delete
   */
  deleteDraft(draftId: NodeId): Promise<void>;

  /**
   * Validate multiple drafts
   *
   * @param draftIds - Array of draft IDs to validate
   * @returns Map of draft IDs to validation results
   */
  batchValidate(draftIds: NodeId[]): Promise<Record<NodeId, ValidationResult>>;

  /**
   * Evaluate step capabilities for a draft
   *
   * @param draftId - The ID of the draft
   * @param step - The step number (0-based)
   * @returns The capabilities for the specified step
   */
  evaluateCapabilities(draftId: NodeId, step: number): Promise<StepCapabilities>;

  /**
   * Batch evaluate capabilities for multiple drafts and steps
   *
   * @param requests - Array of draft ID and step pairs
   * @returns Map of draft IDs to step capabilities
   */
  batchEvaluateCapabilities(
    requests: Array<{ draftId: NodeId; step: number }>
  ): Promise<Record<NodeId, StepCapabilities>>;

  /**
   * Save a draft as a permanent entity
   *
   * @param draftId - The ID of the draft to save
   * @returns The ID of the created entity
   */
  saveDraft(draftId: NodeId): Promise<NodeId>;
}

/**
 * Multi-Step Dialog API with Comlink proxy marking
 */
export type PluginDialogAPIProxy = PluginDialogAPI & ProxyMarked;
