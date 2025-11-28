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
  TreeNodeMetadata,
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
  initTreeNode(
    nodeType: NodeType,
    parentId: NodeId,
    initialData?: Partial<TreeNode>
  ): Promise<TreeNode>;

  getTreeNode(nodeId: NodeId): Promise<TreeNode | undefined>;

  updateTreeNodeDraftMetadata(
    nodeId: NodeId,
    updater: Partial<TreeNodeMetadata>
  ): Promise<void>;

  updateTreeNodeDraftData(
    nodeId: NodeId,
    updater: Record<string, unknown>
  ): Promise<void>;

  listDrafts(): Promise<TreeNode[]>;

  hasDraft(nodeId: NodeId): Promise<boolean>;

  commitDraft(nodeId: NodeId, options?: CommitDraftOptions): Promise<CommitResult>;

  discardDraft(nodeId: NodeId): Promise<void>;

  discardAllDrafts(): Promise<number>;

  validateDraft(nodeId: NodeId): Promise<ValidationResult>;

  hasUnsavedChanges(nodeId: NodeId): Promise<boolean>;
}

// Ensure a runtime-worker module is emitted for NodeNext resolution
export {};
