import {
  generateNodeId,
  type NodeId,
  type TreeId,
  type TreeNode,
  type Timestamp,
} from '@hierarchidb/common-types';
import { generateUUID } from '@hierarchidb/util';
import type { CoreDB } from '../CoreDB.js';
import { encodeWorkingCopyHolderName } from '../utils/holder-encoding.js';
import { getWorkingCopy } from './lookupOperations.js';

/**
 * Create a working copy from an existing node for editing.
 * Working copy uses the same treeNodeId as the original.
 */
export async function createWorkingCopyFromNode(
  coreDB: CoreDB,
  treeId: TreeId,
  nodeId: NodeId
): Promise<NodeId> {
  const workingCopyNodeHolderParentId = `${treeId}:workingCopy` as NodeId;

  const sourceNode = await coreDB.getNode(nodeId);
  if (!sourceNode) {
    const existingWc = await getWorkingCopy(coreDB, nodeId);
    if (existingWc) {
      return nodeId;
    }
    throw new Error('Node not found');
  }

  const now = Date.now() as Timestamp;
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
    return nodeId;
  }

  const workingCopyNodeHolderId = generateNodeId();
  const workingCopyNodeId = generateNodeId();

  const workingCopyNodeHolder: TreeNode = {
    parentId: workingCopyNodeHolderParentId,
    id: workingCopyNodeHolderId,
    name: encodeWorkingCopyHolderName(sourceNode.parentId, sourceNode.id),
    nodeType: sourceNode.nodeType,
    depth: 0,
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
    const { EntityLifecycleManager } = await import('../../entity/EntityLifecycleManager.js');
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
