import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreDB } from '../../../services/CoreDB.js';
import { EntityLifecycleManager } from '../../EntityLifecycleManager.js';
import type { PeerEntity, PeerStore } from '../../store.js';
import { storeRegistry } from '../../store-registry.js';

describe('EntityLifecycleManager.copyPeersByMapping', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('groups pairs by nodeType and calls bulkUpsertFromIds', async () => {
    const nodeMap = new Map<NodeId, TreeNode>();
    const withPayload = (
      node: Omit<TreeNode, 'data' | 'draftData' | 'metadata' | 'draftMetadata'> &
        Partial<TreeNode> & { name?: string }
    ): TreeNode => ({
      data: {},
      draftData: null,
      metadata: { name: node.name ?? 'Untitled', description: undefined, tags: [] },
      draftMetadata: null,
      ...node,
    });
    const makeNode = (id: NodeId, nodeType: NodeType): TreeNode =>
      withPayload({
        id,
        parentId: 'root' as NodeId,
        nodeType,
        name: String(id),
        depth: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      });
    const toNode = (id: NodeId, nodeType: NodeType) => {
      nodeMap.set(id, makeNode(id, nodeType));
    };
    const folderSrc = 'f-src' as NodeId;
    const folderDst = 'f-dst' as NodeId;
    const routeSrc = 'r-src' as NodeId;
    const routeDst = 'r-dst' as NodeId;
    const folderType = 'folder' as NodeType;
    const routeType = 'route' as NodeType;
    toNode(folderSrc, folderType);
    toNode(routeSrc, routeType);

    const bulkCalls: PeerEntity[] = [];
    const makeStore = (entities: Map<NodeId, PeerEntity>): PeerStore => ({
      async get(nodeId) {
        return entities.get(nodeId);
      },
      async put(entity) {
        entities.set(entity.nodeId, { ...entity });
      },
      async delete(nodeId) {
        entities.delete(nodeId);
      },
      async bulkUpsert(items) {
        bulkCalls.push(...items);
      },
    });

    const folderEntity: PeerEntity = { nodeId: folderSrc };
    const routeEntity: PeerEntity = { nodeId: routeSrc };
    storeRegistry.registerPeer('folder', makeStore(new Map([[folderSrc, folderEntity]])));
    storeRegistry.registerPeer('route', makeStore(new Map([[routeSrc, routeEntity]])));

    const core: Pick<CoreDB, 'getNode'> = {
      getNode: vi.fn(async (id: NodeId) => nodeMap.get(id)),
    };

    const mgr = EntityLifecycleManager.getSingleton(core as unknown as CoreDB);
    const mapping: ReadonlyArray<readonly [NodeId, NodeId]> = [
      [folderSrc, folderDst] as const,
      [routeSrc, routeDst] as const,
    ];
    EntityLifecycleManager.setIdMapping('cmd-peers', mapping);

    await mgr.onDuplicateNodes({
      commandId: 'cmd-peers',
      groupId: 'g',
      kind: 'duplicateNodes',
      payload: { nodeIds: [], toParentId: 'parent' as NodeId },
      issuedAt: Date.now(),
      type: 'duplicateNodes',
    });

    expect(core.getNode).toHaveBeenCalledTimes(2);
    const bulkNodeIds = bulkCalls.map((entry) => entry.nodeId);
    expect(bulkNodeIds).toEqual(expect.arrayContaining([folderDst, routeDst]));
  });
});
