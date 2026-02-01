import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocationDB } from '@hierarchidb/location-store';
import type { LocationFeatureId, LocationPointId } from '@hierarchidb/location-api';
import type { CoreDB } from '../../../services/CoreDB.js';
import { EntityLifecycleManager } from '../../EntityLifecycleManager.js';

describe('EntityLifecycleManager.copyGroupsByMapping', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('copies location features for mapped nodes', async () => {
    const db = getLocationDB();
    await db.open?.();
    const nodeMap = new Map<NodeId, TreeNode>();
    const withPayload = (
      node: Omit<TreeNode, 'data' | 'draftData' | 'metadata' | 'draftMetadata' | 'visible'> &
        Partial<TreeNode> & { name?: string }
    ): TreeNode => ({
      data: {},
      draftData: null,
      metadata: { name: node.name ?? 'Untitled', description: undefined, tags: [] },
      draftMetadata: null,
      visible: node.visible ?? true,
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
    const addNode = (id: NodeId, nodeType: NodeType) => nodeMap.set(id, makeNode(id, nodeType));
    const src = 'location-src' as NodeId;
    const dst = 'location-dst' as NodeId;
    const locationType = 'location' as NodeType;
    addNode(src, locationType);

    await db.features.where('nodeId').anyOf([src, dst]).delete();
    await db.features.bulkPut([{
      nodeId: src,
      id: 'loc-1' as LocationFeatureId,
      type: 'area_centroid',
      data: {
        schemaVersion: 2,
        pointId: 'p1' as LocationPointId,
        name: 'Point 1',
        latitude: 0,
        longitude: 0,
        type: 'area_centroid',
      },
      updatedAt: Date.now(),
    }]);

    const core: Pick<CoreDB, 'getNode'> = {
      getNode: vi.fn(async (id: NodeId) => nodeMap.get(id)),
    };

    const mgr = EntityLifecycleManager.getSingleton(core as unknown as CoreDB);
    EntityLifecycleManager.setIdMapping('cmd-group', [[src, dst]]);

    await mgr.onDuplicateNodes({
      commandId: 'cmd-group',
      groupId: 'g',
      kind: 'duplicateNodes',
      payload: { nodeIds: [], toParentId: 'parent' as NodeId },
      issuedAt: Date.now(),
      type: 'duplicateNodes',
    });

    expect(core.getNode).toHaveBeenCalledTimes(1);
    const copied = await db.features.where('nodeId').equals(dst).toArray();
    expect(copied).toHaveLength(1);
    expect(copied[0]?.data?.name).toBe('Point 1');
  });
});
