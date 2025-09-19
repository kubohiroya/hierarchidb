import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/common-type';
import { EntityLifecycleManager } from '../EntityLifecycleManager.js';
import { storeRegistry } from '../store-registry.js';
import type { PeerStore } from '../store.js';

describe('EntityLifecycleManager.onPasteNodes (Peer via idMap)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('copies peer entities for idMap on paste', async () => {
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
    const s1 = 'src-a' as NodeId;
    const d1 = 'dst-a' as NodeId;
    core.nodes._put({ id: s1, parentId: 'p', nodeType: 'folder' });
    await store.put({ nodeId: s1, data: { v: 7 } });

    const mgr = (EntityLifecycleManager as any).getSingleton(core) as EntityLifecycleManager;
    // Provide idMap via the static registry
    const map = new Map<string, string>([[s1 as any, d1 as any]]);
    (EntityLifecycleManager as any).setIdMapping('cmd-paste', map);

    await mgr.onPasteNodes({
      commandId: 'cmd-paste', groupId: 'g1', kind: 'pasteNodes',
      payload: { idMap: Object.fromEntries(map), nodes: { [s1]: { nodeType: 'folder' } }, nodeIds: [s1] },
      issuedAt: Date.now(), type: 'pasteNodes',
    } as any);

    expect((await store.get(d1))?.data?.v).toBe(7);
  });
});
