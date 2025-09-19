import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/common-type';
import { EntityLifecycleManager } from '../EntityLifecycleManager.js';
import { storeRegistry } from '../store-registry.js';
import type { PeerStore } from '../store.js';

describe('EntityLifecycleManager.onDuplicateNodes (Peer via idMap)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('copies peer entities for mapped nodes', async () => {
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

    // Register a peer store for 'folder'
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

    // Seed source nodes and peers
    const s1 = 's1' as NodeId;
    const d1 = 'd1' as NodeId;
    const s2 = 's2' as NodeId;
    const d2 = 'd2' as NodeId;
    core.nodes._put({ id: s1, parentId: 'p', nodeType: 'folder' });
    core.nodes._put({ id: s2, parentId: 'p', nodeType: 'folder' });
    await store.put({ nodeId: s1, data: { v: 1 } });
    await store.put({ nodeId: s2, data: { v: 2 } });

    const mgr = (EntityLifecycleManager as any).getSingleton(core) as EntityLifecycleManager;
    // Provide idMap via the static registry
    const map = new Map<string, string>([[s1 as any, d1 as any], [s2 as any, d2 as any]]);
    (EntityLifecycleManager as any).setIdMapping('cmd-dup', map);

    await mgr.onDuplicateNodes({
      commandId: 'cmd-dup',
      groupId: 'g1',
      kind: 'duplicateNodes',
      payload: {},
      issuedAt: Date.now(),
      type: 'duplicateNodes',
    } as any);

    expect((await store.get(d1))?.data?.v).toBe(1);
    expect((await store.get(d2))?.data?.v).toBe(2);
  });
});
