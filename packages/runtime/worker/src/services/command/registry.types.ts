// Type-safe command registry map and helpers
// This file defines a minimal CommandMap for core worker commands
// and utility types to infer payload/result shapes from a command kind.

import type {
  CommandEnvelope as CoreCommandEnvelope,
  CommandResult as CoreCommandResult,
  CommitWorkingCopyForCreatePayload,
  CommitWorkingCopyPayload,
  CopyNodesPayload,
  CreateWorkingCopyForCreatePayload,
  CreateWorkingCopyPayload,
  DiscardWorkingCopyPayload,
  DuplicateNodesPayload,
  ExportNodesPayload,
  ImportNodesPayload,
  MoveNodesPayload,
  MoveToTrashPayload,
  NodeId,
  NodeType,
  PasteNodesPayload,
  RestoreFromTrashPayload,
  RedoPayload,
  Timestamp,
  TreeId,
  UndoPayload,
} from '@hierarchidb/common-types';

// CommandMap covers the core mutation commands first. Additional commands can be
// extended incrementally without breaking existing usages.
export interface CommandMap {
  // Core tree mutations
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
    };
    result: CoreCommandResult;
  };

  // WorkingCopy lifecycle (v1)
  createWorkingCopyForCreate: { payload: CreateWorkingCopyForCreatePayload; result: CoreCommandResult };
  createWorkingCopy: { payload: CreateWorkingCopyPayload; result: CoreCommandResult };
  discardWorkingCopy: { payload: DiscardWorkingCopyPayload; result: CoreCommandResult };
  commitWorkingCopyForCreate: { payload: CommitWorkingCopyForCreatePayload; result: CoreCommandResult };
  commitWorkingCopy: { payload: CommitWorkingCopyPayload; result: CoreCommandResult };
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
