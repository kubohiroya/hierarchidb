import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';
import type { CoreDB } from '../../services/CoreDB.js';
import { EntityLifecycleManager } from '../EntityLifecycleManager.js';
import { storeRegistry } from '../store-registry.js';
import type { PeerEntity, PeerStore } from '../store.js';

describe('EntityLifecycleManager.onCommitWorkingCopy (Peer)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('upserts peer from WC to target and deletes WC peer', async () => {
    const nodeMap = new Map<NodeId, TreeNode>();
    const core: Pick<CoreDB, 'getNode'> = {
      getNode: vi.fn(async (id: NodeId) => nodeMap.get(id)),
    };
    const wcId = 'wc1' as NodeId;
    const holderId = 'h1' as NodeId;
    const targetId = 't1' as NodeId;

    // Register a peer store for 'folder'
    const storeMap = new Map<NodeId, PeerEntity<{ x: number }>>();
    const store: PeerStore<{ x: number }> = {
      async get(id: NodeId) {
        return storeMap.get(id);
      },
      async put(entity) {
        storeMap.set(entity.nodeId, { ...entity });
      },
      async delete(id: NodeId) {
        storeMap.delete(id);
      },
    };
    const folderType = 'folder' as NodeType;
    storeRegistry.registerPeer(folderType, store);

    // Seed nodes (wc child and its holder)
    nodeMap.set(wcId, {
      id: wcId,
      parentId: holderId,
      nodeType: folderType,
      name: 'Draft',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });
    nodeMap.set(holderId, {
      id: holderId,
      parentId: holderId,
      nodeType: folderType,
      name: 'holder',
      depth: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      holderTargetId: targetId,
      holderMetaParentId: 'p1' as NodeId,
    });
    nodeMap.set(targetId, {
      id: targetId,
      parentId: 'p1' as NodeId,
      nodeType: folderType,
      name: 'Canonical',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });

    // Seed peer entity for WC
    await store.put({ nodeId: wcId, data: { x: 42 } });

    const mgr = EntityLifecycleManager.getSingleton(core as unknown as CoreDB);
    await mgr.onCommitWorkingCopy({
      commandId: 'c1',
      groupId: 'g1',
      kind: 'commitWorkingCopy',
      payload: { workingCopyId: wcId },
      issuedAt: Date.now(),
      type: 'commitWorkingCopy',
    });

    // Target received upserted peer
    const targetPeer = await store.get(targetId);
    expect(targetPeer?.data?.x).toBe(42);
    // WC peer deleted
    const wcPeer = await store.get(wcId);
    expect(wcPeer).toBeUndefined();
  });
});
