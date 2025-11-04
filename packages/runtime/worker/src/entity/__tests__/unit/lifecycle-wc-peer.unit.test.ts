import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreDB } from '../../../services/CoreDB.js';
import { EntityLifecycleManager } from '../../EntityLifecycleManager.js';
import type { PeerEntity, PeerStore } from '../../store.js';
import { storeRegistry } from '../../store-registry.js';

describe('EntityLifecycleManager working copy peer (create/discard)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('copies peer on createWorkingCopy and deletes on discardWorkingCopy', async () => {
    const nodeMap = new Map<NodeId, TreeNode>();
    const core: Pick<CoreDB, 'getNode'> = {
      getNode: vi.fn(async (id: NodeId) => nodeMap.get(id)),
    };

    const peer = new Map<NodeId, PeerEntity<{ k: number }>>();
    const store: PeerStore<{ k: number }> = {
      async get(id: NodeId) {
        return peer.get(id);
      },
      async put(entity) {
        peer.set(entity.nodeId, { ...entity });
      },
      async delete(id: NodeId) {
        peer.delete(id);
      },
    };
    const folderType = 'folder' as NodeType;
    storeRegistry.registerPeer(folderType, store);

    const originalId = 'orig' as NodeId;
    const wcId = 'wcX' as NodeId;
    const holderId = 'holder' as NodeId;
    nodeMap.set(originalId, {
      id: originalId,
      parentId: 'p' as NodeId,
      nodeType: folderType,
      name: 'Original',
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
    });
    await store.put({ nodeId: originalId, data: { k: 1 } });

    const mgr = EntityLifecycleManager.getSingleton(core as unknown as CoreDB);

    await mgr.onCreateWorkingCopy({
      commandId: 'c1',
      groupId: 'g1',
      kind: 'createWorkingCopy',
      payload: { originalId, workingCopyId: wcId },
      issuedAt: Date.now(),
      type: 'createWorkingCopy',
    });

    expect((await store.get(wcId))?.data?.k).toBe(1);

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

    await mgr.onDiscardWorkingCopy({
      commandId: 'c2',
      groupId: 'g1',
      kind: 'discardWorkingCopy',
      payload: { workingCopyId: wcId },
      issuedAt: Date.now(),
      type: 'discardWorkingCopy',
    });

    expect(await store.get(wcId)).toBeUndefined();
  });
});
