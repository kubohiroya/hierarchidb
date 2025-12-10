import type {
  CommitResult,
  NodeId,
  NodeType,
  OnNameConflict,
  DialogUIState,
  TreeNode,
  TreeNodeMetadata,
  ValidationResult,
} from '@hierarchidb/common-types';

/**
 * Tree node updater API (formerly DraftAPI).
 *
 * Provides isolated editing capabilities through drafts that can be committed
 * or discarded without touching the committed tree node until requested.
 */
export interface TreeNodeUpdaterAPI {
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

  /**
   * Persist dialog UI state for a node (e.g., window position/size, active step).
   *
   * @param nodeId - Target node identifier
   * @param updater - Dialog UI state to store; pass null to clear
   */
  updateTreeNodeDialogUIState(nodeId: NodeId, updater: DialogUIState | null): Promise<void>;

  listDrafts(): Promise<TreeNode[]>;

  hasDraft(nodeId: NodeId): Promise<boolean>;

  commitDraft(nodeId: NodeId, options?: CommitDraftOptions): Promise<CommitResult>;

  discardDraft(nodeId: NodeId, options?: DiscardDraftOptions): Promise<void>;

  discardAllDrafts(): Promise<number>;

  validateDraft(nodeId: NodeId): Promise<ValidationResult>;

  hasUnsavedChanges(nodeId: NodeId): Promise<boolean>;
}

export interface CommitDraftOptions {
  /**
   * Policy for resolving name conflicts during commit operations.
   * Defaults to `'auto-rename'` for backward compatibility.
   */
  onNameConflict?: OnNameConflict;
}

export interface DiscardDraftOptions {
  /**
   * If true, delete uncommitted drafts even when they still carry draft payloads.
   * Useful for canceling create flows where the node was never committed.
   */
  forceDelete?: boolean;
}

// Ensure a runtime-worker module is emitted for NodeNext resolution
export {};
