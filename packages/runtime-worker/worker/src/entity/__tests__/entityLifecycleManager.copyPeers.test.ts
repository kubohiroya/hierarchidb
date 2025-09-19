import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/common-type';
import { EntityLifecycleManager } from '../EntityLifecycleManager.js';
import { storeRegistry } from '../store-registry.js';
import type { PeerEntity, PeerStore } from '../store.js';

describe('EntityLifecycleManager.copyPeersByMapping', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('groups pairs by nodeType and calls bulkUpsertFromIds', async () => {
    const nodeMap = new Map<string, { id: NodeId; nodeType: string }>();
    const toNode = (id: NodeId, nodeType: string) => {
      nodeMap.set(id as unknown as string, { id, nodeType });
    };
    const folderSrc = 'f-src' as NodeId;
    const folderDst = 'f-dst' as NodeId;
    const routeSrc = 'r-src' as NodeId;
    const routeDst = 'r-dst' as NodeId;
    toNode(folderSrc, 'folder');
    toNode(routeSrc, 'route');

    const bulkCalls: Array<Array<{ targetId: NodeId; fromId: NodeId }>> = [];
    const makeStore = (entities: Record<string, PeerEntity>) : PeerStore => ({
      async get(nodeId) {
        return entities[nodeId as unknown as string];
      },
      async put() {},
      async delete() {},
      async bulkUpsert(items) {
        bulkCalls.push(items as any);
      },
    });

    storeRegistry.registerPeer('folder', makeStore({ [folderSrc]: { nodeId: folderSrc } }));
    storeRegistry.registerPeer('route', makeStore({ [routeSrc]: { nodeId: routeSrc } }));

    const core = {
      getNode: vi.fn(async (id: NodeId) => nodeMap.get(id as unknown as string)),
    } as any;

    const mgr = (EntityLifecycleManager as any).getSingleton(core) as EntityLifecycleManager;
    (EntityLifecycleManager as any).setIdMapping('cmd-peers', [
      [folderSrc, folderDst],
      [routeSrc, routeDst],
    ]);

    await mgr.onDuplicateNodes({
      commandId: 'cmd-peers',
      groupId: 'g',
      kind: 'duplicateNodes',
      payload: { nodeIds: [] },
      issuedAt: Date.now(),
      type: 'duplicateNodes',
    });

    expect(core.getNode).toHaveBeenCalledTimes(2);
    expect(bulkCalls.length).toBe(2);
    const allIds = bulkCalls.flat().map((entry) => entry.targetId);
    expect(allIds).toContain(folderDst);
    expect(allIds).toContain(routeDst);
  });
});
