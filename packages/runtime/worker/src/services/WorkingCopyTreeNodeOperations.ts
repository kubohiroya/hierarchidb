import {
  generateNodeId,
  type NodeBase,
  type NodeId,
  type NodeType,
  type Seq,
  type Timestamp,
  type TreeId,
  type TreeNode,
} from '@hierarchidb/common-types';
import { generateUUID } from '@hierarchidb/util';
import type { CoreDB } from './CoreDB.js';
import type { CommandEnvelope, CommandResult } from './command-types.js';
import { WorkerErrorCode } from './command-types.js';
import { encodeWorkingCopyHolderName } from './utils/holder-encoding.js';

export function createWorkingCopyNodeHolderParentId(treeId: TreeId) {
  // Align with CoreDB root id convention: `${treeId}:workingCopy`
  return `${treeId}:workingCopy` as NodeId;
}

export function createWorkingCopyNodeHolderName(parentId: NodeId, nodeId: NodeId) {
  // Deprecated: use encodeWorkingCopyHolderName(parentId, targetNodeId)
  return [parentId, nodeId].join('\t') as NodeId;
}

// splitWorkingCopyNodeHolderParentIdAndNodeId removed

/**
 * Create a new draft working copy for creating a new node
 * Working copy is a pair of parent-child TreeNodes stored in the WorkingCopy root node
 */
export async function createNewDraftWorkingCopy(
  coreDB: CoreDB,
  treeId: TreeId,
  parentId: NodeId,
  nodeType: NodeType,
  baseName: string
): Promise<NodeId> {
  const workingCopyNodeHolderParentId = createWorkingCopyNodeHolderParentId(treeId);
  // Note: WorkingCopy は workingCopyRoot 直下の専用名前空間に作成するため、
  // WC 子の name は衝突を気にせず baseName をそのまま使う（衝突は commit 時のみ考慮）。

  // Generate pre-allocated IDs
  const workingCopyNodeHolderId = generateNodeId();
  const workingCopyNodeId = generateNodeId();
  const targetNodeId = generateNodeId(); // canonical id on commit
  const holderName = encodeWorkingCopyHolderName(parentId, targetNodeId);
  const now = Date.now() as Timestamp;

  // get-or-create using composite index [parentId+name]
  try {
    const existing = await coreDB.nodes
      .where('[parentId+name]')
      .equals([workingCopyNodeHolderParentId, holderName])
      .first();
    if (existing) {
      // Reuse existing holder; return its id
      return (existing.id as NodeId) || workingCopyNodeHolderId;
    }

    await coreDB.transaction('rw', coreDB.nodes, async () => {
      const workingCopyNodeHolder: TreeNode = {
        parentId: workingCopyNodeHolderParentId,
        id: workingCopyNodeHolderId,
        name: holderName,
        nodeType,
        depth: 0,
        createdAt: now,
        updatedAt: now,
        version: 1,
        holderType: 'workingCopy',
        holderTargetId: targetNodeId,
        holderMetaParentId: parentId,
        lastTouchedAt: now,
      };
      const workingCopyNode: TreeNode = {
        parentId: workingCopyNodeHolderId,
        id: workingCopyNodeId,
        nodeType,
        name: baseName,
        depth: 1,
        createdAt: now,
        updatedAt: now,
        version: 1,
        lastTouchedAt: now,
      };
      await coreDB.nodes.bulkPut([workingCopyNodeHolder, workingCopyNode]);
    });
    return workingCopyNodeHolderId;
  } catch (err: unknown) {
    // ConstraintError: created concurrently; re-read existing
    const isConstraintError =
      typeof err === 'object' &&
      err !== null &&
      (('name' in err &&
        typeof (err as { name?: unknown }).name === 'string' &&
        (err as { name: string }).name === 'ConstraintError') ||
        /Constraint/i.test(String((err as { message?: unknown }).message)));
    if (isConstraintError) {
      const holder = await coreDB.nodes
        .where('[parentId+name]')
        .equals([workingCopyNodeHolderParentId, holderName])
        .first();
      if (holder) return holder.id as NodeId;
    }
    throw err;
  }
}

// New API: get-or-create with returnedExisting flag (non-breaking)
export async function createDraftWorkingCopyGetOrCreate(
  coreDB: CoreDB,
  treeId: TreeId,
  parentId: NodeId,
  nodeType: NodeType,
  baseName: string
): Promise<{ wcHolderId: NodeId; wcNodeId: NodeId; returnedExisting: boolean }> {
  const workingCopyRootId = createWorkingCopyNodeHolderParentId(treeId);
  const targetNodeId = generateNodeId();
  const holderName = encodeWorkingCopyHolderName(parentId, targetNodeId);

  const existing = await coreDB.nodes
    .where('[parentId+name]')
    .equals([workingCopyRootId, holderName])
    .first();

  if (existing) {
    // Ensure holder metadata exists; if missing, backfill from encoded name
    const patchedExisting: TreeNode = { ...existing };
    if (
      !patchedExisting.holderType ||
      !patchedExisting.holderTargetId ||
      !patchedExisting.holderMetaParentId
    ) {
      try {
        const { decodeWorkingCopyHolderName } = await import('./utils/holder-encoding.js');
        const parsed = decodeWorkingCopyHolderName(existing.name);
        patchedExisting.holderType = 'workingCopy';
        patchedExisting.holderTargetId = parsed.targetNodeId;
        patchedExisting.holderMetaParentId = parsed.targetParentNodeId;
        await coreDB.nodes.put(patchedExisting);
      } catch {
        // ignore; commit will still be able to decode from name
      }
    }

    // Ensure child exists; if missing, create a minimal WC child under holder
    const children = await coreDB.nodes.where('parentId').equals(existing.id).toArray();
    let child = Array.isArray(children) ? children[0] : undefined;
    if (!child) {
      const wcNodeId = generateNodeId();
      const now = Date.now() as Timestamp;
      const fallbackName = baseName;
      await coreDB.createNode({
        id: wcNodeId,
        parentId: existing.id as NodeId,
        nodeType,
        name: fallbackName,
        depth: 1,
        createdAt: now,
        updatedAt: now,
        version: 1,
        lastTouchedAt: now,
      });
      // Re-read
      const arr = await coreDB.nodes.where('parentId').equals(existing.id).toArray();
      child = Array.isArray(arr) ? arr[0] : undefined;
    }
    if (child?.id) {
      await touchWorkingCopyNodes(coreDB, existing.id as NodeId, child.id as NodeId, Date.now() as Timestamp);
    }
    return {
      wcHolderId: existing.id as NodeId,
      wcNodeId: (child?.id as NodeId) || ('' as NodeId),
      returnedExisting: true,
    };
  }

  // Create new
  const wcHolderId = await createNewDraftWorkingCopy(coreDB, treeId, parentId, nodeType, baseName);
  const children = await coreDB.nodes.where('parentId').equals(wcHolderId).toArray();
  const child = Array.isArray(children) ? children[0] : undefined;
  if (child?.id) {
    await touchWorkingCopyNodes(coreDB, wcHolderId, child.id as NodeId, Date.now() as Timestamp);
  }
  return { wcHolderId, wcNodeId: (child?.id as NodeId) || ('' as NodeId), returnedExisting: false };
}

/**
 * Create a working copy from an existing node for editing
 * Working copy uses the same treeNodeId as the original
 */
export async function createWorkingCopyFromNode(
  coreDB: CoreDB,
  treeId: TreeId,
  nodeId: NodeId
): Promise<NodeId> {
  const workingCopyNodeHolderParentId = createWorkingCopyNodeHolderParentId(treeId);

  // Get the source node
  const sourceNode = await coreDB.getNode(nodeId);

  if (!sourceNode) {
    const existingWc = await getWorkingCopy(coreDB, nodeId);
    if (existingWc) {
      return nodeId;
    }
    throw new Error('Node not found');
  }

  const now = Date.now() as Timestamp;
  // get-or-create: reuse existing WC if present for this original node
  const existingHolder = await coreDB.nodes
    .where('[holderType+holderTargetId]')
    .equals(['workingCopy', sourceNode.id])
    .first();
  if (existingHolder) {
    await coreDB.nodes.update(existingHolder.id, { lastTouchedAt: now });
    const existingChild = await coreDB.nodes.where('parentId').equals(existingHolder.id).first();
    if (existingChild?.id) {
      await coreDB.nodes.update(existingChild.id as NodeId, { lastTouchedAt: now });
    }
    return nodeId; // WC already exists; return original id (behavior preserved)
  }

  const workingCopyNodeHolderId = generateNodeId();
  const workingCopyNodeId = generateNodeId();

  const workingCopyNodeHolder: TreeNode = {
    parentId: workingCopyNodeHolderParentId, // New node gets a new ID
    id: workingCopyNodeHolderId,
    // For editing WC, targetNodeId is the original nodeId
    name: encodeWorkingCopyHolderName(sourceNode.parentId, sourceNode.id),
    nodeType: sourceNode.nodeType,
    depth: 0, // Will be calculated by database operations
    createdAt: now,
    updatedAt: now,
    version: 1,
    holderType: 'workingCopy',
    holderTargetId: sourceNode.id,
    holderMetaParentId: sourceNode.parentId,
    lastTouchedAt: now,
  };

  const workingCopyNode: TreeNode = {
    ...sourceNode,
    parentId: workingCopyNodeHolderId,
    id: workingCopyNodeId,
    lastTouchedAt: now,
  };

  coreDB.nodes.bulkPut([workingCopyNodeHolder, workingCopyNode]);

  try {
    const { EntityLifecycleManager } = await import('../entity/EntityLifecycleManager.js');
    const lifecycle = EntityLifecycleManager.getSingleton(coreDB);
    await lifecycle.handleCommand({
      commandId: generateUUID(),
      groupId: generateUUID(),
      kind: 'createWorkingCopy',
      payload: { originalId: nodeId, workingCopyId: workingCopyNode.id },
      issuedAt: Date.now(),
      type: 'createWorkingCopy',
    });
  } catch {}

  return nodeId;
}

// V2 commit result types (non-breaking: new API)
export type CommitOk = { status: 'ok'; nodeId: NodeId; autoRenameTo?: string };
export type CommitConflict = {
  status: 'COMMIT_CONFLICT';
  originalVersion: number;
  wcVersion: number;
};
export type NameConflict = { status: 'NAME_CONFLICT'; suggestedName: string };
export type CommitResultV2 = CommitOk | CommitConflict | NameConflict;

/**
 * Commit working copy (V2)
 * - Editing WC: merge to original (optimistic lock). On name conflict NAME_CONFLICT (or auto-rename).
 * - Draft WC: create new node under targetParentId with targetNodeId. Handle name conflicts similarly.
 */
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

  // Support both metadata fields (editing WC) and encoded holder name (draft WC)
  const holderMetaParentId = (holder as { holderMetaParentId?: NodeId }).holderMetaParentId;
  const holderTargetId = (holder as { holderTargetId?: NodeId }).holderTargetId;
  let targetParentNodeId = holderMetaParentId;
  let targetNodeId = holderTargetId;
  if (!targetParentNodeId || !targetNodeId) {
    try {
      const { decodeWorkingCopyHolderName } = await import('./utils/holder-encoding.js');
      const parsed = decodeWorkingCopyHolderName(holder.name);
      targetParentNodeId = targetParentNodeId ?? parsed.targetParentNodeId;
      targetNodeId = targetNodeId ?? parsed.targetNodeId;
    } catch {
      // ignore parse error; will fail below
    }
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
    // Draft path: create new node with id=targetNodeId
    if (nameConflicts) {
      if (onNameConflict === 'error') {
        return { status: 'NAME_CONFLICT', suggestedName: createNewName(siblingNames, finalName) };
      }
      finalName = createNewName(siblingNames, finalName);
    }

    const computedDepth = (typeof parentNode.depth === 'number' ? parentNode.depth : 0) + 1;

    const newNode: TreeNode = {
      ...wcNode,
      id: targetNodeId,
      parentId: targetParentNodeId,
      name: finalName,
      updatedAt: now,
      version: (wcNode.version || 1) + 1,
      depth: computedDepth,
    };
    await coreDB.createNode(newNode);

    // Cleanup WC (holder + child)
    await discardWorkingCopy(coreDB, [holder.id, wcNode.id]);
    const ok: CommitOk = { status: 'ok', nodeId: targetNodeId };
    if (nameConflicts && onNameConflict === 'auto-rename') ok.autoRenameTo = finalName;
    return ok;
  }

  // Editing path: optimistic lock
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

  await coreDB.updateNode({
    ...wcNode,
    id: targetNodeId,
    parentId: targetParentNodeId,
    name: finalName,
    updatedAt: now,
    version: (wcNode.version || 1) + 1,
  });

  await discardWorkingCopy(coreDB, [holder.id, wcNode.id]);
  const ok: CommitOk = { status: 'ok', nodeId: targetNodeId };
  if (nameConflicts && onNameConflict === 'auto-rename') ok.autoRenameTo = finalName;
  return ok;
}

/**
 * Commit working copy changes
 * Merges working copy TreeNode back to original or creates new node
 */
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

    // Check for name conflict
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

    // Check for version conflict (optimistic locking)
    const originalVersion = workingCopyNode.version || 1;
    if (originalNode.version > originalVersion) {
      return {
        success: false,
        error: 'Node was modified by another user',
        code: WorkerErrorCode.COMMIT_CONFLICT,
      };
    }

    await coreDB.updateNode({
      ...workingCopyNode,
      id: nodeId,
      parentId,
      isDraft,
      updatedAt: now,
      version: workingCopyNode.version + 1,
    });

    // Delete working copy
    await discardWorkingCopy(coreDB, [workingCopyNodeHolder.id, workingCopyNodeId]);

    return {
      success: true,
      seq: 1 as Seq,
      nodeId,
    };

    // Update node
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: WorkerErrorCode.UNKNOWN_ERROR,
    };
  }
}

/**
 * Discard a working copy
 * Removes the pair of treeNodes; workging copy holder node and working copy node
 */
export async function discardWorkingCopy(
  coreDB: CoreDB,
  workingCopyNodeIdPair: NodeId[]
): Promise<void> {
  await coreDB.nodes.bulkDelete(workingCopyNodeIdPair);
  // workingCopyNodeIdPair = [holderId, wcId]; inform lifecycle to drop wc peer
  try {
    const wcId = workingCopyNodeIdPair?.[1];
    if (wcId) {
      const { EntityLifecycleManager } = await import('../entity/EntityLifecycleManager.js');
      const lifecycle = EntityLifecycleManager.getSingleton(coreDB);
      const envelope: CommandEnvelope<'discardWorkingCopy', { workingCopyId: NodeId }> = {
        commandId: generateUUID(),
        groupId: generateUUID(),
        kind: 'discardWorkingCopy',
        payload: { workingCopyId: wcId },
        issuedAt: Date.now() as Timestamp,
        type: 'discardWorkingCopy',
      };
      await lifecycle.handleCommand(envelope);
    }
  } catch {}
}

/**
 * Get a working copy by original node ID
 */
export async function getWorkingCopy(
  coreDB: CoreDB,
  nodeId: NodeId
): Promise<NodeBase | undefined> {
  // First, treat the provided id as a direct working copy node id.
  const direct = await coreDB.nodes.get(nodeId);
  if (direct) {
    // If the record itself is a holder, resolve its child working copy.
    if (direct.holderType === 'workingCopy') {
      const child = await coreDB.nodes.where('parentId').equals(direct.id).first();
      if (child) {
        return child;
      }
    }

    // If the record is a child of a working copy holder, return it directly.
    if (direct.parentId) {
      const parent = await coreDB.nodes.get(direct.parentId);
      if (parent?.holderType === 'workingCopy') {
        return direct;
      }
    }
  }

  // Fallback: treat the id as a canonical node id and locate its working copy holder.
  const holder = await coreDB.nodes
    .where('[holderType+holderTargetId]')
    .equals(['workingCopy', nodeId])
    .first();
  if (!holder) return undefined;
  const child = await coreDB.nodes.where('parentId').equals(holder.id).first();
  return child ?? undefined;
}

/**
 * Update working copy properties
 */
export async function updateWorkingCopy(
  coreDB: CoreDB,
  nodeId: NodeId,
  updates: Partial<NodeBase>
): Promise<void> {
  const existing = await getWorkingCopy(coreDB, nodeId);
  if (!existing) {
    throw new Error('Working copy not found');
  }

  const timestamp = Date.now() as Timestamp;
  const updated: TreeNode = {
    ...existing,
    ...updates,
    updatedAt: timestamp,
    lastTouchedAt: timestamp,
  };

  await coreDB.nodes.put(updated);
  if (updated.parentId) {
    await coreDB.nodes.update(updated.parentId, { lastTouchedAt: timestamp });
  }
}

/**
 * Check if a working copy has conflicts with the current node version
 */
export async function checkWorkingCopyConflict(coreDB: CoreDB, nodeId: NodeId): Promise<boolean> {
  const workingCopy = await getWorkingCopy(coreDB, nodeId);
  if (!workingCopy) {
    return false;
  }

  const currentNode = await coreDB.getNode(nodeId);

  if (!currentNode) {
    return false;
  }

  const originalVersion = workingCopy.version || 1;
  return currentNode.version > originalVersion;
}

/**
 * Get names of all children of a parent node
 * Utility function from eria-cartograph
 */
export async function getChildNames(coreDB: CoreDB, parentId: NodeId): Promise<string[]> {
  const children = await coreDB.listChildren(parentId);
  return children.map((child: TreeNode) => child.name);
}

/**
 * Create a unique name by adding (n) suffix if needed
 * Based on user requirements and eria-cartograph pattern
 */
export function createNewName(siblingNames: string[], baseName: string): string {
  if (!siblingNames.includes(baseName)) {
    return baseName;
  }

  // Extract existing numbers for this base name
  const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedBase}\\s*\\((\\d+)\\)$`);

  const existingNumbers = siblingNames
    .map((name) => {
      const match = pattern.exec(name);
      return match?.[1] ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);

  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 2;

  return `${baseName} (${nextNumber})`;
}

export async function touchWorkingCopyNodes(
  coreDB: CoreDB,
  holderId: NodeId,
  wcNodeId: NodeId,
  timestamp: Timestamp = Date.now() as Timestamp
): Promise<void> {
  await Promise.all([
    coreDB.nodes.update(holderId, { lastTouchedAt: timestamp }),
    coreDB.nodes.update(wcNodeId, { lastTouchedAt: timestamp }),
  ]);
}

export async function touchWorkingCopyByRecord(
  coreDB: CoreDB,
  wcNode: TreeNode,
  timestamp: Timestamp = Date.now() as Timestamp
): Promise<void> {
  const holderId = wcNode.parentId as NodeId | undefined;
  if (!holderId) return;
  await touchWorkingCopyNodes(coreDB, holderId, wcNode.id as NodeId, timestamp);
}

export async function touchWorkingCopyById(
  coreDB: CoreDB,
  wcNodeId: NodeId,
  timestamp: Timestamp = Date.now() as Timestamp
): Promise<void> {
  const node = await coreDB.nodes.get(wcNodeId);
  if (!node) return;
  await touchWorkingCopyByRecord(coreDB, node as TreeNode, timestamp);
}
