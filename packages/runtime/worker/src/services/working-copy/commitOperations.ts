import type { NodeId, Timestamp, TreeNode, OnNameConflict } from '@hierarchidb/common-types';
import type { CoreDB } from '../CoreDB.js';
import type { CommandResult } from '../command-types.js';
import { WorkerErrorCode } from '../command-types.js';
import { createNewName, getChildNames } from './nameUtilities.js';
import { discardWorkingCopy as discardDraft } from './cleanupOperations.js';
import { touchDraftById } from './draftOperations.js';
import { checkDraftConflict } from './lookupOperations.js';

export type CommitOk = { status: 'ok'; nodeId: NodeId; autoRenameTo?: string };
export type CommitConflict = {
  status: 'COMMIT_CONFLICT';
  originalVersion: number;
  wcVersion: number;
};
export type NameConflict = { status: 'NAME_CONFLICT'; suggestedName: string };
export type CommitResult = CommitOk | CommitConflict | NameConflict;

/**
 * Commit a draft node by applying draftData -> data and clearing draftData/dialogUIState.
 */
export async function commitWorkingCopy(
  coreDB: CoreDB,
  workingCopyNodeId: NodeId,
  onNameConflict: OnNameConflict = 'error'
): Promise<CommitResult> {
  const now = Date.now() as Timestamp;
  const draft = await coreDB.nodes.get(workingCopyNodeId);
  if (!draft) throw new Error('Draft node not found');

  const siblingNames = await getChildNames(coreDB, draft.parentId);
  let finalName = draft.name;
  const sameNameCount = siblingNames.filter((name) => name === finalName).length;
  const nameConflicts = sameNameCount > 1;

  if (nameConflicts) {
    if (onNameConflict === 'error') {
      return { status: 'NAME_CONFLICT', suggestedName: createNewName(siblingNames, finalName) };
    }
    finalName = createNewName(siblingNames, finalName);
  }

  const originalVersion = draft.version || 1;
  const hasConflict = await checkDraftConflict(coreDB, draft.id as NodeId);
  if (hasConflict) {
    return {
      status: 'COMMIT_CONFLICT',
      originalVersion: originalVersion + 1,
      wcVersion: originalVersion,
    };
  }

  const finalizedData =
    (draft as { draftData?: unknown }).draftData ?? (draft as { data?: unknown }).data ?? null;

  const updatedNode: TreeNode = {
    ...draft,
    name: finalName,
    data: finalizedData as TreeNode['data'],
    draftData: null,
    dialogUIState: undefined,
    updatedAt: now,
    version: originalVersion + 1,
  };
  delete (updatedNode as { isDraft?: unknown }).isDraft;
  await coreDB.nodes.put(updatedNode);

  await discardDraft(coreDB, workingCopyNodeId);
  await touchDraftById(coreDB, updatedNode.id as NodeId, now);

  const ok: CommitOk = { status: 'ok', nodeId: updatedNode.id as NodeId };
  if (nameConflicts && onNameConflict === 'auto-rename') ok.autoRenameTo = finalName;
  return ok;
}

// Legacy CommandResult path retained for compatibility; delegates to commitWorkingCopyV2.
// Legacy CommandResult wrapper retained for compatibility with callers expecting CommandResult.
export async function commitWorkingCopyCommand(
  coreDB: CoreDB,
  workingCopyNodeId: NodeId,
  _isDraft: boolean,
  onNameConflict: OnNameConflict = 'error'
): Promise<CommandResult> {
  try {
    const result = await commitWorkingCopy(coreDB, workingCopyNodeId, onNameConflict);
    if (result.status === 'ok') {
      return { success: true, seq: 1 as any, nodeId: result.nodeId };
    }
    if (result.status === 'NAME_CONFLICT') {
      return {
        success: false,
        error: `Name conflict: ${result.suggestedName}`,
        code: WorkerErrorCode.VALIDATION_ERROR,
      };
    }
    return {
      success: false,
      error: 'Commit conflict',
      code: WorkerErrorCode.COMMIT_CONFLICT,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: WorkerErrorCode.UNKNOWN_ERROR,
    };
  }
}
