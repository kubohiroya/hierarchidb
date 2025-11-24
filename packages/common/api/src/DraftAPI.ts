/**
 * Working copy management API for draft and edit operations.
 *
 * Manages working copies for node editing, providing isolation from main data
 * until changes are committed or discarded.
 */

import type {
  CommitResult,
  NodeId,
  NodeType,
  OnNameConflict,
  TreeNode,
  ValidationResult,
} from '@hierarchidb/common-types';

export interface CommitDraftOptions {
  /**
   * Policy for resolving name conflicts during commit operations.
   * Defaults to `'auto-rename'` for backward compatibility.
   */
  onNameConflict?: OnNameConflict;
}

/**
 * Working copy management API
 *
 * Provides isolated editing capabilities through working copies that can be
 * committed to or discarded from the main database.
 */
export interface DraftAPI {
  createDraftBase(
    nodeType: NodeType,
    parentId: NodeId,
    initialData?: Partial<TreeNode>
  ): Promise<TreeNode>;

  createDraftFromNode(nodeId: NodeId): Promise<TreeNode>;

  getDraft(nodeId: NodeId): Promise<TreeNode | undefined>;

  updateDraft(nodeId: NodeId, updates: Partial<TreeNode>): Promise<TreeNode>;

  listDrafts(): Promise<TreeNode[]>;

  hasDraft(nodeId: NodeId): Promise<boolean>;

  commitDraft(nodeId: NodeId, options?: CommitDraftOptions): Promise<CommitResult>;

  discardDraft(nodeId: NodeId): Promise<void>;

  discardAllDrafts(): Promise<number>;

  validateDraft(nodeId: NodeId): Promise<ValidationResult>;

  hasUnsavedChanges(nodeId: NodeId): Promise<boolean>;
}

// Ensure a runtime module is emitted for NodeNext resolution
export {};
