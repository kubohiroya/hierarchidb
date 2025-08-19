import type { UUID, TreeNodeId, Timestamp, TreeId } from './base';
import type { TreeNode } from './tree';

export type CommandGroupId = UUID;
export type CommandId = UUID;
export type Seq = number;

export type OnNameConflict = 'error' | 'auto-rename';

export interface CommandEnvelope<K extends string, P> {
  commandId: CommandId;
  groupId: CommandGroupId;
  kind: K;
  payload: P;
  issuedAt: Timestamp;
  sourceViewId?: string;
  onNameConflict?: OnNameConflict;
}

export type ErrorCode =
  | 'NAME_NOT_UNIQUE'
  | 'STALE_VERSION'
  | 'HAS_INBOUND_REFS'
  | 'ILLEGAL_RELATION'
  | 'NODE_NOT_FOUND'
  | 'INVALID_OPERATION'
  | 'UNKNOWN_ERROR'
  | 'WORKING_COPY_NOT_FOUND'
  | 'COMMIT_CONFLICT'
  | 'VALIDATION_ERROR'
  | 'DATABASE_ERROR';

export type CommandResult =
  | {
      success: true;
      seq: Seq;
      nodeId?: TreeNodeId;
      newNodeIds?: TreeNodeId[];
      clipboardData?: {
        type: 'nodes-copy';
        timestamp: number;
        nodes: Record<string, TreeNode>;
        rootNodeIds: string[];
        nodeCount?: number;
      };
    }
  | {
      success: false;
      error: string;
      code: ErrorCode;
      seq?: Seq; // 失敗時もseqは採番される場合がある
    };

export interface CreateWorkingCopyForCreatePayload {
  workingCopyId: UUID;
  parentTreeNodeId: TreeNodeId;
  name: string;
  description?: string;
}

export interface CreateWorkingCopyPayload {
  workingCopyId: UUID;
  sourceTreeNodeId: TreeNodeId;
}

export interface DiscardWorkingCopyPayload {
  workingCopyId: UUID;
}

export interface CommitWorkingCopyForCreatePayload {
  workingCopyId: UUID;
  onNameConflict?: OnNameConflict;
}

export interface CommitWorkingCopyPayload {
  workingCopyId: UUID;
  expectedUpdatedAt: Timestamp;
  onNameConflict?: OnNameConflict;
}

export interface MoveNodesPayload {
  nodeIds: TreeNodeId[];
  toParentId: TreeNodeId;
  onNameConflict?: OnNameConflict;
}

export interface DuplicateNodesPayload {
  nodeIds: TreeNodeId[];
  toParentId: TreeNodeId;
  onNameConflict?: OnNameConflict;
}

export interface PasteNodesPayload {
  nodes: Record<TreeNodeId, TreeNode>;
  nodeIds: TreeNodeId[];
  toParentId: TreeNodeId;
  onNameConflict?: OnNameConflict;
}

export interface MoveToTrashPayload {
  nodeIds: TreeNodeId[];
}

export interface RemovePayload {
  nodeIds: TreeNodeId[];
}

export interface RecoverFromTrashPayload {
  nodeIds: TreeNodeId[];
  toParentId?: TreeNodeId;
  onNameConflict?: OnNameConflict;
}

export interface ImportNodesPayload {
  nodes: Record<TreeNodeId, TreeNode>;
  nodeIds: TreeNodeId[];
  toParentId: TreeNodeId;
  onNameConflict?: OnNameConflict;
}

export interface CopyNodesPayload {
  nodeIds: TreeNodeId[];
}

export interface ExportNodesPayload {
  nodeIds: TreeNodeId[];
}

export interface UndoPayload {
  groupId: CommandGroupId;
}

export interface RedoPayload {
  groupId: CommandGroupId;
}

// TreeQueryService payloads
export interface GetTreePayload {
  treeId: TreeId;
}

export interface GetNodePayload {
  treeNodeId: TreeNodeId;
}

export interface GetChildrenPayload {
  parentTreeNodeId: TreeNodeId;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface GetDescendantsPayload {
  rootNodeId: TreeNodeId;
  maxDepth?: number;
  includeTypes?: string[];
  excludeTypes?: string[];
}

export interface GetAncestorsPayload {
  nodeId: TreeNodeId;
}

export interface SearchNodesPayload {
  query: string;
  searchInDescription?: boolean;
  caseSensitive?: boolean;
  useRegex?: boolean;
  rootNodeId?: TreeNodeId;
}

// TreeObservableService payloads
export interface ObserveNodePayload {
  treeNodeId: TreeNodeId;
  filter?: SubscriptionFilter;
  includeInitialValue?: boolean;
}

export interface ObserveChildrenPayload {
  parentTreeNodeId: TreeNodeId;
  filter?: SubscriptionFilter;
  includeInitialSnapshot?: boolean;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ObserveSubtreePayload {
  rootNodeId: TreeNodeId;
  maxDepth?: number;
  filter?: SubscriptionFilter;
  includeInitialSnapshot?: boolean;
}

export interface ObserveWorkingCopiesPayload {
  nodeId?: TreeNodeId;
  includeAllDrafts?: boolean;
}

// Supporting types for TreeObservableService
export interface SubscriptionFilter {
  nodeTypes?: string[];
  includeDescendants?: boolean;
  maxDepth?: number;
  properties?: string[];
}

export type TreeChangeEventType =
  | 'node-created'
  | 'node-updated'
  | 'node-deleted'
  | 'node-moved'
  | 'children-changed';

export interface TreeChangeEvent {
  type: TreeChangeEventType;
  nodeId: TreeNodeId;
  parentId?: TreeNodeId;
  previousParentId?: TreeNodeId;
  node?: TreeNode;
  previousNode?: TreeNode;
  affectedChildren?: TreeNodeId[];
  timestamp: Timestamp;
  commandId?: CommandId;
}
