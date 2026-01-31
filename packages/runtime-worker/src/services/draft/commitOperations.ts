import type { NodeId, Timestamp } from '@hierarchidb/core-types';
import type { DialogUIState, OnNameConflict, TreeNode } from '@hierarchidb/tree-api';
import type { CoreDB } from '../CoreDB.js';
import type { CommandResult } from '../command-types.js';
import { WorkerErrorCodeValue } from '../command-types.js';
import { checkDraftConflict } from './lookupOperations.js';
import { createNewName, getChildNames } from './nameUtilities.js';

export type CommitOk = { status: 'ok'; nodeId: NodeId; node: TreeNode; autoRenameTo?: string };
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
export async function commitTreeNodeDraft(
  coreDB: CoreDB,
  draftNodeId: NodeId,
  onNameConflict: OnNameConflict = 'error'
): Promise<CommitResult> {
  const now = Date.now() as Timestamp;
  const draft = await coreDB.nodes.get(draftNodeId);
  if (!draft) throw new Error('Draft node not found');

  const pendingMeta = (draft as { draftMetadata?: unknown }).draftMetadata as
    | { name?: string; description?: string; tags?: string[] }
    | null
    | undefined;
  const siblingNames = await getChildNames(coreDB, draft.parentId);
  let finalName =
    (pendingMeta?.name && pendingMeta.name.trim().length
      ? pendingMeta.name
      : draft.metadata?.name) ?? '';
  const sameNameCount = siblingNames.filter((name) => name === finalName).length;
  const nameConflicts = sameNameCount > 1;

  if (nameConflicts) {
    if (onNameConflict === 'error') {
      return { status: 'NAME_CONFLICT', suggestedName: createNewName(siblingNames, finalName) };
    }
    finalName = createNewName(siblingNames, finalName);
  }

  const originalVersion = typeof draft.version === 'number' ? draft.version : 0;
  const hasConflict = await checkDraftConflict(coreDB, draft.id as NodeId);
  if (hasConflict) {
    return {
      status: 'COMMIT_CONFLICT',
      originalVersion: originalVersion + 1,
      wcVersion: originalVersion,
    };
  }

  const finalizedData = (() => {
    const candidate = (draft as { draftData?: unknown }).draftData ?? null;
    if (
      candidate &&
      typeof candidate === 'object' &&
      Object.keys(candidate as Record<string, unknown>).length === 0
    ) {
      return null;
    }
    return candidate;
  })();
  if (typeof console !== 'undefined' && typeof console.debug === 'function') {
    console.debug('[commitDraft] finalizing draft', {
      id: draft.id,
      draftMetadata: pendingMeta,
      draftData: finalizedData,
      dataBefore: draft.data,
    });
  }

  const updatedNode: TreeNode = {
    ...draft,
    metadata: {
      ...(draft.metadata ?? { name: finalName, description: undefined, tags: [] }),
      ...(pendingMeta ?? {}),
      name: finalName,
    },
    data: finalizedData as TreeNode['data'],
    draftData: null,
    draftMetadata: null,
    dialogUIState:
      (draft as { dialogUIState?: DialogUIState | null }).dialogUIState ?? ({} as DialogUIState),
    updatedAt: now,
    version: originalVersion + 1,
  };
  delete (updatedNode as { isDraft?: unknown }).isDraft;
  await coreDB.updateNode(updatedNode);

  const ok: CommitOk = { status: 'ok', nodeId: updatedNode.id as NodeId, node: updatedNode };
  if (nameConflicts && onNameConflict === 'auto-rename') ok.autoRenameTo = finalName;
  return ok;
}

// Legacy CommandResult path retained for compatibility; delegates to commitDraftV2.
// Legacy CommandResult wrapper retained for compatibility with callers expecting CommandResult.
export async function commitDraftCommand(
  coreDB: CoreDB,
  draftNodeId: NodeId,
  _isDraft: boolean,
  onNameConflict: OnNameConflict = 'error'
): Promise<CommandResult> {
  try {
    const result = await commitTreeNodeDraft(coreDB, draftNodeId, onNameConflict);
    if (result.status === 'ok') {
      return { success: true, seq: 1, nodeId: result.nodeId };
    }
    if (result.status === 'NAME_CONFLICT') {
      return {
        success: false,
        error: `Name conflict: ${result.suggestedName}`,
        code: WorkerErrorCodeValue.VALIDATION_ERROR,
      };
    }
    return {
      success: false,
      error: 'Commit conflict',
      code: WorkerErrorCodeValue.COMMIT_CONFLICT,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: WorkerErrorCodeValue.UNKNOWN_ERROR,
    };
  }
}
