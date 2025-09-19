import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/common-type';
import { EntityLifecycleManager } from '../EntityLifecycleManager.js';
import { storeRegistry } from '../store-registry.js';
import type { GroupItemBase, GroupStore } from '../store.js';

describe('EntityLifecycleManager.copyGroupsByMapping', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('bulkUpserts items for each nodeType present in mapping', async () => {
    const nodeMap = new Map<string, { id: NodeId; nodeType: string }>();
    const addNode = (id: NodeId, nodeType: string) => nodeMap.set(id as unknown as string, { id, nodeType });
    const folderSrc = 'folder-src' as NodeId;
    const folderDst = 'folder-dst' as NodeId;
    const routeSrc = 'route-src' as NodeId;
    const routeDst = 'route-dst' as NodeId;
    addNode(folderSrc, 'folder');
    addNode(routeSrc, 'route');

    const upserts: Array<{ nodeId: NodeId; items: GroupItemBase[] }> = [];
    const makeStore = (items: GroupItemBase[]): GroupStore<GroupItemBase> => ({
      async list(nodeId) {
        return nodeId === folderSrc || nodeId === routeSrc ? items : [];
      },
      async bulkUpsert(nodeId, data) {
        upserts.push({ nodeId, items: data });
      },
      async bulkDelete() {},
    });

    storeRegistry.registerGroup('folder', makeStore([{ id: 'f1' }] as any));
    storeRegistry.registerGroup('route', makeStore([{ id: 'r1' }] as any));

    const core = {
      getNode: vi.fn(async (id: NodeId) => nodeMap.get(id as unknown as string)),
    } as any;

    const mgr = (EntityLifecycleManager as any).getSingleton(core) as EntityLifecycleManager;
    (EntityLifecycleManager as any).setIdMapping('cmd-group', [
      [folderSrc, folderDst],
      [routeSrc, routeDst],
    ]);

    await mgr.onDuplicateNodes({
      commandId: 'cmd-group',
      groupId: 'g',
      kind: 'duplicateNodes',
      payload: { nodeIds: [] },
      issuedAt: Date.now(),
      type: 'duplicateNodes',
    });

    expect(core.getNode).toHaveBeenCalledTimes(2);
    expect(upserts).toHaveLength(2);
    expect(upserts.map((e) => e.nodeId)).toEqual(expect.arrayContaining([folderDst, routeDst]));
  });
});
