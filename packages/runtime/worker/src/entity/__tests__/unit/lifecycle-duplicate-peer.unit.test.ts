import type { NodeId, Timestamp, TreeNode } from '@hierarchidb/common-types';
import { toNodeType } from '@hierarchidb/common-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreDB } from '../../../services/CoreDB.js';
import { EntityLifecycleManager } from '../../EntityLifecycleManager.js';
import type { PeerEntity, PeerStore } from '../../store.js';
import { storeRegistry } from '../../store-registry.js';

describe('EntityLifecycleManager.onDuplicateNodes (Peer via idMap)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('copies peer entities for mapped nodes', async () => {
    const nodeMap = new Map<NodeId, TreeNode>();
    const core: Pick<CoreDB, 'getNode'> = {
      getNode: vi.fn(async (id: NodeId) => nodeMap.get(id)),
    };

    const peerMap = new Map<NodeId, PeerEntity<{ v: number }>>();
    const store: PeerStore<{ v: number }> = {
      async get(id: NodeId) {
        return peerMap.get(id);
      },
      async put(entity) {
        peerMap.set(entity.nodeId, { ...entity });
      },
      async delete(id: NodeId) {
        peerMap.delete(id);
      },
    };
    const folderType = toNodeType('folder');
    storeRegistry.registerPeer(folderType, store);

    const s1 = 's1' as NodeId;
    const d1 = 'd1' as NodeId;
    const s2 = 's2' as NodeId;
    const d2 = 'd2' as NodeId;

    const makeNode = (id: NodeId): TreeNode => ({
      id,
      parentId: 'p' as NodeId,
      nodeType: folderType,
      name: String(id),
      data: {},
      draftData: null,
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });

    nodeMap.set(s1, makeNode(s1));
    nodeMap.set(s2, makeNode(s2));
    await store.put({ nodeId: s1, data: { v: 1 } });
    await store.put({ nodeId: s2, data: { v: 2 } });

    const mgr = EntityLifecycleManager.getSingleton(core as unknown as CoreDB);
    EntityLifecycleManager.setIdMapping('cmd-dup', [
      [s1, d1],
      [s2, d2],
    ]);

    await mgr.onDuplicateNodes({
      commandId: 'cmd-dup',
      groupId: 'g1',
      kind: 'duplicateNodes',
      payload: { nodeIds: [], toParentId: 'p' as NodeId },
      issuedAt: Date.now() as Timestamp,
    });

    expect((await store.get(d1))?.data?.v).toBe(1);
    expect((await store.get(d2))?.data?.v).toBe(2);
  });
});
