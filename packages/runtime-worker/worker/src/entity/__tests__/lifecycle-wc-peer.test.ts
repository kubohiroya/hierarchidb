import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/common-type';
import { EntityLifecycleManager } from '../EntityLifecycleManager';
import { storeRegistry } from '../store-registry';
import type { PeerStore } from '../store';

describe('EntityLifecycleManager working copy peer (create/discard)', () => {
  beforeEach(() => {
    vi.resetModules();
    (process as any).env.WORKER_ENTITY_UNIFIED = '1';
  });

  it('copies peer on createWorkingCopy and deletes on discardWorkingCopy', async () => {
    const nodeMap = new Map<string, any>();
    const core: any = {
      nodes: {
        async get(id: NodeId) {
          return nodeMap.get(id as unknown as string);
        },
        _put(obj: any) {
          nodeMap.set(obj.id as unknown as string, obj);
        },
      },
      getNode: async (id: NodeId) => nodeMap.get(id as unknown as string),
    };

    const peer = new Map<string, any>();
    const store: PeerStore<any> = {
      async get(id: NodeId) {
        return peer.get(id as unknown as string);
      },
      async put(e: any) {
        peer.set(e.nodeId as unknown as string, e);
      },
      async delete(id: NodeId) {
        peer.delete(id as unknown as string);
      },
    };
    storeRegistry.registerPeer('folder', store);

    const originalId = 'orig' as NodeId;
    const wcId = 'wcX' as NodeId;
    core.nodes._put({ id: originalId, parentId: 'p', nodeType: 'folder', name: 'N' });
    await store.put({ nodeId: originalId, data: { k: 1 } });

    const mgr = (EntityLifecycleManager as any).getSingleton(core) as EntityLifecycleManager;

    await mgr.onCreateWorkingCopy({
      commandId: 'c1', groupId: 'g1', kind: 'createWorkingCopy',
      payload: { originalId, workingCopyId: wcId }, issuedAt: Date.now(), type: 'createWorkingCopy',
    } as any);

    expect((await store.get(wcId))?.data?.k).toBe(1);

    await mgr.onDiscardWorkingCopy({
      commandId: 'c2', groupId: 'g1', kind: 'discardWorkingCopy',
      payload: { workingCopyId: wcId }, issuedAt: Date.now(), type: 'discardWorkingCopy',
    } as any);

    expect(await store.get(wcId)).toBeUndefined();
  });
});
