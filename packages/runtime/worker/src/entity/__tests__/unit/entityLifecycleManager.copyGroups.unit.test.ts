import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreDB } from '../../../services/CoreDB.js';
import { EntityLifecycleManager } from '../../EntityLifecycleManager.js';
import type { GroupItemBase, GroupStore } from '../../store.js';
import { storeRegistry } from '../../store-registry.js';

describe('EntityLifecycleManager.copyGroupsByMapping', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('bulkUpserts items for each nodeType present in mapping', async () => {
    const nodeMap = new Map<NodeId, TreeNode>();
    const withPayload = (node: Omit<TreeNode, 'data' | 'draftData'> & Partial<TreeNode>): TreeNode => ({
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
    const folderSrc = 'folder-src' as NodeId;
    const folderDst = 'folder-dst' as NodeId;
    const routeSrc = 'route-src' as NodeId;
    const routeDst = 'route-dst' as NodeId;
    const folderType = 'folder' as NodeType;
    const routeType = 'route' as NodeType;
    addNode(folderSrc, folderType);
    addNode(routeSrc, routeType);

    const upserts: Array<{ nodeId: NodeId; items: GroupItemBase[] }> = [];
    const makeStore = (items: GroupItemBase[]): GroupStore<GroupItemBase> => ({
      async list(nodeId) {
        return nodeId === folderSrc || nodeId === routeSrc ? items : [];
      },
      async bulkUpsert(nodeId, data) {
        upserts.push({ nodeId, items: data });
      },
      async bulkDelete() {},
    });

    storeRegistry.registerGroup('folder', makeStore([{ id: 'f1' }]));
    storeRegistry.registerGroup('route', makeStore([{ id: 'r1' }]));

    const core: Pick<CoreDB, 'getNode'> = {
      getNode: vi.fn(async (id: NodeId) => nodeMap.get(id)),
    };

    const mgr = EntityLifecycleManager.getSingleton(core as unknown as CoreDB);
    const mapping: ReadonlyArray<readonly [NodeId, NodeId]> = [
      [folderSrc, folderDst] as const,
      [routeSrc, routeDst] as const,
    ];
    EntityLifecycleManager.setIdMapping('cmd-group', mapping);

    await mgr.onDuplicateNodes({
      commandId: 'cmd-group',
      groupId: 'g',
      kind: 'duplicateNodes',
      payload: { nodeIds: [], toParentId: 'parent' as NodeId },
      issuedAt: Date.now(),
      type: 'duplicateNodes',
    });

    expect(core.getNode).toHaveBeenCalledTimes(2);
    expect(upserts).toHaveLength(2);
    expect(upserts.map((e) => e.nodeId)).toEqual(expect.arrayContaining([folderDst, routeDst]));
  });
});
