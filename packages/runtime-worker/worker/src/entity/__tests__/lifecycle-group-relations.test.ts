import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NodeId } from '@hierarchidb/common-type';
import { EntityLifecycleManager } from '~/entity/EntityLifecycleManager';
import { storeRegistry } from '~/entity/store-registry';
import type { GroupStore, GroupItemBase, RelationStore, RelationBase } from '~/entity/store';

describe('Lifecycle: Group/Relations duplication via idMap', () => {
  beforeEach(() => {
    vi.resetModules();
    (process as any).env.WORKER_ENTITY_UNIFIED = '1';
  });

  it('copies group items from src to dst node', async () => {
    const nodeMap = new Map<string, any>();
    const core: any = {
      getNode: async (id: NodeId) => nodeMap.get(id as any),
      nodes: { _put: (o: any) => nodeMap.set(o.id as any, o) },
    };
    const src = 'g-src' as NodeId;
    const dst = 'g-dst' as NodeId;
    core.nodes._put({ id: src, nodeType: 'folder' });

    // Group store stub
    const groupData = new Map<string, GroupItemBase<any>[]>();
    groupData.set(src as any, [{ id: 'i1', data: { v: 1 } }] as any);
    const upserts: any[] = [];
    const gstore: GroupStore<any> = {
      async list(nodeId: NodeId) { return groupData.get(nodeId as any) || []; },
      async bulkUpsert(nodeId: NodeId, items) { upserts.push({ nodeId, items }); },
      async bulkDelete() { /* noop */ },
    };
    storeRegistry.registerGroup('folder', gstore);

    const mgr = (EntityLifecycleManager as any).getSingleton(core) as EntityLifecycleManager;
    const map = new Map<string, string>([[src as any, dst as any]]);
    (EntityLifecycleManager as any).setIdMapping('cmd-g', map);
    await mgr.onDuplicateNodes({ commandId: 'cmd-g', groupId: 'g', kind: 'duplicateNodes', payload: {}, issuedAt: Date.now(), type: 'duplicateNodes' } as any);

    expect(upserts.length).toBe(1);
    expect(upserts[0].nodeId).toBe(dst);
    expect(upserts[0].items[0].id).toBe('i1');
  });

  it('copies only relations with both ends inside idMap', async () => {
    const nodeMap = new Map<string, any>();
    const core: any = {
      getNode: async (id: NodeId) => nodeMap.get(id as any),
      nodes: { _put: (o: any) => nodeMap.set(o.id as any, o) },
    };
    const s1 = 'r-s1' as NodeId; const d1 = 'r-d1' as NodeId;
    const s2 = 'r-s2' as NodeId; const d2 = 'r-d2' as NodeId;
    const ext = 'ext' as NodeId;
    [s1, s2, ext].forEach(id => core.nodes._put({ id, nodeType: 'folder' }));

    // Relations store stub
    const rels: RelationBase<any>[] = [
      { srcNodeId: s1, dstNodeId: s2, type: 'LINK' }, // inside
      { srcNodeId: s1, dstNodeId: ext, type: 'LINK' }, // external -> skip
    ] as any;
    const listByNode = async (nodeId: NodeId) => rels.filter(r => r.srcNodeId === nodeId);
    const bulk: any[] = [];
    const rstore: RelationStore<any> = {
      listByNode,
      async bulkUpsert(rs) { bulk.push(...rs); },
      async bulkDelete() { /* noop */ },
    };
    storeRegistry.registerRelations('folder', rstore);

    const mgr = (EntityLifecycleManager as any).getSingleton(core) as EntityLifecycleManager;
    const map = new Map<string, string>([
      [s1 as any, d1 as any], [s2 as any, d2 as any],
    ]);
    (EntityLifecycleManager as any).setIdMapping('cmd-r', map);
    await mgr.onDuplicateNodes({ commandId: 'cmd-r', groupId: 'g', kind: 'duplicateNodes', payload: {}, issuedAt: Date.now(), type: 'duplicateNodes' } as any);

    expect(bulk.length).toBe(1);
    expect(bulk[0].srcNodeId).toBe(d1);
    expect(bulk[0].dstNodeId).toBe(d2);
  });
});

