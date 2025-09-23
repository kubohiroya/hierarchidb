import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId, NodeType, TreeNode, Timestamp } from '@hierarchidb/common-type';
import type { CoreDB } from '../../services/CoreDB.js';
import type { CommandEnvelope, PasteNodesPayload } from '../../services/command-types.js';
import { EntityLifecycleManager } from '../EntityLifecycleManager.js';
import { storeRegistry } from '../store-registry.js';
import type { PeerEntity, PeerStore } from '../store.js';

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
    const folderType = 'folder' as NodeType;
    storeRegistry.registerPeer(folderType, store);

    const sourceId = 'src-a' as NodeId;
    const targetId = 'dst-a' as NodeId;
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
    await store.put({ nodeId: sourceId, data: { v: 7 } });

    const mgr = EntityLifecycleManager.getSingleton(core as unknown as CoreDB);
    EntityLifecycleManager.setIdMapping('cmd-paste', [[sourceId, targetId]]);

    const payload: PasteNodesPayload = {
      nodes: { [sourceId]: sourceNode },
      nodeIds: [sourceId],
      toParentId: 'target-parent' as NodeId,
    };
    const envelope: CommandEnvelope<'pasteNodes', PasteNodesPayload> = {
      commandId: 'cmd-paste',
      groupId: 'g1',
      kind: 'pasteNodes',
      payload,
      issuedAt: Date.now() as Timestamp,
      type: 'pasteNodes',
    };

    await mgr.onPasteNodes(envelope);

    expect((await store.get(targetId))?.data?.v).toBe(7);
  });
});
