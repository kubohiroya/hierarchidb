import { type NodeId, type TreeId, type TreeNode, type Timestamp } from '@hierarchidb/common-types';
import { generateUUID } from '@hierarchidb/util';
import type { CoreDB } from '../CoreDB.js';
import { getDraft } from './lookupOperations.js';

/**
 * Create a working copy from an existing node for editing.
 * Working copy uses the same treeNodeId as the original.
 */
export async function createWorkingCopyFromNode(
  coreDB: CoreDB,
  treeId: TreeId,
  nodeId: NodeId
): Promise<NodeId> {
  const sourceNode = await coreDB.getNode(nodeId);
  if (!sourceNode) {
    const existingWc = await getDraft(coreDB, nodeId);
    if (existingWc) {
      return nodeId;
    }
    throw new Error('Node not found');
  }

  const now = Date.now() as Timestamp;
  // Reuse existing draft on the same node if present
  if (sourceNode.draftData !== null && sourceNode.draftData !== undefined) {
    await coreDB.nodes.update(sourceNode.id as NodeId, { lastTouchedAt: now, updatedAt: now });
    return nodeId;
  }

  await coreDB.nodes.put({
    ...sourceNode,
    // use same node id; draftData is the editable buffer
    data: sourceNode.data ?? null,
    draftData: sourceNode.data ?? null,
    dialogUIState: undefined,
    lastTouchedAt: now,
    updatedAt: now,
  });

  try {
    const { EntityLifecycleManager } = await import('../../entity/EntityLifecycleManager.js');
    const lifecycle = EntityLifecycleManager.getSingleton(coreDB);
    await lifecycle.handleCommand({
      commandId: generateUUID(),
      groupId: generateUUID(),
      kind: 'createWorkingCopy',
      payload: { originalId: nodeId, workingCopyId: nodeId },
      issuedAt: Date.now(),
      type: 'createWorkingCopy',
    });
  } catch {}

  return nodeId;
}
