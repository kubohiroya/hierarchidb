import 'fake-indexeddb/auto';
import type { NodeId, NodeType, Timestamp, TreeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreDB } from '../../CoreDB.js';
import type { PostEditDependencyStalePropagator } from '../../TreeNodeUpdaterService.js';
import { TreeNodeUpdaterService } from '../../TreeNodeUpdaterService.js';

const treeId = 'r' as TreeId;
const rootId = `${treeId}:root` as NodeId;
const nodeId = `${treeId}:location-1` as NodeId;

const createNode = (overrides: Partial<TreeNode> = {}): TreeNode => {
  const now = 100 as Timestamp;
  return {
    id: nodeId,
    parentId: rootId,
    nodeType: 'location' as NodeType,
    depth: 1,
    createdAt: now,
    updatedAt: now,
    version: 1,
    visible: true,
    metadata: {
      name: 'Location',
      description: '',
      tags: [],
    },
    draftMetadata: {
      name: 'Location',
      description: '',
      tags: [],
    },
    data: {
      coordinates: [0, 0],
    },
    draftData: {
      coordinates: [1, 1],
    },
    ...overrides,
  };
};

describe('TreeNodeUpdaterService dependency stale propagation', () => {
  let coreDB: CoreDB;
  let propagator: PostEditDependencyStalePropagator;
  let service: TreeNodeUpdaterService;

  beforeEach(async () => {
    CoreDB.resetInstance();
    coreDB = await CoreDB.getSingleton(`tree-node-updater-dependency-${crypto.randomUUID()}`);
    propagator = {
      markStaleForCommittedNodeEdit: vi.fn(async () => ({
        changedTargetFieldPaths: ['data.coordinates'],
        staleEdges: [],
        dependencySummary: {
          edgeCounts: {},
          rebuildRequiredTargetIds: [],
          rebuildingTargetIds: [],
        },
        dependencyChanges: [],
      })),
    };
    service = new TreeNodeUpdaterService(coreDB, undefined, undefined, undefined, propagator);
  });

  afterEach(() => {
    CoreDB.resetInstance();
  });

  it('propagates dependency stale state after a successful final save', async () => {
    await coreDB.nodes.put(createNode());

    const result = await service.updateTreeNode(nodeId, { mode: 'save' });

    expect(result.status).toBe('ok');
    expect(propagator.markStaleForCommittedNodeEdit).toHaveBeenCalledTimes(1);
    expect(propagator.markStaleForCommittedNodeEdit).toHaveBeenCalledWith({
      previousNode: expect.objectContaining({
        data: { coordinates: [0, 0] },
        draftData: { coordinates: [1, 1] },
      }),
      currentNode: expect.objectContaining({
        data: { coordinates: [1, 1] },
      }),
    });
  });

  it('does not propagate dependency stale state when saving a draft', async () => {
    await coreDB.nodes.put(createNode());

    const result = await service.updateTreeNode(nodeId, {
      mode: 'save-draft',
      draftData: { coordinates: [2, 2] },
    });

    expect(result.status).toBe('ok');
    expect(propagator.markStaleForCommittedNodeEdit).not.toHaveBeenCalled();
    await expect(coreDB.nodes.get(nodeId)).resolves.toEqual(
      expect.objectContaining({
        data: { coordinates: [0, 0] },
        draftData: { coordinates: [2, 2] },
      })
    );
  });
});
