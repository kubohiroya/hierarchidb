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

  listDrafts(): Promise<TreeNode[]>;

  hasDraft(nodeId: NodeId): Promise<boolean>;

  /**
 * Persist draft changes and optionally commit them in a single call.
 * - `mode: 'save-draft'` stores draft payloads/UI atoms without committing.
 * - `mode: 'save'` (default) optionally applies provided draft payloads/UI atoms
 *   and commits the draft.
 */
  updateTreeNode(nodeId: NodeId, request?: CommitDraftRequest): Promise<CommitResult>;

  /** @deprecated use updateTreeNode */
  commitDraft(nodeId: NodeId, request?: CommitDraftRequest): Promise<CommitResult>;

  discardDraft(nodeId: NodeId, options?: DiscardDraftOptions): Promise<void>;

  discardAllDrafts(): Promise<number>;

  validateDraft(nodeId: NodeId): Promise<ValidationResult>;

  hasUnsavedChanges(nodeId: NodeId): Promise<boolean>;
}

export type CommitDraftMode = 'save-draft' | 'save';

export interface CommitDraftRequest<TData = Record<string, unknown>> {
  draftMetadata?: Partial<TreeNodeMetadata> | null;
  draftData?: TData | null;
  dialogUIState?: DialogUIState | null;
  data?: TData | null;
  metadata?: Partial<TreeNodeMetadata> | null;
  mode?: CommitDraftMode;
  /**
   * Policy for resolving name conflicts during commit operations.
   * Defaults to `'auto-rename'` for backward compatibility.
   */
  onNameConflict?: OnNameConflict;
}

export type CommitDraftOptions = Pick<CommitDraftRequest, 'onNameConflict'>;

export interface DiscardDraftOptions {
  /**
   * If true, delete uncommitted drafts even when they still carry draft payloads.
   * Useful for canceling create flows where the node was never committed.
   */
  forceDelete?: boolean;
}

// Ensure a runtime-worker module is emitted for NodeNext resolution
export {};
