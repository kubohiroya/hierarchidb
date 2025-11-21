import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreDB } from '../../../services/CoreDB.js';
import { EntityLifecycleManager } from '../../EntityLifecycleManager.js';
import type { RelationBase, RelationStore } from '../../store.js';
import { storeRegistry } from '../../store-registry.js';

describe('EntityLifecycleManager.copyRelationsByMapping', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('copies relations only when both ends are inside the mapping', async () => {
    const nodeMap = new Map<NodeId, TreeNode>();
    const withPayload = (node: Omit<TreeNode, 'data' | 'draftData'> & Partial<TreeNode>): TreeNode =>
      ({
        data: {},
        draftData: null,
        ...node,
      });
    const makeNode = (id: NodeId, nodeType: NodeType): TreeNode =>
      withPayload({
        id,
        parentId: 'root' as NodeId,
        nodeType,
        name: String(id),
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      });
    const addNode = (id: NodeId, nodeType: NodeType) => nodeMap.set(id, makeNode(id, nodeType));
    const a1 = 'a1' as NodeId;
    const b1 = 'b1' as NodeId;
    const a2 = 'a2' as NodeId;
    const b2 = 'b2' as NodeId;
    const external = 'ext' as NodeId;
    const folderType = 'folder' as NodeType;
    addNode(a1, folderType);
    addNode(a2, folderType);
    addNode(external, folderType);

    const emitted: RelationBase[] = [];
    const store: RelationStore = {
      async listByNode(nodeId) {
        if (nodeId === a1) {
          return [
            { srcNodeId: a1, dstNodeId: a2, type: 'LINK' },
            { srcNodeId: a1, dstNodeId: external, type: 'LINK' },
          ];
        }
        return [];
      },
      async bulkUpsert(relations) {
        emitted.push(...relations);
      },
      async bulkDelete() {},
    };

    storeRegistry.registerRelations('folder', store);

    const core: Pick<CoreDB, 'getNode'> = {
      getNode: vi.fn(async (id: NodeId) => nodeMap.get(id)),
    };

    const mgr = EntityLifecycleManager.getSingleton(core as unknown as CoreDB);
    const mapping: ReadonlyArray<readonly [NodeId, NodeId]> = [
      [a1, b1] as const,
      [a2, b2] as const,
    ];
    EntityLifecycleManager.setIdMapping('cmd-rel', mapping);

    await mgr.onDuplicateNodes({
      commandId: 'cmd-rel',
      groupId: 'g',
      kind: 'duplicateNodes',
      payload: { nodeIds: [], toParentId: 'parent' as NodeId },
      issuedAt: Date.now(),
      type: 'duplicateNodes',
    });

    expect(core.getNode).toHaveBeenCalledTimes(2);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].srcNodeId).toBe(b1);
    expect(emitted[0].dstNodeId).toBe(b2);
  });
});
