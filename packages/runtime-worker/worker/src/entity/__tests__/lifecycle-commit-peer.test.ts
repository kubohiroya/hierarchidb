import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/common-type';
import { EntityLifecycleManager } from '../EntityLifecycleManager.js';
import { storeRegistry } from '../store-registry.js';
import type { PeerStore } from '../store.js';

function makeCoreStub() {
  const nodeMap = new Map<string, any>();
  return {
    nodes: {
      async get(id: NodeId) {
        return nodeMap.get(id as unknown as string);
      },
      _put(obj: any) {
        nodeMap.set(obj.id as unknown as string, obj);
      },
    },
  } as any;
}

describe('EntityLifecycleManager.onCommitWorkingCopy (Peer)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('upserts peer from WC to target and deletes WC peer', async () => {
    const core = makeCoreStub();
    const wcId = 'wc1' as NodeId;
    const holderId = 'h1' as NodeId;
    const targetId = 't1' as NodeId;

    // Register a peer store for 'folder'
    const storeMap = new Map<string, any>();
    const store: PeerStore<any> = {
      async get(id: NodeId) {
        return storeMap.get(id as unknown as string);
      },
      async put(e: any) {
        storeMap.set(e.nodeId as unknown as string, e);
      },
      async delete(id: NodeId) {
        storeMap.delete(id as unknown as string);
      },
    };
    storeRegistry.registerPeer('folder', store);

    // Seed nodes (wc child and its holder)
    core.nodes._put({ id: wcId, parentId: holderId, name: 'Draft', nodeType: 'folder' });
    core.nodes._put({ id: holderId, name: 'h', holderTargetId: targetId, holderMetaParentId: 'p1' as NodeId });

    // Seed peer entity for WC
    await store.put({ nodeId: wcId, data: { x: 42 } });

    const mgr = (EntityLifecycleManager as any).getSingleton(core) as EntityLifecycleManager;
    await mgr.onCommitWorkingCopy({
      commandId: 'c1',
      groupId: 'g1',
      kind: 'commitWorkingCopy',
      payload: { workingCopyId: wcId },
      issuedAt: Date.now(),
      type: 'commitWorkingCopy',
    } as any);

    // Target received upserted peer
    const targetPeer = await store.get(targetId);
    expect(targetPeer?.data?.x).toBe(42);
    // WC peer deleted
    const wcPeer = await store.get(wcId);
    expect(wcPeer).toBeUndefined();
  });
});
