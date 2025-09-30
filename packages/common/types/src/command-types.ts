import type { NodeId, NodeType, TreeId } from './id-types.js';
import type { CommitStatus } from './commit-types.js';
import type { Timestamp } from './primitive-types.js';
import type { TreeNode } from './tree-node-types.js';

/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
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

type CommitFailureStatus = Exclude<CommitStatus, 'ok'>;

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
  status?: 'ok';
  autoRenameTo?: string;
 }
  | {
  success: false;
  error: string;
  code: ErrorCode;
  seq?: Seq; //  seq
  status?: CommitFailureStatus;
  suggestedName?: string;
  originalVersion?: number;
  wcVersion?: number;
 };

export interface CreateWorkingCopyForCreatePayload {
  workingCopyOf: NodeId;
  parentId: NodeId;
  name: string;
  description?: string;
  nodeType: NodeType;
}

export interface CreateWorkingCopyPayload {
  workingCopyId: NodeId;
}

export interface DiscardWorkingCopyPayload {
  workingCopyId: NodeId;
}

export interface CommitWorkingCopyForCreatePayload {
  workingCopyId: NodeId;
  onNameConflict?: OnNameConflict;
}

export interface CommitWorkingCopyPayload {
  workingCopyId: NodeId;
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

export type RestoreFromTrashPayload = RecoverFromTrashPayload;

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
/**
 * @deprecated Unused externally; prefer higher-level query helpers.
 */
export interface GetTreePayload {
  treeId: TreeId;
}

/**
 * @deprecated Unused externally; prefer higher-level query helpers.
 */
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

/**
 * @deprecated Unused externally; prefer domain-specific search utilities.
 */
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
  prefetch?: {
    depth: number;
  };
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
