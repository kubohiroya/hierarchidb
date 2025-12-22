// import crypto from 'crypto';

import type {
  CommandId,
  NodeId,
  NodeType,
  Seq,
  Timestamp,
  TreeNode,
} from '@hierarchidb/common-types';
import type { CoreDB } from '../../CoreDB.js';
import type { CommandEnvelope, CommandResult } from '../../command-types.js';
import { WorkerErrorCode } from '../../command-types.js';
import { commitDraft, createNewName } from '../../DraftTreeNodeOperations.js';
import type { CommandHistoryManager } from '../history/CommandHistoryManager.js';

export interface CoreCommandDeps {
  coreDB: CoreDB;
  history: CommandHistoryManager;
  batchOperationSize: number;
  onNodesRemoved?: (commandId: CommandId, nodes: TreeNode[]) => Promise<void> | void;
  createErrorResult: (
    message: string,
    code: WorkerErrorCode,
    extra?: {
      status?: 'COMMIT_CONFLICT' | 'NAME_CONFLICT';
      suggestedName?: string;
      originalVersion?: number;
      wcVersion?: number;
    }
  ) => CommandResult;
  getNextSeq: () => Seq;
}

export async function executeCoreCommand(
  envelope: CommandEnvelope<string, unknown>,
  deps: CoreCommandDeps
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
      return handleRemove(envelope, deps);
    case 'removeSubtree':
      return handleRemoveSubtree(envelope, deps);
    case 'restoreFromTrash':
      return handleRestoreFromTrash(envelope, deps);
    case 'commitDraft':
      return handleCommitDraft(envelope, deps);
    case 'invalidCommand':
      return deps.createErrorResult('Command not supported', WorkerErrorCode.INVALID_OPERATION);
    default:
      return null;
  }
}

async function handleCreateNode(
  envelope: CommandEnvelope<string, unknown>,
  deps: CoreCommandDeps
): Promise<CommandResult> {
  try {
    const payload = envelope.payload as {
      nodeType: NodeType;
      treeId: string;
      parentId: NodeId;
      metadata: { name: string; description?: string; tags?: string[] };
    };

    const createdAt = Date.now() as Timestamp;
    const nodeId = (await deps.coreDB.createNode({
      id: crypto.randomUUID() as NodeId,
      parentId: payload.parentId,
      nodeType: payload.nodeType,
      metadata: {
        name: payload.metadata.name,
        description: payload.metadata.description ?? '',
        tags: payload.metadata.tags ?? [],
      },
      draftMetadata: null,
      depth: 0,
      createdAt,
      updatedAt: createdAt,
      version: 1,
      data: {},
      draftData: null,
      ...(payload.metadata.description ? { description: payload.metadata.description } : {}),
    })) as NodeId;

    deps.history.recordCreatedNode(envelope.commandId, nodeId);
    return { success: true, seq: deps.getNextSeq(), nodeId };
  } catch (error) {
    return deps.createErrorResult(
      error instanceof Error ? error.message : 'Create failed',
      WorkerErrorCode.DATABASE_ERROR
    );
  }
}

async function handleUpdateNode(
  envelope: CommandEnvelope<string, unknown>,
  deps: CoreCommandDeps
): Promise<CommandResult> {
  try {
    const payload = envelope.payload as {
      nodeId: NodeId;
      metadata?: { name?: string; description?: string; tags?: string[] };
    };
    const node = await deps.coreDB.getNode?.(payload.nodeId);
    if (!node) {
      return deps.createErrorResult('Node not found', WorkerErrorCode.INVALID_OPERATION);
    }

    const meta = payload.metadata;
    if (meta?.name && meta.name !== node.metadata.name && node.parentId) {
      const siblings = (await deps.coreDB.listChildren?.(node.parentId)) || [];
      const hasConflict = siblings.some(
        (sibling) => sibling.id !== node.id && sibling.metadata.name === meta.name
      );
      if (hasConflict) {
        return deps.createErrorResult(
          `Name conflict: '${meta.name}' already exists`,
          WorkerErrorCode.NAME_NOT_UNIQUE
        );
      }
    }

    deps.history.storePreUpdateState(envelope.commandId, node);
    await deps.coreDB.updateNode?.({
      ...node,
      ...(meta && {
        metadata: {
          name: meta.name ?? node.metadata.name,
          description: meta.description !== undefined ? meta.description : node.metadata.description,
          tags: meta.tags ?? node.metadata.tags ?? [],
        },
      }),
      updatedAt: Date.now() as Timestamp,
      version: node.version + 1,
    });

    return { success: true, seq: deps.getNextSeq(), nodeId: payload.nodeId };
  } catch (error) {
    return deps.createErrorResult(
      error instanceof Error ? error.message : 'Update failed',
      WorkerErrorCode.DATABASE_ERROR
    );
  }
}

async function handleMoveNodes(
  envelope: CommandEnvelope<string, unknown>,
  deps: CoreCommandDeps
): Promise<CommandResult> {
  try {
      // no-op: cleaner removed in draftData model
    const payload = envelope.payload as {
      nodeIds: NodeId[];
      toParentId: NodeId;
      onNameConflict?: 'error' | 'auto-rename';
    };

    const beforeNodes: TreeNode[] = [];
    const toUpdate: TreeNode[] = [];
    const siblings = (await deps.coreDB.listChildren?.(payload.toParentId)) || [];
    const siblingNames = new Set<string>(siblings.map((sibling) => sibling.metadata.name));

    for (const nodeId of payload.nodeIds) {
      const node = await deps.coreDB.getNode?.(nodeId);
      if (!node) {
        continue;
      }
      beforeNodes.push({ ...node });

      let nextName = node.metadata.name;
      let originalNamePatch: string | undefined;
      if (payload.onNameConflict === 'auto-rename') {
        if (siblingNames.has(nextName)) {
          originalNamePatch = (node as { originalName?: string }).originalName ?? node.metadata.name;
          nextName = createNewName(Array.from(siblingNames), nextName);
        }
        siblingNames.add(nextName);
      }

      toUpdate.push({
        ...node,
        parentId: payload.toParentId,
        name: nextName,
        ...(originalNamePatch ? { originalName: originalNamePatch } : {}),
        updatedAt: Date.now() as Timestamp,
      } as TreeNode);
    }

    if (toUpdate.length === 1) {
      const [singleUpdate] = toUpdate;
      if (singleUpdate) {
        await deps.coreDB.updateNode?.(singleUpdate);
      }
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
      WorkerErrorCode.DATABASE_ERROR
    );
  }
}

async function handleMoveToTrash(
  envelope: CommandEnvelope<string, unknown>,
  deps: CoreCommandDeps
): Promise<CommandResult> {
  try {
    const payload = envelope.payload as { nodeIds: NodeId[] };
    const snapshotEntries: Array<{
      nodeId: NodeId;
      previousParentId: NodeId;
      previousName: string;
      previousOriginalName?: string;
      previousOriginalParentId?: NodeId;
      previousRemovedAt?: Timestamp;
      trashRootId: NodeId;
      trashRemovedAt: Timestamp;
      trashName: string;
    }> = [];

    let trees: Array<{ rootId: NodeId; trashRootId: NodeId }> | undefined;
    try {
      trees = await deps.coreDB.trees.toArray();
    } catch {
      trees = undefined;
    }

    const rootToTrash = new Map<NodeId, NodeId>(
      Array.isArray(trees) ? trees.map((tree) => [tree.rootId, tree.trashRootId]) : []
    );

    for (const id of payload.nodeIds) {
      const node = await deps.coreDB.getNode?.(id);
      if (!node) {
        continue;
      }

      const originalParentId = node.parentId as NodeId | undefined;
      if (!originalParentId) {
        continue;
      }

      let cursor: NodeId | undefined = originalParentId;
      let trashRootId: NodeId | undefined;
      let lastVisited: NodeId | undefined;

      while (cursor) {
        if (rootToTrash.has(cursor)) {
          const mappedTrashRootId = rootToTrash.get(cursor);
          if (mappedTrashRootId) {
            trashRootId = mappedTrashRootId;
            break;
          }
        }
        lastVisited = cursor;
        const parent = await deps.coreDB.getNode?.(cursor);
        if (!parent || parent.parentId === cursor) {
          break;
        }
        cursor = parent.parentId;
      }

      if (!trashRootId) {
        const candidates = [cursor, lastVisited, originalParentId];
        for (const candidate of candidates) {
          if (typeof candidate !== 'string') {
            continue;
          }
          if (candidate.endsWith(':root')) {
            trashRootId = `${candidate.slice(0, -':root'.length)}:trash` as NodeId;
            break;
          }
          if (candidate.endsWith(':superRoot')) {
            trashRootId = `${candidate.slice(0, -':superRoot'.length)}:trash` as NodeId;
            break;
          }
        }
      }

      if (!trashRootId) {
        continue;
      }

      if ((node as { removedAt?: Timestamp }).removedAt && node.parentId === trashRootId) {
        continue;
      }

      const now = Date.now() as Timestamp;
      const previousOriginalName = (node as { originalName?: string }).originalName;
      const previousOriginalParentId = (node as { originalParentId?: NodeId }).originalParentId;
      const previousRemovedAt = (node as { removedAt?: Timestamp }).removedAt;
      const preservedOriginalName = previousOriginalName ?? node.metadata.name;
      const trashName =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${node.id as string}-${now}`;

      const updatedNode: Parameters<CoreDB['updateNode']>[0] = {
        ...node,
        parentId: trashRootId,
        metadata: { ...node.metadata, name: trashName },
        originalName: preservedOriginalName,
        originalParentId: previousOriginalParentId ?? originalParentId,
        removedAt: now,
        updatedAt: now,
        version: (node.version || 1) + 1,
      };

      await deps.coreDB.updateNode?.(updatedNode);

      snapshotEntries.push({
        nodeId: node.id as NodeId,
        previousParentId: originalParentId,
        previousName: node.metadata.name,
        previousOriginalName,
        previousOriginalParentId,
        previousRemovedAt,
        trashRootId,
        trashRemovedAt: now,
        trashName,
      });
    }

    deps.history.storePreMoveToTrashState(envelope.commandId as CommandId, snapshotEntries);

    return { success: true, seq: deps.getNextSeq() };
  } catch (error) {
    return deps.createErrorResult(
      error instanceof Error ? error.message : 'MoveToTrash failed',
      WorkerErrorCode.DATABASE_ERROR
    );
  }
}

async function handleRemove(
  envelope: CommandEnvelope<string, unknown>,
  deps: CoreCommandDeps
): Promise<CommandResult> {
  try {
    // no-op: cleaner removed in draftData model
    const payload = envelope.payload as { nodeIds: NodeId[] };

    const beforeNodes: TreeNode[] = [];
    const toDeleteSet = new Set<NodeId>();
    const queue: NodeId[] = [...payload.nodeIds];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
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
        const [singleId] = slice;
        if (singleId) {
          await deps.coreDB.deleteNode?.(singleId);
        }
      } else {
        await deps.coreDB.bulkDeleteNodes?.(slice);
      }
    }

    if (beforeNodes.length > 0) {
      deps.history.storePreRemoveState(envelope.commandId, beforeNodes);
    }

    if (beforeNodes.length > 0 && deps.onNodesRemoved) {
      try {
        await deps.onNodesRemoved(envelope.commandId as CommandId, beforeNodes);
      } catch (error) {
        console.warn('[core-handlers] remove cleanup failed', error);
      }
    }

    return { success: true, seq: deps.getNextSeq() };
  } catch (error) {
    return deps.createErrorResult(
      error instanceof Error ? error.message : 'Remove failed',
      WorkerErrorCode.DATABASE_ERROR
    );
  }
}

async function handleRemoveSubtree(
  envelope: CommandEnvelope<string, unknown>,
  deps: CoreCommandDeps
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
    }

    if (collected.length > 0 && deps.onNodesRemoved) {
      try {
        await deps.onNodesRemoved(envelope.commandId as CommandId, collected);
      } catch (error) {
        console.warn('[core-handlers] removeSubtree cleanup failed', error);
      }
    }

    return { success: true, seq: deps.getNextSeq() };
  } catch (error) {
    return deps.createErrorResult(
      error instanceof Error ? error.message : 'RemoveSubtree failed',
      WorkerErrorCode.DATABASE_ERROR
    );
  }
}

async function handleRestoreFromTrash(
  envelope: CommandEnvelope<string, unknown>,
  deps: CoreCommandDeps
): Promise<CommandResult> {
  try {
    const payload = envelope.payload as {
      nodeIds: NodeId[];
      toParentId?: NodeId;
      onNameConflict?: 'error' | 'auto-rename';
    };

    const snapshots: Array<{
      node: TreeNode;
      holder?: TreeNode;
      nextParentId: NodeId;
      nextName: string;
    }> = [];
    const toUpdate: TreeNode[] = [];
    const siblingNameCache = new Map<NodeId, Set<string>>();
    const conflictPolicy = payload.onNameConflict ?? 'auto-rename';

    for (const id of payload.nodeIds) {
      const node = await deps.coreDB.getNode?.(id);
      if (!node) {
        continue;
      }

      // Determine target parent
      let targetParentId: NodeId | undefined = payload.toParentId;
      const recordedOriginalParent = (node as { originalParentId?: NodeId }).originalParentId;
      if (!targetParentId) {
        targetParentId = recordedOriginalParent;
      }
      if (!targetParentId) {
        // As a last resort, keep under current parent (e.g., trash root) but typically should have originalParentId
        targetParentId = node.parentId as NodeId | undefined;
      }
      if (!targetParentId) {
        continue;
      }

      // Resolve next name with conflict handling
      let siblingNames = siblingNameCache.get(targetParentId);
      if (!siblingNames) {
        const siblings = (await deps.coreDB.listChildren?.(targetParentId)) || [];
        siblingNames = new Set(siblings.map((s) => s.metadata.name));
        siblingNameCache.set(targetParentId, siblingNames);
      }

      const baseName = (node as { originalName?: string }).originalName ?? node.metadata.name;
      let nextName = baseName;
      if (conflictPolicy === 'auto-rename') {
        if (siblingNames.has(nextName)) {
          nextName = createNewName(Array.from(siblingNames), nextName);
        }
      } else if (siblingNames.has(nextName)) {
        const suggestedName = createNewName(Array.from(siblingNames), baseName);
        return deps.createErrorResult(
          `Name "${baseName}" already exists under the target parent`,
          WorkerErrorCode.NAME_NOT_UNIQUE,
          { status: 'NAME_CONFLICT', suggestedName }
        );
      }
      siblingNames.add(nextName);

      toUpdate.push({
        ...node,
        parentId: targetParentId,
        name: nextName,
        originalName: undefined,
        originalParentId: undefined,
        removedAt: undefined,
        holderType: undefined,
        holderTargetId: undefined,
        holderMetaParentId: undefined,
        updatedAt: Date.now() as Timestamp,
        version: (node.version || 1) + 1,
      } as TreeNode);

      snapshots.push({
        node: { ...node },
        holder: undefined,
        nextParentId: targetParentId,
        nextName,
      });
    }

    if (toUpdate.length === 1) {
      const [singleUpdate] = toUpdate;
      if (singleUpdate) {
        await deps.coreDB.updateNode?.(singleUpdate);
      }
    } else if (toUpdate.length > 1) {
      const size = deps.batchOperationSize;
      for (let i = 0; i < toUpdate.length; i += size) {
        await deps.coreDB.bulkUpdateNodes?.(toUpdate.slice(i, i + size));
      }
    }

    if (snapshots.length > 0) {
      deps.history.storePreRecoverState(envelope.commandId, snapshots);
    }

    return { success: true, seq: deps.getNextSeq() };
  } catch (error) {
    return deps.createErrorResult(
      error instanceof Error ? error.message : 'Recover failed',
      WorkerErrorCode.DATABASE_ERROR
    );
  }
}

async function handleCommitDraft(
  envelope: CommandEnvelope<string, unknown>,
  deps: CoreCommandDeps
): Promise<CommandResult> {
  try {
    const payload = envelope.payload as {
      draftId: NodeId;
      expectedUpdatedAt?: Timestamp;
      onNameConflict?: 'error' | 'auto-rename';
    };

    const wcNode = await deps.coreDB.nodes.get(payload.draftId);
    if (!wcNode) {
      return deps.createErrorResult('Working copy not found', WorkerErrorCode.INVALID_OPERATION);
    }
    const wcSnapshot: TreeNode = { ...wcNode };
    const result = await commitDraft(
      deps.coreDB,
      payload.draftId,
      payload.onNameConflict ?? 'error'
    );

    if (result.status === 'ok') {
      let committedSnapshot: TreeNode | undefined;
      if (result.nodeId) {
        const committedNode = await deps.coreDB.nodes.get(result.nodeId);
        if (committedNode) {
          committedSnapshot = { ...committedNode };
        }
      }
      deps.history.storeCommitDraftSnapshot(envelope.commandId as CommandId, {
        draft: wcSnapshot,
        committedNode: committedSnapshot,
      });
      return {
        success: true,
        seq: deps.getNextSeq(),
        nodeId: result.nodeId ?? payload.draftId,
        status: 'ok',
        autoRenameTo: result.autoRenameTo,
      };
    }

    if (result.status === 'COMMIT_CONFLICT') {
      return deps.createErrorResult(
        `Commit conflict (original=${result.originalVersion}, wc=${result.wcVersion})`,
        WorkerErrorCode.COMMIT_CONFLICT,
        {
          status: 'COMMIT_CONFLICT',
          originalVersion: result.originalVersion,
          wcVersion: result.wcVersion,
        }
      );
    }

    return deps.createErrorResult(
      `Name conflict. Suggested: ${result.suggestedName}`,
      WorkerErrorCode.VALIDATION_ERROR,
      {
        status: 'NAME_CONFLICT',
        suggestedName: result.suggestedName,
      }
    );
  } catch (error) {
    return deps.createErrorResult(
      error instanceof Error ? error.message : 'Commit failed',
      WorkerErrorCode.DATABASE_ERROR
    );
  }
}
