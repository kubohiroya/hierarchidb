import type { NodeId, NodeType, PeerEntity, ValidationResult } from '@hierarchidb/core-types';
import type { OnNameConflict } from './command-types.js';
import type { CommitResult } from './commit-types.js';
import type { DialogUIState } from './dialog-state.js';
import type { TreeNode, TreeNodeMetadata } from './NODE_TYPES.js';

/**
 * Tree node updater API (formerly DraftAPI).
 *
 * Provides isolated editing capabilities through drafts that can be committed
 * or discarded without touching the committed tree node until requested.
 */
export interface TreeNodeUpdaterAPI<T> {
  initTreeNode(
    nodeType: NodeType,
    parentId: NodeId,
    initialData?: Partial<TreeNode>
  ): Promise<TreeNode>;

  getTreeNode(nodeId: NodeId): Promise<TreeNode | undefined>;

  updateTreeNodeDraftMetadata(nodeId: NodeId, updater: Partial<TreeNodeMetadata>): Promise<void>;

  updateTreeNodeDraftData(nodeId: NodeId, updater: Partial<PeerEntity<T>>): Promise<void>;

  listDrafts(): Promise<TreeNode[]>;

  hasDraft(nodeId: NodeId): Promise<boolean>;

  /**
   * Persist draft changes and optionally commit them in a single call.
   * - `mode: 'save-draft'` stores draft payloads/UI atoms without committing.
   * - `mode: 'save'` (default) optionally applies provided draft payloads/UI atoms
   *   and commits the draft.
   */
  updateTreeNode(nodeId: NodeId, request?: CommitDraftRequest<T>): Promise<CommitResult>;

  /** @deprecated use updateTreeNode */
  commitDraft(nodeId: NodeId, request?: CommitDraftRequest<T>): Promise<CommitResult>;

  discardDraft(nodeId: NodeId, options?: DiscardDraftOptions): Promise<void>;

  discardAllDrafts(): Promise<number>;

  validateDraft(nodeId: NodeId): Promise<ValidationResult>;

  hasUnsavedChanges(nodeId: NodeId): Promise<boolean>;
}

export type CommitDraftMode = 'save-draft' | 'save';

export interface CommitDraftRequest<TData> {
  draftMetadata?: Partial<TreeNodeMetadata> | null;
  draftData?: Partial<TData>;
  dialogUIState?: DialogUIState | null;
  data?: TData | null;
  metadata?: Partial<TreeNodeMetadata> | null;
  mode?: CommitDraftMode;
  /**
   * Policy for resolving name conflicts during commit operations.
   * Defaults to `'error'` so name collisions surface explicitly.
   */
  onNameConflict?: OnNameConflict;
}

export type CommitDraftOptions<TData> = Pick<CommitDraftRequest<TData>, 'onNameConflict'>;

export interface DiscardDraftOptions {
  /**
   * If true, delete uncommitted drafts even when they still carry draft payloads.
   * Useful for canceling create flows where the node was never committed.
   */
  forceDelete?: boolean;
}
