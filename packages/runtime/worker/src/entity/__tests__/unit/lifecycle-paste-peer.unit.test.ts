import type {
  CommandEnvelope,
  NodeId,
  PasteNodesPayload,
  Timestamp,
  TreeNode,
} from '@hierarchidb/common-types';
import { toNodeId, toNodeType } from '@hierarchidb/common-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreDB } from '../../../services/CoreDB.js';
import { EntityLifecycleManager } from '../EntityLifecycleManager.js';
import type { PeerEntity, PeerStore } from '../store.js';
import { storeRegistry } from '../store-registry.js';

describe('EntityLifecycleManager.onPasteNodes (Peer via idMap)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('copies peer entities for idMap on paste', async () => {
    const nodeMap = new Map<NodeId, TreeNode>();
    const core: Pick<CoreDB, 'getNode'> = {
      getNode: vi.fn(async (id: NodeId) => nodeMap.get(id)),
    };

    const peerMap = new Map<NodeId, PeerEntity<{ v: number }>>();
    const store: PeerStore<{ v: number }> = {
      async get(id: NodeId) {
        return peerMap.get(id);
      },
      async put(entity: PeerEntity<{ v: number }>) {
        peerMap.set(entity.nodeId, { ...entity });
      },
      async delete(id: NodeId) {
        peerMap.delete(id);
      },
    };
    const folderType = toNodeType('folder');
    storeRegistry.registerPeer(folderType, store);

    const sourceId = toNodeId('src-a');
    const targetId = toNodeId('dst-a');
    const sourceNode: TreeNode = {
      id: sourceId,
      parentId: toNodeId('parent'),
      nodeType: folderType,
      name: 'Source',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    nodeMap.set(sourceId, sourceNode);
    await store.put({ nodeId: sourceId, data: { v: 7 } });

    const mgr = EntityLifecycleManager.getSingleton(core as unknown as CoreDB);
    EntityLifecycleManager.setIdMapping('cmd-paste', [[sourceId, targetId]]);

    const payload: PasteNodesPayload = {
      nodes: { [sourceId]: sourceNode },
      nodeIds: [sourceId],
      toParentId: toNodeId('target-parent'),
    };
    const envelope: CommandEnvelope<'pasteNodes', PasteNodesPayload> = {
      commandId: 'cmd-paste',
      groupId: 'g1',
      kind: 'pasteNodes',
      payload,
      issuedAt: Date.now() as Timestamp,
    };

    await mgr.onPasteNodes(envelope);

    expect((await store.get(targetId))?.data?.v).toBe(7);
  });
});
