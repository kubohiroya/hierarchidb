import crypto from 'crypto';
import type {
  CommandEnvelope,
  CommandResult,
} from '../../command-types.js';
import { WorkerErrorCode } from '../../command-types.js';
import type { CommandExecutionContext } from '../execution/CommandExecutionRunner.js';
import type { CommandHistoryManager } from '../history/CommandHistoryManager.js';
import type { CoreDB } from '../../CoreDB.js';
import {
  commitWorkingCopyV2,
  createNewName,
} from '../../WorkingCopyTreeNodeOperations.js';
import { encodeTrashHolderName } from '../../utils/holder-encoding.js';
import { hasWorkingCopyInSubtree } from '../../utils/policy-c.js';
import type {
  NodeId,
  NodeType,
  Seq,
  Timestamp,
  TreeNode,
} from '@hierarchidb/common-type';

export interface CoreCommandDeps {
  coreDB: CoreDB;
  history: CommandHistoryManager;
  batchOperationSize: number;
  deletePeerEntitiesForNodes: (nodes: TreeNode[]) => Promise<void>;
  createErrorResult: (message: string, code: WorkerErrorCode) => CommandResult;
  getNextSeq: () => Seq;
}

export async function executeCoreCommand(
  envelope: CommandEnvelope<string, unknown>,
  context: CommandExecutionContext,
  deps: CoreCommandDeps,
): Promise<CommandResult | null> {
  switch (envelope.kind) {
    case 'createNode':
      return handleCreateNode(envelope, deps);
    case 'updateNode':
      return handleUpdateNode(envelope, deps);
    case 'moveNodes':
      return handleMoveNodes(envelope, deps);
    case 'moveToTrash':
      return handleMoveToTrash(envelope, deps);
    case 'remove':
      return handleRemove(envelope, context, deps);
    case 'removeSubtree':
      return handleRemoveSubtree(envelope, context, deps);
    case 'recoverFromTrash':
      return handleRecoverFromTrash(envelope, deps);
    case 'commitWorkingCopy':
      return handleCommitWorkingCopy(envelope, deps);
    case 'invalidCommand':
      return deps.createErrorResult('Command not supported', WorkerErrorCode.INVALID_OPERATION);
    default:
      return null;
  }
}

async function handleCreateNode(
  envelope: CommandEnvelope<string, unknown>,
  deps: CoreCommandDeps,
): Promise<CommandResult> {
  try {
    const payload = envelope.payload as {
      nodeType: NodeType;
      treeId: string;
      parentId: NodeId;
      name: string;
      description?: string;
    };

    const createdAt = Date.now() as Timestamp;
    const nodeId = (await deps.coreDB.createNode({
      id: crypto.randomUUID() as NodeId,
      parentId: payload.parentId,
      nodeType: payload.nodeType,
      name: payload.name,
      depth: 0,
      createdAt,
      updatedAt: createdAt,
      version: 1,
      ...(payload.description ? { description: payload.description } : {}),
    })) as NodeId;

    deps.history.recordCreatedNode(envelope.commandId, nodeId);
    return { success: true, seq: deps.getNextSeq(), nodeId };
  } catch (error) {
    return deps.createErrorResult(
      error instanceof Error ? error.message : 'Create failed',
      WorkerErrorCode.DATABASE_ERROR,
    );
  }
}

async function handleUpdateNode(
  envelope: CommandEnvelope<string, unknown>,
  deps: CoreCommandDeps,
): Promise<CommandResult> {
  try {
    const payload = envelope.payload as {
      nodeId: NodeId;
      name?: string;
      description?: string;
    };
    const node = await deps.coreDB.getNode?.(payload.nodeId);
    if (!node) {
      return deps.createErrorResult('Node not found', WorkerErrorCode.INVALID_OPERATION);
    }

    deps.history.storePreUpdateState(envelope.commandId, node);
    await deps.coreDB.updateNode?.({
      ...node,
      ...(payload.name && { name: payload.name }),
      ...(payload.description !== undefined && { description: payload.description }),
      updatedAt: Date.now() as Timestamp,
      version: node.version + 1,
    });

    return { success: true, seq: deps.getNextSeq(), nodeId: payload.nodeId };
  } catch (error) {
    return deps.createErrorResult(
      error instanceof Error ? error.message : 'Update failed',
      WorkerErrorCode.DATABASE_ERROR,
    );
  }
}

async function handleMoveNodes(
  envelope: CommandEnvelope<string, unknown>,
  deps: CoreCommandDeps,
): Promise<CommandResult> {
  try {
    const payload = envelope.payload as {
      nodeIds: NodeId[];
      toParentId: NodeId;
      onNameConflict?: 'error' | 'auto-rename';
    };

    for (const id of payload.nodeIds) {
      if (await hasWorkingCopyInSubtree(deps.coreDB, id)) {
        return deps.createErrorResult(
          'Blocked by Policy C: working copy exists in subtree',
          WorkerErrorCode.INVALID_OPERATION,
        );
      }
    }

    const beforeNodes: TreeNode[] = [];
    const toUpdate: TreeNode[] = [];
    const siblings = (await deps.coreDB.listChildren?.(payload.toParentId)) || [];
    const siblingNames = new Set<string>(siblings.map((sibling) => sibling.name));

    for (const nodeId of payload.nodeIds) {
      const node = await deps.coreDB.getNode?.(nodeId);
      if (!node) {
        continue;
      }
      beforeNodes.push({ ...node });

      let nextName = node.name;
      if (payload.onNameConflict === 'auto-rename') {
        if (siblingNames.has(nextName)) {
          nextName = createNewName(Array.from(siblingNames), nextName);
        }
        siblingNames.add(nextName);
      }

      toUpdate.push({
        ...node,
        parentId: payload.toParentId,
        name: nextName,
        updatedAt: Date.now() as Timestamp,
      } as TreeNode);
    }

    if (toUpdate.length === 1) {
      await deps.coreDB.updateNode?.(toUpdate[0]!);
    } else if (toUpdate.length > 1) {
      const size = deps.batchOperationSize;
      for (let i = 0; i < toUpdate.length; i += size) {
        await deps.coreDB.bulkUpdateNodes?.(toUpdate.slice(i, i + size));
      }
    }

    if (beforeNodes.length > 0) {
      deps.history.storePreMoveState(envelope.commandId, beforeNodes);
    }

    return { success: true, seq: deps.getNextSeq() };
  } catch (error) {
    return deps.createErrorResult(
      error instanceof Error ? error.message : 'Move failed',
      WorkerErrorCode.DATABASE_ERROR,
    );
  }
}

async function handleMoveToTrash(
  envelope: CommandEnvelope<string, unknown>,
  deps: CoreCommandDeps,
): Promise<CommandResult> {
  try {
    const payload = envelope.payload as { nodeIds: NodeId[] };

    let trees: Array<{ rootId: NodeId; trashRootId: NodeId }> | undefined;
    try {
      trees = await deps.coreDB.trees.toArray();
    } catch {
      trees = undefined;
    }

    const rootToTrash = new Map<NodeId, NodeId>(
      Array.isArray(trees) ? trees.map((tree) => [tree.rootId, tree.trashRootId]) : [],
    );

    for (const id of payload.nodeIds) {
      const node = await deps.coreDB.getNode?.(id);
      if (!node) {
        continue;
      }

      let cursor: NodeId | undefined = node.parentId;
      let trashRootId: NodeId | undefined;
      let lastVisited: NodeId | undefined;

      while (cursor) {
        if (rootToTrash.has(cursor)) {
          trashRootId = rootToTrash.get(cursor)!;
          break;
        }
        lastVisited = cursor;
        const parent = await deps.coreDB.getNode?.(cursor);
        if (!parent || parent.parentId === cursor) {
          break;
        }
        cursor = parent.parentId;
      }

      if (!trashRootId) {
        const candidates = [cursor, lastVisited, node.parentId];
        for (const candidate of candidates) {
          if (typeof candidate !== 'string') {
            continue;
          }
          if (candidate.endsWith(':root')) {
            trashRootId = (candidate.slice(0, -(':root'.length)) + ':trash') as NodeId;
            break;
          }
          if (candidate.endsWith(':superRoot')) {
            trashRootId = (candidate.slice(0, -(':superRoot'.length)) + ':trash') as NodeId;
            break;
          }
        }
      }

      if (!trashRootId) {
        continue;
      }

      const holderId = crypto.randomUUID() as NodeId;
      const holderName = encodeTrashHolderName(node.parentId, node.id);
      const now = Date.now() as Timestamp;

      const holderNode: TreeNode = {
        id: holderId,
        parentId: trashRootId,
        nodeType: 'trash' as NodeType,
        name: holderName,
        depth: 0,
        createdAt: now,
        updatedAt: now,
        version: 1,
        holderType: 'trash' as const,
        holderTargetId: node.id,
        holderMetaParentId: node.parentId,
      };

      await deps.coreDB.createNode(holderNode);
      const updatedNode: Parameters<CoreDB['updateNode']>[0] = {
        ...node,
        parentId: holderId,
        updatedAt: now,
        version: (node.version || 1) + 1,
      };
      await deps.coreDB.updateNode?.(updatedNode);
    }

    return { success: true, seq: deps.getNextSeq() };
  } catch (error) {
    return deps.createErrorResult(
      error instanceof Error ? error.message : 'MoveToTrash failed',
      WorkerErrorCode.DATABASE_ERROR,
    );
  }
}

async function handleRemove(
  envelope: CommandEnvelope<string, unknown>,
  context: CommandExecutionContext,
  deps: CoreCommandDeps,
): Promise<CommandResult> {
  try {
    const payload = envelope.payload as { nodeIds: NodeId[] };

    for (const id of payload.nodeIds) {
      if (await hasWorkingCopyInSubtree(deps.coreDB, id)) {
        return deps.createErrorResult(
          'Blocked by Policy C: working copy exists in subtree',
          WorkerErrorCode.INVALID_OPERATION,
        );
      }
    }

    const beforeNodes: TreeNode[] = [];
    const toDeleteSet = new Set<NodeId>();
    const queue: NodeId[] = [...payload.nodeIds];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (toDeleteSet.has(current)) {
        continue;
      }
      toDeleteSet.add(current);
      const node = await deps.coreDB.getNode?.(current);
      if (node) {
        beforeNodes.push({ ...node });
      }
      const children = (await deps.coreDB.listChildren?.(current)) || [];
      for (const child of children) {
        queue.push(child.id);
      }
    }

    const ids = Array.from(toDeleteSet.values());
    const size = deps.batchOperationSize;
    for (let i = 0; i < ids.length; i += size) {
      const slice = ids.slice(i, i + size);
      if (slice.length === 1) {
        await deps.coreDB.deleteNode?.(slice[0]!);
      } else {
        await deps.coreDB.bulkDeleteNodes?.(slice);
      }
    }

    if (beforeNodes.length > 0) {
      deps.history.storePreRemoveState(envelope.commandId, beforeNodes);
      const nodesForCleanup = beforeNodes.map((node) => ({ ...node }));
      context.postCommitTasks.push(async () => {
        try {
          await deps.deletePeerEntitiesForNodes(nodesForCleanup);
        } catch (error) {
          console.warn(
            '[CommandProcessor/remove] peer-entity cleanup skipped:',
            (error as Error)?.message || error,
          );
        }
      });
    }

    return { success: true, seq: deps.getNextSeq() };
  } catch (error) {
    return deps.createErrorResult(
      error instanceof Error ? error.message : 'Remove failed',
      WorkerErrorCode.DATABASE_ERROR,
    );
  }
}

async function handleRemoveSubtree(
  envelope: CommandEnvelope<string, unknown>,
  context: CommandExecutionContext,
  deps: CoreCommandDeps,
): Promise<CommandResult> {
  try {
    const payload = envelope.payload as { rootId: NodeId };
    const collected: TreeNode[] = [];

    const visit = async (parentId: NodeId): Promise<void> => {
      const children =
        typeof deps.coreDB.listChildren === 'function'
          ? await deps.coreDB.listChildren(parentId)
          : undefined;
      if (!children || children.length === 0) {
        return;
      }
      for (const child of children) {
        await visit(child.id as NodeId);
        collected.push(child);
      }
    };

    await visit(payload.rootId);

    if (collected.length > 0) {
      const ids = collected.map((node) => node.id);
      const size = deps.batchOperationSize;
      for (let i = 0; i < ids.length; i += size) {
        const slice = ids.slice(i, i + size);
        if (deps.coreDB.bulkDeleteNodes) {
          await deps.coreDB.bulkDeleteNodes(slice);
        } else {
          for (const id of slice) {
            await deps.coreDB.deleteNode?.(id);
          }
        }
      }
      const cleanupNodes = collected.map((node) => ({ ...node }));
      context.postCommitTasks.push(async () => {
        try {
          await deps.deletePeerEntitiesForNodes(cleanupNodes);
        } catch (error) {
          console.warn(
            '[CommandProcessor/removeSubtree] peer-entity cleanup skipped:',
            (error as Error)?.message || error,
          );
        }
      });
    }

    return { success: true, seq: deps.getNextSeq() };
  } catch (error) {
    return deps.createErrorResult(
      error instanceof Error ? error.message : 'RemoveSubtree failed',
      WorkerErrorCode.DATABASE_ERROR,
    );
  }
}

async function handleRecoverFromTrash(
  envelope: CommandEnvelope<string, unknown>,
  deps: CoreCommandDeps,
): Promise<CommandResult> {
  try {
    const payload = envelope.payload as {
      nodeIds: NodeId[];
      toParentId?: NodeId;
      onNameConflict?: 'error' | 'auto-rename';
    };

    const beforeNodes: TreeNode[] = [];
    const toUpdate: TreeNode[] = [];
    const holdersToDelete: NodeId[] = [];

    for (const id of payload.nodeIds) {
      const node = await deps.coreDB.getNode?.(id);
      if (!node) {
        continue;
      }
      beforeNodes.push({ ...node });

      let targetParentId: NodeId | undefined = payload.toParentId;
      if (!targetParentId) {
        const holder = await deps.coreDB.getNode?.(node.parentId);
        if (holder?.holderMetaParentId) {
          targetParentId = holder.holderMetaParentId;
        }
      }
      targetParentId = targetParentId ?? node.parentId;
      if (!targetParentId) {
        continue;
      }

      let nextName = node.name;
      if (payload.onNameConflict === 'auto-rename') {
        const siblings = (await deps.coreDB.listChildren?.(targetParentId)) || [];
        nextName = createNewName(siblings.map((sibling) => sibling.name), nextName);
      }

      toUpdate.push({
        ...node,
        parentId: targetParentId,
        name: nextName,
        updatedAt: Date.now() as Timestamp,
        version: (node.version || 1) + 1,
        removedAt: undefined as unknown as Timestamp,
      } as TreeNode);
      holdersToDelete.push(node.parentId);
    }

    if (toUpdate.length === 1) {
      await deps.coreDB.updateNode?.(toUpdate[0]!);
    } else if (toUpdate.length > 1) {
      const size = deps.batchOperationSize;
      for (let i = 0; i < toUpdate.length; i += size) {
        await deps.coreDB.bulkUpdateNodes?.(toUpdate.slice(i, i + size));
      }
    }

    if (holdersToDelete.length > 0) {
      const size = deps.batchOperationSize;
      for (let i = 0; i < holdersToDelete.length; i += size) {
        await deps.coreDB.bulkDeleteNodes?.(holdersToDelete.slice(i, i + size));
      }
    }

    if (beforeNodes.length > 0) {
      deps.history.storePreRecoverState(envelope.commandId, beforeNodes);
    }

    return { success: true, seq: deps.getNextSeq() };
  } catch (error) {
    return deps.createErrorResult(
      error instanceof Error ? error.message : 'Recover failed',
      WorkerErrorCode.DATABASE_ERROR,
    );
  }
}

async function handleCommitWorkingCopy(
  envelope: CommandEnvelope<string, unknown>,
  deps: CoreCommandDeps,
): Promise<CommandResult> {
  try {
    const payload = envelope.payload as {
      workingCopyId: NodeId;
      expectedUpdatedAt?: Timestamp;
      onNameConflict?: 'error' | 'auto-rename';
    };

    const result = await commitWorkingCopyV2(
      deps.coreDB,
      payload.workingCopyId,
      payload.onNameConflict ?? 'error',
    );

    if (result.status === 'ok') {
      return { success: true, seq: deps.getNextSeq(), nodeId: payload.workingCopyId };
    }

    if (result.status === 'COMMIT_CONFLICT') {
      return deps.createErrorResult(
        `Commit conflict (original=${result.originalVersion}, wc=${result.wcVersion})`,
        WorkerErrorCode.COMMIT_CONFLICT,
      );
    }

    return deps.createErrorResult(
      `Name conflict. Suggested: ${result.suggestedName}`,
      WorkerErrorCode.VALIDATION_ERROR,
    );
  } catch (error) {
    return deps.createErrorResult(
      error instanceof Error ? error.message : 'Commit failed',
      WorkerErrorCode.DATABASE_ERROR,
    );
  }
}
