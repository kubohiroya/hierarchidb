import 'fake-indexeddb/auto';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ArtifactDependencyLifecycleStore,
  type CreateArtifactDependencyEdgeInput,
} from '../../artifactDependencyLifecycleStore.js';
import {
  ArtifactDependencyRebuildPlanner,
  collectCommittedNodeChangedFieldPaths,
} from '../../artifactDependencyRebuildPlanner.js';

const createEdge = (
  edgeId: string,
  overrides: Partial<CreateArtifactDependencyEdgeInput> = {}
): CreateArtifactDependencyEdgeInput => ({
  edgeId,
  artifactId: 'artifact-1',
  artifactType: 'vector-tile',
  buildTargetNodeId: 'route-1' as NodeId,
  sourceNodeId: 'route-1' as NodeId,
  sourceFieldPath: 'data.geometry',
  targetNodeId: 'location-1' as NodeId,
  targetFieldPath: 'data.coordinates',
  ...overrides,
});

const createNode = (data: Record<string, unknown>): TreeNode => ({
  id: 'location-1' as NodeId,
  parentId: 'r:root' as NodeId,
  nodeType: 'location' as NodeType,
  depth: 1,
  createdAt: 1,
  updatedAt: 1,
  version: 1,
  visible: true,
  metadata: {
    name: 'Location',
    description: '',
    tags: [],
  },
  draftMetadata: null,
  data,
});

describe('ArtifactDependencyRebuildPlanner', () => {
  let store: ArtifactDependencyLifecycleStore;
  let planner: ArtifactDependencyRebuildPlanner;

  beforeEach(async () => {
    store = new ArtifactDependencyLifecycleStore(
      `artifact-dependency-rebuild-planner-${crypto.randomUUID()}`
    );
    await store.open();
    planner = new ArtifactDependencyRebuildPlanner(store, () => 200);
  });

  afterEach(async () => {
    await store.delete();
  });

  it('marks active dependency edges stale and creates a deterministic rebuild plan', async () => {
    await store.recordActiveEdges(
      [
        createEdge('edge-2', {
          artifactId: 'artifact-2',
          buildTargetNodeId: 'route-2' as NodeId,
        }),
        createEdge('edge-1'),
      ],
      100
    );

    const result = await planner.markStaleForCommittedNodeEdit({
      previousNode: createNode({ coordinates: [0, 0], name: 'Before' }),
      currentNode: createNode({ coordinates: [1, 1], name: 'Before' }),
    });

    expect(result.changedTargetFieldPaths).toEqual(['data.coordinates']);
    expect(result.staleEdges.map((edge) => edge.edgeId)).toEqual(['edge-1', 'edge-2']);
    expect(result.rebuildPlan).toEqual({
      planId: 'rebuild-plan:edge-1+edge-2',
      rebuildTargetIds: ['route-1', 'route-2'],
      staleEdgeIds: ['edge-1', 'edge-2'],
    });
    expect(result.dependencySummary).toEqual({
      edgeCounts: { stale: 2 },
      rebuildRequiredTargetIds: ['route-1', 'route-2'],
      rebuildingTargetIds: [],
    });
    expect(result.dependencyChanges).toEqual([
      expect.objectContaining({
        edgeId: 'edge-1',
        previousStatus: 'active',
        nextStatus: 'stale',
        rebuildPlanId: 'rebuild-plan:edge-1+edge-2',
      }),
      expect.objectContaining({
        edgeId: 'edge-2',
        previousStatus: 'active',
        nextStatus: 'stale',
        rebuildPlanId: 'rebuild-plan:edge-1+edge-2',
      }),
    ]);
  });

  it('matches descendant dependency paths when a parent field changes', async () => {
    await store.recordActiveEdges(
      [
        createEdge('edge-1', {
          targetFieldPath: 'data.settings.color',
        }),
      ],
      100
    );

    const result = await planner.markStaleByTarget({
      targetNodeId: 'location-1' as NodeId,
      changedTargetFieldPaths: ['data.settings'],
    });

    expect(result.staleEdges.map((edge) => edge.edgeId)).toEqual(['edge-1']);
  });

  it('does not create a rebuild plan when committed fields are unchanged', async () => {
    await store.recordActiveEdges([createEdge('edge-1')], 100);

    const result = await planner.markStaleForCommittedNodeEdit({
      previousNode: createNode({ coordinates: [0, 0] }),
      currentNode: createNode({ coordinates: [0, 0] }),
    });

    expect(result).toEqual({
      changedTargetFieldPaths: [],
      staleEdges: [],
      dependencySummary: {
        edgeCounts: {},
        rebuildRequiredTargetIds: [],
        rebuildingTargetIds: [],
      },
      dependencyChanges: [],
    });
  });

  it('rejects invalid post-edit stale propagation input', async () => {
    await expect(
      planner.markStaleByTarget({
        targetNodeId: 'location-1' as NodeId,
        changedTargetFieldPaths: [''],
      })
    ).rejects.toThrow('changedTargetFieldPaths[0]');
    await expect(
      planner.markStaleForCommittedNodeEdit({
        previousNode: createNode({ coordinates: [0, 0] }),
        currentNode: {
          ...createNode({ coordinates: [1, 1] }),
          id: 'other-location' as NodeId,
        },
      })
    ).rejects.toThrow('previousNode.id and currentNode.id must match');
  });

  it('collects metadata and data field changes without cross-slot fallback', () => {
    const previousNode = createNode({ coordinates: [0, 0], nested: { value: 1 } });
    const currentNode = {
      ...createNode({ coordinates: [0, 0], nested: { value: 2 } }),
      metadata: {
        name: 'Renamed',
        description: '',
        tags: [],
      },
    };

    expect(collectCommittedNodeChangedFieldPaths(previousNode, currentNode)).toEqual([
      'data.nested.value',
      'metadata.name',
    ]);
  });
});
