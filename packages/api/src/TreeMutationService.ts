import type {
  CommandEnvelope,
  CommandResult,
  CreateWorkingCopyForCreatePayload,
  CreateWorkingCopyPayload,
  DiscardWorkingCopyPayload,
  CommitWorkingCopyForCreatePayload,
  CommitWorkingCopyPayload,
  MoveNodesPayload,
  DuplicateNodesPayload,
  PasteNodesPayload,
  MoveToTrashPayload,
  PermanentDeletePayload,
  RecoverFromTrashPayload,
  ImportNodesPayload,
  UndoPayload,
  RedoPayload,
} from '@hierarchidb/core';

export interface TreeMutationService {
  // Working copy operations
  createWorkingCopyForCreate(
    cmd: CommandEnvelope<'createWorkingCopyForCreate', CreateWorkingCopyForCreatePayload>
  ): Promise<void>;

  createWorkingCopy(
    cmd: CommandEnvelope<'createWorkingCopy', CreateWorkingCopyPayload>
  ): Promise<void>;

  discardWorkingCopyForCreate(
    cmd: CommandEnvelope<'discardWorkingCopyForCreate', DiscardWorkingCopyPayload>
  ): Promise<void>;

  discardWorkingCopy(
    cmd: CommandEnvelope<'discardWorkingCopy', DiscardWorkingCopyPayload>
  ): Promise<void>;

  commitWorkingCopyForCreate(
    cmd: CommandEnvelope<'commitWorkingCopyForCreate', CommitWorkingCopyForCreatePayload>
  ): Promise<CommandResult>;

  commitWorkingCopy(
    cmd: CommandEnvelope<'commitWorkingCopy', CommitWorkingCopyPayload>
  ): Promise<CommandResult>;

  // Physical operations
  moveNodes(cmd: CommandEnvelope<'moveNodes', MoveNodesPayload>): Promise<CommandResult>;

  duplicateNodes(
    cmd: CommandEnvelope<'duplicateNodes', DuplicateNodesPayload>
  ): Promise<CommandResult>;

  pasteNodes(cmd: CommandEnvelope<'pasteNodes', PasteNodesPayload>): Promise<CommandResult>;

  moveToTrash(cmd: CommandEnvelope<'moveToTrash', MoveToTrashPayload>): Promise<CommandResult>;

  permanentDelete(
    cmd: CommandEnvelope<'permanentDelete', PermanentDeletePayload>
  ): Promise<CommandResult>;

  recoverFromTrash(
    cmd: CommandEnvelope<'recoverFromTrash', RecoverFromTrashPayload>
  ): Promise<CommandResult>;

  importNodes(cmd: CommandEnvelope<'importNodes', ImportNodesPayload>): Promise<CommandResult>;

  // Undo/Redo
  undo(cmd: CommandEnvelope<'undo', UndoPayload>): Promise<CommandResult>;

  redo(cmd: CommandEnvelope<'redo', RedoPayload>): Promise<CommandResult>;
}
