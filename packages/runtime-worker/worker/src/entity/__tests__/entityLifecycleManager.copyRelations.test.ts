import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/common-type';
import { EntityLifecycleManager } from '../EntityLifecycleManager.js';
import { storeRegistry } from '../store-registry.js';
import type { RelationBase, RelationStore } from '../store.js';

describe('EntityLifecycleManager.copyRelationsByMapping', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('copies relations only when both ends are inside the mapping', async () => {
    const nodeMap = new Map<string, { id: NodeId; nodeType: string }>();
    const addNode = (id: NodeId, nodeType: string) => nodeMap.set(id as unknown as string, { id, nodeType });
    const a1 = 'a1' as NodeId;
    const b1 = 'b1' as NodeId;
    const a2 = 'a2' as NodeId;
    const b2 = 'b2' as NodeId;
    const external = 'ext' as NodeId;
    addNode(a1, 'folder');
    addNode(a2, 'folder');
    addNode(external, 'folder');

    const emitted: RelationBase[] = [];
    const store: RelationStore = {
      async listByNode(nodeId) {
        if (nodeId === a1) {
          return [
            { srcNodeId: a1, dstNodeId: a2, type: 'LINK' },
            { srcNodeId: a1, dstNodeId: external, type: 'LINK' },
          ] as any;
        }
        return [];
      },
      async bulkUpsert(relations) {
        emitted.push(...relations);
      },
      async bulkDelete() {},
    };

    storeRegistry.registerRelations('folder', store);

    const core = {
      getNode: vi.fn(async (id: NodeId) => nodeMap.get(id as unknown as string)),
    } as any;

    const mgr = (EntityLifecycleManager as any).getSingleton(core) as EntityLifecycleManager;
    (EntityLifecycleManager as any).setIdMapping('cmd-rel', [
      [a1, b1],
      [a2, b2],
    ]);

    await mgr.onDuplicateNodes({
      commandId: 'cmd-rel',
      groupId: 'g',
      kind: 'duplicateNodes',
      payload: { nodeIds: [] },
      issuedAt: Date.now(),
      type: 'duplicateNodes',
    });

    expect(core.getNode).toHaveBeenCalledTimes(2);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].srcNodeId).toBe(b1);
    expect(emitted[0].dstNodeId).toBe(b2);
  });
});
