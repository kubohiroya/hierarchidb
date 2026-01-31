// Type-safe command registry map and helpers
// This file defines a minimal CommandMap for core worker commands
// and utility types to infer payload/result shapes from a command kind.

import type { NodeId, NodeType, Timestamp, TreeId } from '@hierarchidb/core-types';
import type {
  CommitDraftForCreatePayload,
  CommitDraftPayload,
  CommandEnvelope as CoreCommandEnvelope,
  CommandResult as CoreCommandResult,
  CopyNodesPayload,
  CreateDraftForCreatePayload,
  CreateDraftPayload,
  DiscardDraftPayload,
  DuplicateNodesPayload,
  ExportNodesPayload,
  ImportNodesPayload,
  MoveNodesPayload,
  MoveToTrashPayload,
  PasteNodesPayload,
  RedoPayload,
  RestoreFromTrashPayload,
  UndoPayload,
} from '@hierarchidb/tree-api';

// CommandMap covers the core mutation commands first. Additional commands can be
// extended incrementally without breaking existing usages.
export interface CommandMap {
  // Core console mutations
  moveNodes: { payload: MoveNodesPayload; result: CoreCommandResult };
  duplicateNodes: { payload: DuplicateNodesPayload; result: CoreCommandResult };
  pasteNodes: { payload: PasteNodesPayload; result: CoreCommandResult };
  remove: { payload: { nodeIds: NodeId[] }; result: CoreCommandResult };
  moveToTrash: { payload: MoveToTrashPayload; result: CoreCommandResult };
  restoreFromTrash: { payload: RestoreFromTrashPayload; result: CoreCommandResult };
  importNodes: { payload: ImportNodesPayload; result: CoreCommandResult };
  copyNodes: { payload: CopyNodesPayload; result: CoreCommandResult };
  exportNodes: { payload: ExportNodesPayload; result: CoreCommandResult };

  // Undo/Redo
  undo: { payload: UndoPayload; result: CoreCommandResult };
  redo: { payload: RedoPayload; result: CoreCommandResult };

  // Minimal create/update (temporary, kept small to unblock typing)
  createNode: {
    payload: {
      nodeType: NodeType;
      treeId: TreeId;
      parentId: NodeId;
      name: string;
      description?: string;
    };
    result: CoreCommandResult;
  };
  updateNode: {
    payload: {
      nodeId: NodeId;
      name?: string;
      description?: string;
      visible?: boolean;
    };
    result: CoreCommandResult;
  };

  // Draft lifecycle (v1)
  createDraftForCreate: {
    payload: CreateDraftForCreatePayload;
    result: CoreCommandResult;
  };
  createDraft: { payload: CreateDraftPayload; result: CoreCommandResult };
  discardDraft: { payload: DiscardDraftPayload; result: CoreCommandResult };
  commitDraftForCreate: {
    payload: CommitDraftForCreatePayload;
    result: CoreCommandResult;
  };
  commitDraft: { payload: CommitDraftPayload; result: CoreCommandResult };
}

export type CommandKind = keyof CommandMap;
export type PayloadOf<K extends CommandKind> = CommandMap[K]['payload'];
export type ResultOf<K extends CommandKind> = CommandMap[K]['result'];
export type CommandEnvelope<K extends CommandKind> = CoreCommandEnvelope<K, PayloadOf<K>>;

export type AnyCommandEnvelope = CoreCommandEnvelope<string, unknown>;
export type AnyCommandResult = CoreCommandResult;

export type EnvelopeInit = {
  commandId?: string;
  groupId?: string;
  issuedAt?: Timestamp;
  sourceViewId?: string;
};
