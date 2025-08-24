import type { NodeId, TreeId } from './ids';
import type { TreeNode } from './tree';
import type { Timestamp } from './base';

export type CommandGroupId = string;
export type CommandId = string;
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
      nodeId?: NodeId;
      newNodeIds?: NodeId[];
      clipboardData?: {
        type: 'nodes-copy';
        timestamp: number;
        nodes: Record<string, TreeNode>;
        rootIds: NodeId[];
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
  workingCopyId: string;
  parentId: NodeId;
  name: string;
  description?: string;
}

export interface CreateWorkingCopyPayload {
  workingCopyId: string;
  sourceNodeId: NodeId;
}

export interface DiscardWorkingCopyPayload {
  workingCopyId: string;
}

export interface CommitWorkingCopyForCreatePayload {
  workingCopyId: string;
  onNameConflict?: OnNameConflict;
}

export interface CommitWorkingCopyPayload {
  workingCopyId: string;
  expectedUpdatedAt: Timestamp;
  onNameConflict?: OnNameConflict;
}

export interface MoveNodesPayload {
  nodeIds: NodeId[];
  toParentId: NodeId;
  onNameConflict?: OnNameConflict;
}

export interface DuplicateNodesPayload {
  nodeIds: NodeId[];
  toParentId: NodeId;
  onNameConflict?: OnNameConflict;
}

export interface PasteNodesPayload {
  nodes: Record<NodeId, TreeNode>;
  nodeIds: NodeId[];
  toParentId: NodeId;
  onNameConflict?: OnNameConflict;
}

export interface MoveToTrashPayload {
  nodeIds: NodeId[];
}

export interface RemovePayload {
  nodeIds: NodeId[];
}

export interface RecoverFromTrashPayload {
  nodeIds: NodeId[];
  toParentId?: NodeId;
  onNameConflict?: OnNameConflict;
}

export interface ImportNodesPayload {
  nodes: Record<NodeId, TreeNode>;
  nodeIds: NodeId[];
  toParentId: NodeId;
  onNameConflict?: OnNameConflict;
}

export interface CopyNodesPayload {
  nodeIds: NodeId[];
}

export interface ExportNodesPayload {
  nodeIds: NodeId[];
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
  id: NodeId;
}

export interface GetChildrenPayload {
  parentId: NodeId;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface GetDescendantsPayload {
  rootId: NodeId;
  maxDepth?: number;
  includeTypes?: string[];
  excludeTypes?: string[];
}

export interface GetAncestorsPayload {
  nodeId: NodeId;
}

export interface SearchNodesPayload {
  query: string;
  searchInDescription?: boolean;
  caseSensitive?: boolean;
  useRegex?: boolean;
  rootNodeId?: NodeId;
}

// TreeObservableService payloads
export interface ObserveNodePayload {
  nodeId: NodeId;
  filter?: SubscriptionFilter;
  includeInitialValue?: boolean;
}

export interface SubscribeChildrenPayload {
  parentId: NodeId;
  filter?: SubscriptionFilter;
  includeInitialSnapshot?: boolean;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ObserveSubtreePayload {
  rootId: NodeId;
  maxDepth?: number;
  filter?: SubscriptionFilter;
  includeInitialSnapshot?: boolean;
}

export interface ObserveWorkingCopiesPayload {
  nodeId?: NodeId;
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
  nodeId: NodeId;
  parentId?: NodeId;
  previousParentId?: NodeId;
  node?: TreeNode;
  previousNode?: TreeNode;
  affectedChildren?: NodeId[];
  timestamp: Timestamp;
  commandId?: CommandId;
}
