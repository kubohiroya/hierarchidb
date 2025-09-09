import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/common-type';
import { EntityLifecycleManager } from '../EntityLifecycleManager';
import { storeRegistry } from '../store-registry';
import type { PeerStore } from '../store';

describe('EntityLifecycleManager.onImportNodes (Peer via idMap)', () => {
  beforeEach(() => {
    vi.resetModules();
    (process as any).env.WORKER_ENTITY_UNIFIED = '1';
  });

  it('copies peer entities for idMap on import', async () => {
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

    const peerMap = new Map<string, any>();
    const store: PeerStore<any> = {
      async get(id: NodeId) {
        return peerMap.get(id as unknown as string);
      },
      async put(e: any) {
        peerMap.set(e.nodeId as unknown as string, e);
      },
      async delete(id: NodeId) {
        peerMap.delete(id as unknown as string);
      },
    };
    storeRegistry.registerPeer('folder', store);

    const s1 = 'imp-src' as NodeId;
    const d1 = 'imp-dst' as NodeId;
    core.nodes._put({ id: s1, parentId: 'p', nodeType: 'folder' });
    await store.put({ nodeId: s1, data: { x: 99 } });

    const mgr = (EntityLifecycleManager as any).getSingleton(core) as EntityLifecycleManager;
    const map = new Map<string, string>([[s1 as any, d1 as any]]);
    (EntityLifecycleManager as any).setIdMapping('cmd-import', map);

    await mgr.onImportNodes({
      commandId: 'cmd-import', groupId: 'g1', kind: 'importNodes',
      payload: { idMap: Object.fromEntries(map), nodes: { [s1]: { nodeType: 'folder' } }, nodeIds: [s1] },
      issuedAt: Date.now(), type: 'importNodes',
    } as any);

    expect((await store.get(d1))?.data?.x).toBe(99);
  });
});
