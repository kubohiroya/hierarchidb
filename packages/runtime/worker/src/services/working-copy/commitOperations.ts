import {
  type NodeBase,
  type NodeId,
  type Seq,
  type Timestamp,
  type TreeNode,
} from '@hierarchidb/common-types';
import type { CoreDB } from '../CoreDB.js';
import type { CommandResult } from '../command-types.js';
import { WorkerErrorCode } from '../command-types.js';
import { discardWorkingCopy } from './cleanupOperations.js';
import { createNewName, getChildNames } from './nameUtilities.js';

export type CommitOk = { status: 'ok'; nodeId: NodeId; autoRenameTo?: string };
export type CommitConflict = {
  status: 'COMMIT_CONFLICT';
  originalVersion: number;
  wcVersion: number;
};
export type NameConflict = { status: 'NAME_CONFLICT'; suggestedName: string };
export type CommitResultV2 = CommitOk | CommitConflict | NameConflict;

export async function commitWorkingCopyV2(
  coreDB: CoreDB,
  workingCopyNodeId: NodeId,
  onNameConflict: 'error' | 'auto-rename' = 'error'
): Promise<CommitResultV2> {
  const now = Date.now() as Timestamp;
  const wcNode = await coreDB.nodes.get(workingCopyNodeId);
  if (!wcNode) throw new Error('Working copy not found');

  const holder = await coreDB.nodes.get(wcNode.parentId);
  if (!holder) throw new Error('Working copy holder not found');

  const holderMetaParentId = (holder as { holderMetaParentId?: NodeId }).holderMetaParentId;
  const holderTargetId = (holder as { holderTargetId?: NodeId }).holderTargetId;
  let targetParentNodeId = holderMetaParentId;
  let targetNodeId = holderTargetId;
  if (!targetParentNodeId || !targetNodeId) {
    try {
      const { decodeWorkingCopyHolderName } = await import('../utils/holder-encoding.js');
      const parsed = decodeWorkingCopyHolderName(holder.name);
      targetParentNodeId = targetParentNodeId ?? parsed.targetParentNodeId;
      targetNodeId = targetNodeId ?? parsed.targetNodeId;
    } catch {}
  }
  if (!targetParentNodeId || !targetNodeId) throw new Error('Holder metadata missing');
  const parentNode = await coreDB.nodes.get(targetParentNodeId);
  if (!parentNode) throw new Error('Parent node not found');

  const originalNode = await coreDB.nodes.get(targetNodeId);
  const siblingNames = await getChildNames(coreDB, targetParentNodeId);

  const baseName = wcNode.name;
  let finalName = baseName;
  const sameNameCount = siblingNames.filter((name) => name === baseName).length;
  const nameConflicts = sameNameCount > (originalNode ? 1 : 0);

  if (!originalNode) {
    if (nameConflicts) {
      if (onNameConflict === 'error') {
        return { status: 'NAME_CONFLICT', suggestedName: createNewName(siblingNames, finalName) };
      }
      finalName = createNewName(siblingNames, finalName);
    }

    const computedDepth = (typeof parentNode.depth === 'number' ? parentNode.depth : 0) + 1;

    const finalizedData = (wcNode as { draftData?: unknown }).draftData ?? (wcNode as { data?: unknown }).data ?? null;

    const newNode: TreeNode = {
      ...wcNode,
      id: targetNodeId,
      parentId: targetParentNodeId,
      name: finalName,
      data: finalizedData as TreeNode['data'],
      draftData: null,
      dialogUIState: undefined,
      updatedAt: now,
      version: (wcNode.version || 1) + 1,
      depth: computedDepth,
    };
    await coreDB.createNode(newNode);

    await discardWorkingCopy(coreDB, [holder.id, wcNode.id]);
    const ok: CommitOk = { status: 'ok', nodeId: targetNodeId };
    if (nameConflicts && onNameConflict === 'auto-rename') ok.autoRenameTo = finalName;
    return ok;
  }

  const originalVersion = wcNode.version || 1;
  if (originalNode.version > originalVersion) {
    return {
      status: 'COMMIT_CONFLICT',
      originalVersion: originalNode.version,
      wcVersion: originalVersion,
    };
  }

  if (nameConflicts) {
    if (onNameConflict === 'error') {
      return { status: 'NAME_CONFLICT', suggestedName: createNewName(siblingNames, finalName) };
    }
    finalName = createNewName(siblingNames, finalName);
  }

  const finalizedData =
    (wcNode as { draftData?: unknown }).draftData ?? (wcNode as { data?: unknown }).data ?? null;

  const wcUpdate: Pick<TreeNode, 'id'> & Partial<TreeNode> = {
    ...wcNode,
    id: targetNodeId,
    parentId: targetParentNodeId,
    name: finalName,
    data: finalizedData as TreeNode['data'],
    draftData: null,
    dialogUIState: undefined,
    updatedAt: now,
    version: (wcNode.version || 1) + 1,
  };
  delete (wcUpdate as { isDraft?: unknown }).isDraft;
  await coreDB.updateNode(wcUpdate);

  await discardWorkingCopy(coreDB, [holder.id, wcNode.id]);
  const ok: CommitOk = { status: 'ok', nodeId: targetNodeId };
  if (nameConflicts && onNameConflict === 'auto-rename') ok.autoRenameTo = finalName;
  return ok;
}

export async function commitWorkingCopy(
  coreDB: CoreDB,
  workingCopyNodeId: NodeId,
  isDraft: boolean,
  onNameConflict: 'error' | 'auto-rename' = 'error'
): Promise<CommandResult> {
  try {
    const now = Date.now() as Timestamp;
    const workingCopyNode = await coreDB.nodes.get(workingCopyNodeId);

    if (!workingCopyNode) {
      return {
        success: false,
        error: 'Working copy not found',
        code: WorkerErrorCode.WORKING_COPY_NOT_FOUND,
      };
    }

    const workingCopyNodeHolder = await coreDB.nodes.get(workingCopyNode.parentId);

    if (!workingCopyNodeHolder) {
      return {
        success: false,
        error: 'Working copy holder not found',
        code: WorkerErrorCode.WORKING_COPY_NOT_FOUND,
      };
    }

    const parentId = (workingCopyNodeHolder as { holderMetaParentId?: NodeId }).holderMetaParentId;
    const nodeId = (workingCopyNodeHolder as { holderTargetId?: NodeId }).holderTargetId;
    if (!parentId || !nodeId) {
      return {
        success: false,
        error: 'Holder metadata missing',
        code: WorkerErrorCode.WORKING_COPY_NOT_FOUND,
      };
    }

    const parentNode = await coreDB.nodes.get(parentId);
    if (!parentNode) {
      return {
        success: false,
        error: 'Parent node not found',
        code: WorkerErrorCode.WORKING_COPY_NOT_FOUND,
      };
    }

    const originalNode = await coreDB.nodes.get(nodeId);
    if (!originalNode) {
      return {
        success: false,
        error: 'Original node not found',
        code: WorkerErrorCode.WORKING_COPY_NOT_FOUND,
      };
    }

    const siblingNames = await getChildNames(coreDB, parentId);
    let name = workingCopyNode.name;
    const sameNameCount = siblingNames.filter((n) => n === name).length;
    const nameConflicts = sameNameCount > 1;

    if (nameConflicts) {
      if (onNameConflict === 'error') {
        return {
          success: false,
          error: `Name "${name}" already exists`,
          code: WorkerErrorCode.VALIDATION_ERROR,
        };
      }
      name = createNewName(siblingNames, name);
    }

    const originalVersion = workingCopyNode.version || 1;
    if (originalNode.version > originalVersion) {
      return {
        success: false,
        error: 'Node was modified by another user',
        code: WorkerErrorCode.COMMIT_CONFLICT,
      };
    }

    const wcUpdate: Pick<TreeNode, 'id'> & Partial<TreeNode> = {
      ...workingCopyNode,
      id: nodeId,
      parentId,
      updatedAt: now,
      version: workingCopyNode.version + 1,
    };
    delete (wcUpdate as { isDraft?: unknown }).isDraft;
    await coreDB.updateNode(wcUpdate);

    await discardWorkingCopy(coreDB, [workingCopyNodeHolder.id, workingCopyNodeId]);

    return {
      success: true,
      seq: 1 as Seq,
      nodeId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: WorkerErrorCode.UNKNOWN_ERROR,
    };
  }
}
