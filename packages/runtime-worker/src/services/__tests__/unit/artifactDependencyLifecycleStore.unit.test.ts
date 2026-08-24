import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/core-types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ArtifactDependencyLifecycleStore,
  type CreateArtifactDependencyEdgeInput,
} from '../../artifactDependencyLifecycleStore.js';

const edge = (
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

describe('ArtifactDependencyLifecycleStore', () => {
  let store: ArtifactDependencyLifecycleStore;

  beforeEach(async () => {
    store = new ArtifactDependencyLifecycleStore(
      `artifact-dependency-lifecycle-${crypto.randomUUID()}`
    );
    await store.open();
  });

  afterEach(async () => {
    await store.delete();
  });

  it('persists active edges and marks affected target fields stale', async () => {
    await store.recordActiveEdges(
      [
        edge('edge-1'),
        edge('edge-2', {
          edgeId: 'edge-2',
          targetFieldPath: 'data.name',
        }),
      ],
      100
    );

    const stale = await store.markStaleByTarget({
      targetNodeId: 'location-1' as NodeId,
      targetFieldPath: 'data.coordinates',
      now: 120,
    });

    expect(stale).toHaveLength(1);
    expect(stale[0]).toMatchObject({
      edgeId: 'edge-1',
      status: 'stale',
      staleAt: 120,
      updatedAt: 120,
    });
    await expect(store.listEdgesByStatus('active')).resolves.toHaveLength(1);
    await expect(store.listEdgesByStatus('stale')).resolves.toHaveLength(1);
  });

  it('marks stale edges rebuilding for a build target and session', async () => {
    await store.recordActiveEdges([edge('edge-1')], 100);
    await store.markStaleByTarget({
      targetNodeId: 'location-1' as NodeId,
      now: 120,
    });

    const rebuilding = await store.markRebuilding({
      edgeIds: ['edge-1'],
      buildTargetNodeId: 'route-1' as NodeId,
      buildSessionId: 'build-session-1',
      now: 140,
    });

    expect(rebuilding).toEqual([
      expect.objectContaining({
        edgeId: 'edge-1',
        status: 'rebuilding',
        buildSessionId: 'build-session-1',
        rebuildingAt: 140,
      }),
    ]);
  });

  it('resolves stale or rebuilding edges when replacement active edges are recorded', async () => {
    await store.recordActiveEdges([edge('edge-1')], 100);
    await store.markStaleByTarget({
      targetNodeId: 'location-1' as NodeId,
      now: 120,
    });
    await store.markRebuilding({
      edgeIds: ['edge-1'],
      buildTargetNodeId: 'route-1' as NodeId,
      buildSessionId: 'build-session-1',
      now: 140,
    });

    const result = await store.resolveEdges({
      edgeIds: ['edge-1'],
      replacementEdges: [edge('edge-1-replacement')],
      now: 180,
    });

    expect(result.resolvedEdges).toEqual([
      expect.objectContaining({
        edgeId: 'edge-1',
        status: 'resolved',
        resolvedAt: 180,
        replacedByEdgeId: 'edge-1-replacement',
      }),
    ]);
    expect(result.activeEdges).toEqual([
      expect.objectContaining({
        edgeId: 'edge-1-replacement',
        status: 'active',
        createdAt: 180,
      }),
    ]);
    await expect(store.listEdgesByStatus('resolved')).resolves.toHaveLength(1);
    await expect(store.listEdgesByStatus('active')).resolves.toHaveLength(1);
  });

  it('detects orphaned edges from missing artifacts, nodes, and mounts', async () => {
    await store.recordActiveEdges(
      [
        edge('artifact-missing'),
        edge('source-missing', {
          artifactId: 'artifact-2',
          sourceNodeId: 'missing-source' as NodeId,
        }),
        edge('target-missing', {
          artifactId: 'artifact-3',
          targetNodeId: 'missing-target' as NodeId,
        }),
        edge('mount-missing', {
          artifactId: 'artifact-4',
          mountId: 'mount-1',
        }),
      ],
      100
    );

    const result = await store.detectOrphans({
      existingArtifactIds: new Set(['artifact-2', 'artifact-3', 'artifact-4']),
      existingNodeIds: new Set<NodeId>(['route-1' as NodeId, 'location-1' as NodeId]),
      existingMountIds: new Set(),
      now: 150,
    });

    expect(
      result.updatedEdges.map((record) => [record.edgeId, record.orphanReason]).sort()
    ).toEqual([
      ['artifact-missing', 'artifact-missing'],
      ['mount-missing', 'mount-missing'],
      ['source-missing', 'source-node-missing'],
      ['target-missing', 'target-node-missing'],
    ]);
    await expect(store.listEdgesByStatus('orphaned')).resolves.toHaveLength(4);
  });

  it('fails fast for invalid lifecycle inputs', async () => {
    await expect(store.recordActiveEdges([], 100)).rejects.toThrow('edges must include');
    await expect(
      store.recordActiveEdges(
        [
          {
            ...edge('edge-1'),
            targetFieldPath: '',
          },
        ],
        100
      )
    ).rejects.toThrow('targetFieldPath');
    await expect(
      store.recordActiveEdges([edge('edge-1')], Number.POSITIVE_INFINITY)
    ).rejects.toThrow('now');

    await store.recordActiveEdges([edge('edge-1')], 100);
    await expect(
      store.markRebuilding({
        edgeIds: ['edge-1'],
        buildTargetNodeId: 'route-1' as NodeId,
        buildSessionId: 'build-session-1',
        now: 120,
      })
    ).rejects.toThrow('must reference a stale edge');
    await expect(store.listEdgesByStatus('unknown' as never)).rejects.toThrow(
      'valid dependency edge status'
    );
  });
});
