/**
 * @file WorkingCopyAPI.ts
 * @description Working copy management API for draft and edit operations
 *
 * This API manages working copies for node editing, providing isolation from main data
 * until changes are committed or discarded.
 */

import type {
  NodeId,
  TreeNode,
  WorkingCopy,
  CommitResult,
  ValidationResult,
} from '@hierarchidb/common-core';

/**
 * Working copy management API
 *
 * Provides isolated editing capabilities through working copies that can be
 * committed to or discarded from the main database.
 */
export interface WorkingCopyAPI {
  // ==================
  // Working Copy Creation
  // ==================

  /**
   * Create a new draft working copy for a new node
   *
   * @param nodeType - Type of node to create
   * @param parentId - Parent node for the new node
   * @param initialData - Initial data for the working copy
   * @returns Created working copy with output nodeId
   *
   * @example
   * ```typescript
   * const workingCopy = await workingCopyAPI.createDraftWorkingCopy(
   *   'document',
   *   parentId,
   *   { name: 'New Document', description: 'Draft' }
   * );
   * console.log('Draft node ID:', workingCopy.nodeId);
   * ```
   */
  createDraftWorkingCopy(
    nodeType: string,
    parentId: NodeId,
    initialData?: Partial<TreeNode>
  ): Promise<WorkingCopy>;

  /**
   * Create a working copy from an existing node for editing
   *
   * @param nodeId - Node to create working copy from
   * @returns Working copy containing current node data
   *
   * @example
   * ```typescript
   * const workingCopy = await workingCopyAPI.createWorkingCopyFromNode(nodeId);
   * // Edit the working copy
   * await workingCopyAPI.updateWorkingCopy(nodeId, { name: 'Updated Name' });
   * ```
   */
  createWorkingCopyFromNode(nodeId: NodeId): Promise<WorkingCopy>;

  // ==================
  // Working Copy Operations
  // ==================

  /**
   * Get a working copy by node ID
   *
   * @param nodeId - Node ID (used as working copy key)
   * @returns Working copy if it exists
   */
  getWorkingCopy(nodeId: NodeId): Promise<WorkingCopy | undefined>;

  /**
   * Update a working copy with new data
   *
   * @param nodeId - Node ID of the working copy
   * @param updates - Partial updates to apply
   * @returns Updated working copy
   *
   * @example
   * ```typescript
   * const updated = await workingCopyAPI.updateWorkingCopy(
   *   nodeId,
   *   { name: 'New Name', updatedAt: Date.now() }
   * );
   * ```
   */
  updateWorkingCopy(nodeId: NodeId, updates: Partial<TreeNode>): Promise<WorkingCopy>;

  /**
   * List all active working copies
   *
   * @returns Array of all working copies in EphemeralDB
   */
  listWorkingCopies(): Promise<WorkingCopy[]>;

  /**
   * Check if a working copy exists for a node
   *
   * @param nodeId - Node ID to check
   * @returns True if working copy exists
   */
  hasWorkingCopy(nodeId: NodeId): Promise<boolean>;

  // ==================
  // Commit and Discard
  // ==================

  /**
   * Commit a working copy to the main database
   *
   * @param nodeId - Node ID of the working copy to commit
   * @returns Commit result with success status and committed node
   *
   * @example
   * ```typescript
   * const result = await workingCopyAPI.commitWorkingCopy(nodeId);
   * if (result.success) {
   *   console.log('Committed node:', result.node);
   * } else {
   *   console.error('Commit failed:', result.error);
   * }
   * ```
   */
  commitWorkingCopy(nodeId: NodeId): Promise<CommitResult>;

  /**
   * Discard a working copy without saving changes
   *
   * @param nodeId - Node ID of the working copy to discard
   * @returns Promise that resolves when working copy is removed
   *
   * @example
   * ```typescript
   * await workingCopyAPI.discardWorkingCopy(nodeId);
   * console.log('Working copy discarded');
   * ```
   */
  discardWorkingCopy(nodeId: NodeId): Promise<void>;

  /**
   * Discard all working copies
   *
   * @returns Number of working copies that were discarded
   */
  discardAllWorkingCopies(): Promise<number>;

  // ==================
  // Validation
  // ==================

  /**
   * Validate a working copy before commit
   *
   * @param nodeId - Node ID of the working copy to validate
   * @returns Validation result with any errors or warnings
   *
   * @example
   * ```typescript
   * const validation = await workingCopyAPI.validateWorkingCopy(nodeId);
   * if (!validation.valid) {
   *   console.error('Validation errors:', validation.errors);
   * }
   * ```
   */
  validateWorkingCopy(nodeId: NodeId): Promise<ValidationResult>;

  /**
   * Check if a working copy has unsaved changes
   *
   * @param nodeId - Node ID to check
   * @returns True if working copy differs from original node
   */
  hasUnsavedChanges(nodeId: NodeId): Promise<boolean>;

  // ==================
  // Bulk Operations
  // ==================

  /**
   * Commit multiple working copies in a single transaction
   *
   * @param nodeIds - Array of node IDs to commit
   * @returns Results for each commit attempt
   */
  commitMultipleWorkingCopies(nodeIds: NodeId[]): Promise<CommitResult[]>;

  /**
   * Create working copies for multiple nodes
   *
   * @param nodeIds - Array of node IDs to create working copies for
   * @returns Created working copies
   */
  createMultipleWorkingCopies(nodeIds: NodeId[]): Promise<WorkingCopy[]>;

  // ==================
  // Working Copy Status
  // ==================

  /**
   * Get working copy statistics
   *
   * @returns Statistics about working copies
   */
  getWorkingCopyStats(): Promise<{
    total: number;
    drafts: number;
    edits: number;
    oldestTimestamp: number;
    newestTimestamp: number;
  }>;

  /**
   * Clean up old working copies
   *
   * @param olderThan - Unix timestamp to clean up working copies older than
   * @returns Number of working copies that were cleaned up
   */
  cleanupOldWorkingCopies(olderThan: number): Promise<number>;
}

/**
 * Default export for the WorkingCopyAPI interface
 */
export default WorkingCopyAPI;
