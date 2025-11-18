import type { CommandResult, CommitResult, NodeId, OnNameConflict, TreeNode } from '@hierarchidb/common-types';
import type { CoreDB } from '../CoreDB.js';
import type { CommitResultV2 } from './commitOperations.js';
import { discardWorkingCopy } from './cleanupOperations.js';
import { createNewName, getChildNames } from './nameUtilities.js';

export type WorkingCopyContext = {
  wcNode?: TreeNode;
  holder?: WorkingCopyHolderNode;
  targetNodeId?: NodeId;
  targetParentNodeId?: NodeId;
};

type WorkingCopyHolderNode = TreeNode & {
  holderType?: 'workingCopy' | 'trash';
  holderTargetId?: NodeId;
  holderMetaParentId?: NodeId;
};

export async function getWorkingCopyContext(
  coreDB: CoreDB,
  workingCopyId: NodeId
): Promise<WorkingCopyContext | undefined> {
  try {
    const wcNode = await coreDB.nodes.get(workingCopyId);
    if (!wcNode) return undefined;
    const holder = await coreDB.nodes.get(wcNode.parentId);
    if (!holder) return { wcNode };
    let targetNodeId = (holder as WorkingCopyHolderNode).holderTargetId as NodeId | undefined;
    let targetParentNodeId = (holder as WorkingCopyHolderNode).holderMetaParentId as NodeId | undefined;
    if (!targetNodeId || !targetParentNodeId) {
      try {
        const { decodeWorkingCopyHolderName } = await import('../utils/holder-encoding.js');
        const parsed = decodeWorkingCopyHolderName(holder.name);
        targetNodeId = targetNodeId ?? (parsed.targetNodeId as NodeId);
        targetParentNodeId = targetParentNodeId ?? (parsed.targetParentNodeId as NodeId);
      } catch {}
    }
    return { wcNode, holder: holder as WorkingCopyHolderNode, targetNodeId, targetParentNodeId };
  } catch {
    return undefined;
  }
}

export async function mapCommandProcessorResult(
  coreDB: CoreDB,
  result: CommandResult,
  context?: WorkingCopyContext
): Promise<CommitResult | undefined> {
  if (result.success) {
    const canonicalId = (result.nodeId as NodeId | undefined) ?? context?.targetNodeId;
    if (!canonicalId) {
      return undefined;
    }
    const autoRenameTo = 'autoRenameTo' in result ? result.autoRenameTo : undefined;
    return buildOkResult(coreDB, canonicalId, context, autoRenameTo);
  }

  if (result.status === 'COMMIT_CONFLICT') {
    if (typeof result.originalVersion === 'number' && typeof result.wcVersion === 'number') {
      return {
        status: 'COMMIT_CONFLICT',
        originalVersion: result.originalVersion,
        wcVersion: result.wcVersion,
      };
    }
    return undefined;
  }

  if (result.status === 'NAME_CONFLICT' && typeof result.suggestedName === 'string') {
    return {
      status: 'NAME_CONFLICT',
      suggestedName: result.suggestedName,
    };
  }

  return undefined;
}

export async function mapCommitResultV2(
  coreDB: CoreDB,
  result: CommitResultV2,
  context?: WorkingCopyContext
): Promise<CommitResult> {
  if (result.status === 'ok') {
    const canonicalId = result.nodeId ?? context?.targetNodeId;
    if (!canonicalId) {
      throw new Error('Committed node id not found');
    }
    return buildOkResult(coreDB, canonicalId, context, result.autoRenameTo);
  }

  if (result.status === 'COMMIT_CONFLICT') {
    return {
      status: 'COMMIT_CONFLICT',
      originalVersion: result.originalVersion,
      wcVersion: result.wcVersion,
    };
  }

  return {
    status: 'NAME_CONFLICT',
    suggestedName: result.suggestedName,
  };
}

export async function commitWorkingCopyManually(
  coreDB: CoreDB,
  workingCopyId: NodeId,
  context: WorkingCopyContext | undefined,
  onNameConflict: OnNameConflict
): Promise<CommitResult> {
  let resolvedContext: WorkingCopyContext | undefined;
  try {
    resolvedContext = await ensureWorkingCopyContext(coreDB, workingCopyId, context);
    const { wcNode, holder, targetNodeId, targetParentNodeId } = resolvedContext;

    if (!wcNode || !holder) {
      throw new Error('Working copy not found');
    }
    if (!targetParentNodeId || !targetNodeId) {
      throw new Error('Holder metadata missing');
    }

    const parent = await coreDB.nodes.get(targetParentNodeId);
    if (!parent) {
      throw new Error('Parent node not found');
    }

    const siblingNames = await getChildNames(coreDB, targetParentNodeId);
    const existingNode = await coreDB.nodes.get(targetNodeId);
    const sameNameCount = siblingNames.filter((name) => name === wcNode.name).length;
    const conflictThreshold = existingNode ? 1 : 0;
    const nameConflicts = sameNameCount > conflictThreshold;
    const suggestedName = nameConflicts ? createNewName(siblingNames, wcNode.name) : undefined;
    const now = Date.now();

    if (!existingNode) {
      if (nameConflicts && onNameConflict === 'error' && suggestedName) {
        return { status: 'NAME_CONFLICT', suggestedName };
      }

      const finalName =
        nameConflicts && onNameConflict === 'auto-rename' && suggestedName
          ? suggestedName
          : wcNode.name;

      await coreDB.createNode({
        ...wcNode,
        id: targetNodeId,
        parentId: targetParentNodeId,
        name: finalName,
        updatedAt: now,
        version: (wcNode.version || 1) + 1,
      });

      await discardWorkingCopy(coreDB, [holder.id, wcNode.id]);
      const autoRenameTo = finalName !== wcNode.name ? finalName : undefined;
      return buildOkResult(coreDB, targetNodeId, resolvedContext, autoRenameTo);
    }

    const wcVersion = wcNode.version ?? 1;
    const originalVersion = existingNode.version ?? 1;
    if (originalVersion > wcVersion) {
      return {
        status: 'COMMIT_CONFLICT',
        originalVersion,
        wcVersion,
      };
    }

    const finalName = (() => {
      if (!nameConflicts || onNameConflict === 'error' || !suggestedName) {
        return wcNode.name;
      }
      return suggestedName;
    })();

    await coreDB.updateNode({
      ...wcNode,
      id: targetNodeId,
      parentId: targetParentNodeId,
      name: finalName,
      updatedAt: now,
      version: wcVersion + 1,
    });

    await discardWorkingCopy(coreDB, [holder.id, wcNode.id]);
    const autoRenameTo = finalName !== wcNode.name ? finalName : undefined;
    return buildOkResult(coreDB, targetNodeId, resolvedContext, autoRenameTo);
  } catch (error) {
    const holderId =
      resolvedContext?.wcNode?.parentId ??
      context?.wcNode?.parentId ??
      (resolvedContext?.holder?.id as NodeId | undefined);
    if (holderId) {
      await discardWorkingCopy(coreDB, [holderId, workingCopyId]);
    }
    throw error instanceof Error ? error : new Error('Commit failed');
  }
}

export async function ensureWorkingCopyContext(
  coreDB: CoreDB,
  workingCopyId: NodeId,
  context: WorkingCopyContext | undefined
): Promise<WorkingCopyContext> {
  if (context?.wcNode && context.holder && context.targetNodeId && context.targetParentNodeId) {
    return context;
  }

  const wcNode = context?.wcNode ?? (await coreDB.nodes.get(workingCopyId));
  if (!wcNode) {
    throw new Error('Working copy not found');
  }
  const holder =
    context?.holder ??
    ((await coreDB.nodes.get(wcNode.parentId)) as WorkingCopyHolderNode | undefined);
  if (!holder) {
    throw new Error('Working copy holder not found');
  }

  let targetNodeId = context?.targetNodeId ?? holder.holderTargetId;
  let targetParentNodeId = context?.targetParentNodeId ?? holder.holderMetaParentId;
  if (!targetNodeId || !targetParentNodeId) {
    try {
      const { decodeWorkingCopyHolderName } = await import('../utils/holder-encoding.js');
      const parsed = decodeWorkingCopyHolderName(holder.name);
      targetNodeId = targetNodeId ?? (parsed.targetNodeId as NodeId);
      targetParentNodeId = targetParentNodeId ?? (parsed.targetParentNodeId as NodeId);
    } catch {}
  }

  if (!targetNodeId || !targetParentNodeId) {
    throw new Error('Holder metadata missing');
  }

  return {
    wcNode,
    holder,
    targetNodeId,
    targetParentNodeId,
  };
}

export async function buildOkResult(
  coreDB: CoreDB,
  nodeId: NodeId,
  context?: WorkingCopyContext,
  autoRenameTo?: string
): Promise<CommitResult> {
  const committed = await loadCommittedNode(coreDB, nodeId, context);
  return {
    status: 'ok',
    nodeId,
    node: committed,
    autoRenameTo,
  };
}

async function loadCommittedNode(
  coreDB: CoreDB,
  explicitId: NodeId | undefined,
  context?: WorkingCopyContext
): Promise<TreeNode | undefined> {
  const candidate = explicitId ?? context?.targetNodeId;
  if (!candidate) return undefined;
  return (await coreDB.nodes.get(candidate)) ?? undefined;
}
