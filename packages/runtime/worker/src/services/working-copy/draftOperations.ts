import {
  generateNodeId,
  type NodeId,
  type NodeType,
  type TreeId,
  type TreeNode,
  type Timestamp,
} from '@hierarchidb/common-types';
import type { CoreDB } from '../CoreDB.js';
import { encodeWorkingCopyHolderName } from '../utils/holder-encoding.js';

export function createWorkingCopyNodeHolderParentId(treeId: TreeId) {
  return `${treeId}:workingCopy` as NodeId;
}

export function createWorkingCopyNodeHolderName(parentId: NodeId, nodeId: NodeId) {
  return [parentId, nodeId].join('\t') as NodeId;
}

export async function createNewDraftWorkingCopy(
  coreDB: CoreDB,
  treeId: TreeId,
  parentId: NodeId,
  nodeType: NodeType,
  baseName: string
): Promise<NodeId> {
  const workingCopyNodeHolderParentId = createWorkingCopyNodeHolderParentId(treeId);
  const workingCopyNodeHolderId = generateNodeId();
  const workingCopyNodeId = generateNodeId();
  const targetNodeId = generateNodeId();
  const holderName = encodeWorkingCopyHolderName(parentId, targetNodeId);
  const now = Date.now() as Timestamp;

  try {
    const existing = await coreDB.nodes
      .where('[parentId+name]')
      .equals([workingCopyNodeHolderParentId, holderName])
      .first();
    if (existing) {
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
    const isConstraintError =
      typeof err === 'object' &&
      err !== null &&
      ((
        'name' in err &&
        typeof (err as { name?: unknown }).name === 'string' &&
        (err as { name: string }).name === 'ConstraintError'
      ) || /Constraint/i.test(String((err as { message?: unknown }).message)));
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
    const patchedExisting: TreeNode = { ...existing };
    if (
      !patchedExisting.holderType ||
      !patchedExisting.holderTargetId ||
      !patchedExisting.holderMetaParentId
    ) {
      try {
        const { decodeWorkingCopyHolderName } = await import('../utils/holder-encoding.js');
        const parsed = decodeWorkingCopyHolderName(existing.name);
        patchedExisting.holderType = 'workingCopy';
        patchedExisting.holderTargetId = parsed.targetNodeId;
        patchedExisting.holderMetaParentId = parsed.targetParentNodeId;
        await coreDB.nodes.put(patchedExisting);
      } catch {
        // ignore
      }
    }

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
      const arr = await coreDB.nodes.where('parentId').equals(existing.id).toArray();
      child = Array.isArray(arr) ? arr[0] : undefined;
    }
    if (child?.id) {
      await touchWorkingCopyNodes(
        coreDB,
        existing.id as NodeId,
        child.id as NodeId,
        Date.now() as Timestamp
      );
    }
    return {
      wcHolderId: existing.id as NodeId,
      wcNodeId: (child?.id as NodeId) || ('' as NodeId),
      returnedExisting: true,
    };
  }

  const wcHolderId = await createNewDraftWorkingCopy(coreDB, treeId, parentId, nodeType, baseName);
  const children = await coreDB.nodes.where('parentId').equals(wcHolderId).toArray();
  const child = Array.isArray(children) ? children[0] : undefined;
  if (child?.id) {
    await touchWorkingCopyNodes(coreDB, wcHolderId, child.id as NodeId, Date.now() as Timestamp);
  }
  return { wcHolderId, wcNodeId: (child?.id as NodeId) || ('' as NodeId), returnedExisting: false };
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
