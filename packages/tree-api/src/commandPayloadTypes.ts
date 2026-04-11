import type { NodeId, NodeType, PeerEntity, Timestamp, TreeId } from '@hierarchidb/core-types';
import type { DialogUIState } from './dialogStateTypes.js';
import type { OnNameConflict } from './command-types.js';
import type { TreeNode, TreeNodeMetadata } from './NODE_TYPES.js';

export interface CommandMeta {
  commandId: string;
  timestamp: Timestamp;
  userId?: string;
  correlationId?: string;
}

export type CommandEnvelope<TType extends string, TPayload> = {
  commandId: string;
  groupId: string;
  kind: TType;
  payload: TPayload;
  issuedAt: Timestamp;
  sourceViewId?: string;
  onNameConflict?: OnNameConflict;
  type?: TType;
  meta?: CommandMeta;
};

export type CopyNodesPayload = {
  nodeIds: NodeId[];
};

export type ExportNodesPayload = {
  nodeIds: NodeId[];
};

export type PasteNodesPayload = {
  nodes: Record<NodeId, TreeNode>;
  nodeIds: NodeId[];
  toParentId: NodeId;
  onNameConflict?: OnNameConflict;
};

export type ImportNodesPayload = {
  nodes: Record<NodeId, TreeNode>;
  nodeIds: NodeId[];
  toParentId: NodeId;
  onNameConflict?: OnNameConflict;
};

export type DuplicateNodesPayload = {
  nodeIds: NodeId[];
  toParentId: NodeId;
};

export type MoveNodesPayload = {
  nodeIds: NodeId[];
  toParentId: NodeId;
  onNameConflict?: OnNameConflict;
};

export type MoveToArchivePayload = {
  nodeIds: NodeId[];
};

export type UndoPayload = {
  groupId?: string;
};

export type RedoPayload = {
  groupId?: string;
};

export type CreateDraftPayload<T> = {
  nodeId: NodeId;
  draftMetadata?: Partial<TreeNodeMetadata> | null;
  draftData?: Partial<PeerEntity<T>>;
  dialogUIState?: DialogUIState | null;
};

export type CreateDraftForCreatePayload<T> = {
  draftOf: NodeId;
  parentId: NodeId;
  nodeType: NodeType;
  name: string;
  description?: string;
  treeId?: TreeId;
  draftMetadata?: Partial<TreeNodeMetadata> | null;
  draftData?: Partial<PeerEntity<T>>;
  dialogUIState?: DialogUIState | null;
};

export type DiscardDraftPayload = {
  draftId: NodeId;
  forceDelete?: boolean;
};

export type CommitDraftPayload = {
  draftId: NodeId;
  expectedUpdatedAt?: Timestamp;
  onNameConflict?: OnNameConflict;
};

export type CommitDraftForCreatePayload = {
  draftId: NodeId;
  expectedUpdatedAt?: Timestamp;
  onNameConflict?: OnNameConflict;
};

export type GetChildrenPayload = {
  parentId: NodeId;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

export type GetDescendantsPayload = {
  rootId: NodeId;
  maxDepth?: number;
  includeTypes?: NodeType[];
  excludeTypes?: NodeType[];
};

export type GetAncestorsPayload = {
  nodeId: NodeId;
};

export type SubscriptionFilter = {
  nodeTypes?: NodeType[];
};

export type ObserveNodePayload = {
  nodeId: NodeId;
  includeInitialValue?: boolean;
  filter?: SubscriptionFilter;
};

export type SubscribeChildrenPayload = {
  parentId: NodeId;
  filter?: SubscriptionFilter;
  includeInitialSnapshot?: boolean;
};

export type ObserveSubtreePayload = {
  rootId: NodeId;
  maxDepth?: number;
  filter?: SubscriptionFilter;
  includeInitialSnapshot?: boolean;
  prefetch?: { depth: number };
};
