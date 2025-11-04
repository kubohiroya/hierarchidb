import type {
  CommandEnvelope,
  ImportNodesPayload,
  NodeId,
  Timestamp,
  TreeNode,
} from '@hierarchidb/common-types';
import { toNodeType } from '@hierarchidb/common-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreDB } from '../../../services/CoreDB.js';
import { EntityLifecycleManager } from '../../EntityLifecycleManager.js';
import type { PeerEntity, PeerStore } from '../../store.js';
import { storeRegistry } from '../../store-registry.js';

describe('EntityLifecycleManager.onImportNodes (Peer via idMap)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('copies peer entities for idMap on import', async () => {
    const nodeMap = new Map<NodeId, TreeNode>();
    const core: Pick<CoreDB, 'getNode'> = {
      getNode: vi.fn(async (id: NodeId) => nodeMap.get(id)),
    };

    const peerMap = new Map<NodeId, PeerEntity<{ x: number }>>();
    const store: PeerStore<{ x: number }> = {
      async get(id: NodeId) {
        return peerMap.get(id);
      },
      async put(entity) {
        peerMap.set(entity.nodeId, { ...entity });
      },
      async delete(id: NodeId) {
        peerMap.delete(id);
      },
    };
    const folderType = toNodeType('folder');
    storeRegistry.registerPeer(folderType, store);

    const sourceId = 'imp-src' as NodeId;
    const targetId = 'imp-dst' as NodeId;
    const sourceNode: TreeNode = {
      id: sourceId,
      parentId: 'parent' as NodeId,
      nodeType: folderType,
      name: 'Source',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    nodeMap.set(sourceId, sourceNode);
    await store.put({ nodeId: sourceId, data: { x: 99 } });

    const mgr = EntityLifecycleManager.getSingleton(core as unknown as CoreDB);
    EntityLifecycleManager.setIdMapping('cmd-import', [[sourceId, targetId]]);

    const payload: ImportNodesPayload = {
      nodes: { [sourceId]: sourceNode },
      nodeIds: [sourceId],
      toParentId: 'target-parent' as NodeId,
    };
    const envelope: CommandEnvelope<'importNodes', ImportNodesPayload> = {
      commandId: 'cmd-import',
      groupId: 'g1',
      kind: 'importNodes',
      payload,
      issuedAt: Date.now() as Timestamp,
    };

    await mgr.onImportNodes(envelope);

    expect((await store.get(targetId))?.data?.x).toBe(99);
  });
});
