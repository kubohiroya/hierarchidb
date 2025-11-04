import type { NodeId, Timestamp, TreeNode } from '@hierarchidb/common-types';
import { toNodeType } from '@hierarchidb/common-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreDB } from '../../../services/CoreDB.js';
import { EntityLifecycleManager } from '../../EntityLifecycleManager.js';
import type { GroupItemBase, GroupStore, RelationBase, RelationStore } from '../../store.js';
import { storeRegistry } from '../../store-registry.js';

describe('Lifecycle: Group/Relations duplication via idMap', () => {
  const folderType = toNodeType('folder');

  beforeEach(() => {
    vi.resetModules();
  });

  it('copies group items from src to dst node', async () => {
    const nodeMap = new Map<NodeId, TreeNode>();
    const core: Pick<CoreDB, 'getNode'> = {
      getNode: vi.fn(async (id: NodeId) => nodeMap.get(id)),
    };
    const src = 'g-src' as NodeId;
    const dst = 'g-dst' as NodeId;
    nodeMap.set(src, {
      id: src,
      parentId: 'root' as NodeId,
      nodeType: folderType,
      name: 'Source',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });

    // Group store stub
    const groupData = new Map<NodeId, GroupItemBase<{ v: number }>[]>();
    groupData.set(src, [{ id: 'i1', data: { v: 1 } }]);
    const upserts: Array<{ nodeId: NodeId; items: GroupItemBase[] }> = [];
    const gstore: GroupStore<GroupItemBase<{ v: number }>> = {
      async list(nodeId: NodeId) {
        return groupData.get(nodeId) ?? [];
      },
      async bulkUpsert(nodeId: NodeId, items) {
        upserts.push({ nodeId, items });
      },
      async bulkDelete() {
        /* noop */
      },
    };
    storeRegistry.registerGroup(folderType, gstore);

    const mgr = EntityLifecycleManager.getSingleton(core as unknown as CoreDB);
    EntityLifecycleManager.setIdMapping('cmd-g', [[src, dst]]);
    await mgr.onDuplicateNodes({
      commandId: 'cmd-g',
      groupId: 'g',
      kind: 'duplicateNodes',
      payload: { nodeIds: [], toParentId: 'root' as NodeId },
      issuedAt: Date.now() as Timestamp,
    });

    expect(upserts.length).toBe(1);
    expect(upserts[0].nodeId).toBe(dst);
    expect(upserts[0].items[0].id).toBe('i1');
  });

  it('copies only relations with both ends inside idMap', async () => {
    const nodeMap = new Map<NodeId, TreeNode>();
    const core: Pick<CoreDB, 'getNode'> = {
      getNode: vi.fn(async (id: NodeId) => nodeMap.get(id)),
    };
    const s1 = 'r-s1' as NodeId;
    const d1 = 'r-d1' as NodeId;
    const s2 = 'r-s2' as NodeId;
    const d2 = 'r-d2' as NodeId;
    const ext = 'ext' as NodeId;
    const makeNode = (id: NodeId): TreeNode => ({
      id,
      parentId: 'root' as NodeId,
      nodeType: folderType,
      name: String(id),
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });
    [s1, s2, ext].forEach((id) => {
      nodeMap.set(id, makeNode(id));
    });

    // Relations store stub
    const rels: RelationBase[] = [
      { srcNodeId: s1, dstNodeId: s2, type: 'LINK' }, // inside
      { srcNodeId: s1, dstNodeId: ext, type: 'LINK' }, // external -> skip
    ];
    const listByNode = async (nodeId: NodeId) => rels.filter((r) => r.srcNodeId === nodeId);
    const bulk: RelationBase[] = [];
    const rstore: RelationStore = {
      listByNode,
      async bulkUpsert(rs) {
        bulk.push(...rs);
      },
      async bulkDelete() {
        /* noop */
      },
    };
    storeRegistry.registerRelations(folderType, rstore);

    const mgr = EntityLifecycleManager.getSingleton(core as unknown as CoreDB);
    EntityLifecycleManager.setIdMapping('cmd-r', [
      [s1, d1],
      [s2, d2],
    ]);
    await mgr.onDuplicateNodes({
      commandId: 'cmd-r',
      groupId: 'g',
      kind: 'duplicateNodes',
      payload: { nodeIds: [], toParentId: 'root' as NodeId },
      issuedAt: Date.now() as Timestamp,
    });

    expect(bulk.length).toBe(1);
    expect(bulk[0].srcNodeId).toBe(d1);
    expect(bulk[0].dstNodeId).toBe(d2);
  });
});
