import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/core-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ArtifactDependencyLifecycleStore,
  type CreateArtifactDependencyEdgeInput,
} from '../../artifactDependencyLifecycleStore.js';
import { ArtifactDependencyRebuildPlanner } from '../../artifactDependencyRebuildPlanner.js';
import {
  type FeatureCellEditRequest,
  type FeatureCellSourceUpdater,
  FeatureDependencyEditService,
  type ValidatedFeatureCellEditRequest,
} from '../../FeatureDependencyEditService.js';

const createRequest = (
  overrides: Partial<FeatureCellEditRequest> = {}
): FeatureCellEditRequest => ({
  stagingRootNodeId: 'staging-root-1',
  featureNodeId: 'location-1',
  entityType: 'location',
  entityId: 'location-row-1',
  fieldPath: 'data.coordinates',
  previousValue: [0, 0],
  nextValue: [1, 1],
  dependencyStatus: 'active',
  editOrigin: 'preview-table',
  ...overrides,
});

const createEdge = (
  edgeId: string,
  overrides: Partial<CreateArtifactDependencyEdgeInput> = {}
): CreateArtifactDependencyEdgeInput => ({
  edgeId,
  artifactId: `artifact-${edgeId}`,
  artifactType: 'vector-tile',
  buildTargetNodeId: `route-${edgeId}` as NodeId,
  sourceNodeId: `route-${edgeId}` as NodeId,
  sourceFieldPath: 'data.geometry',
  targetNodeId: 'location-1' as NodeId,
  targetFieldPath: 'data.coordinates',
  ...overrides,
});

describe('FeatureDependencyEditService', () => {
  let store: ArtifactDependencyLifecycleStore;
  let sourceUpdater: FeatureCellSourceUpdater;
  let sourceUpdates: ValidatedFeatureCellEditRequest[];
  let enqueuedPlans: string[];

  beforeEach(async () => {
    store = new ArtifactDependencyLifecycleStore(`feature-edit-service-${crypto.randomUUID()}`);
    await store.open();
    sourceUpdates = [];
    enqueuedPlans = [];
    sourceUpdater = {
      applyFeatureCellEdit: vi.fn(async (request) => {
        sourceUpdates.push(request);
        return {
          sourceVersion: 2,
          refreshHint: {
            entityId: request.entityId,
            fieldPath: request.fieldPath,
            dependencyEdgeIds: [],
          },
        };
      }),
    };
  });

  afterEach(async () => {
    await store.delete();
  });

  const createService = () =>
    new FeatureDependencyEditService(
      store,
      new ArtifactDependencyRebuildPlanner(store, () => 200),
      sourceUpdater,
      {
        enqueueIncrementalRebuild: vi.fn(async (plan) => {
          enqueuedPlans.push(plan.planId);
        }),
      }
    );

  it('updates source data, marks active dependency edges stale, and enqueues a rebuild plan', async () => {
    await store.recordActiveEdges([createEdge('edge-2'), createEdge('edge-1')], 100);

    const result = await createService().applyFeatureCellEdit(createRequest());

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        sourceVersion: 2,
        impact: expect.objectContaining({
          dependencyStatus: 'stale',
          affectedDependencyEdgeIds: ['edge-1', 'edge-2'],
          rebuildRequired: true,
          rebuildPlan: {
            planId: 'rebuild-plan:edge-1+edge-2',
            rebuildTargetIds: ['route-edge-1', 'route-edge-2'],
            staleEdgeIds: ['edge-1', 'edge-2'],
          },
          dependencySummary: {
            edgeCounts: { stale: 2 },
            rebuildRequiredTargetIds: ['route-edge-1', 'route-edge-2'],
            rebuildingTargetIds: [],
          },
        }),
        warnings: [],
      })
    );
    expect(sourceUpdates).toHaveLength(1);
    expect(enqueuedPlans).toEqual(['rebuild-plan:edge-1+edge-2']);
    await expect(store.listEdgesByStatus('stale')).resolves.toHaveLength(2);
  });

  it('applies map feature popover requests through the same stale propagation and rebuild enqueue path', async () => {
    await store.recordActiveEdges([createEdge('edge-1')], 100);

    const result = await createService().applyFeatureCellEdit(
      createRequest({
        editOrigin: 'map-feature-popover',
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        impact: expect.objectContaining({
          dependencyStatus: 'stale',
          affectedDependencyEdgeIds: ['edge-1'],
          rebuildRequired: true,
          rebuildPlan: {
            planId: 'rebuild-plan:edge-1',
            rebuildTargetIds: ['route-edge-1'],
            staleEdgeIds: ['edge-1'],
          },
        }),
      })
    );
    expect(sourceUpdates).toEqual([
      expect.objectContaining({
        editOrigin: 'map-feature-popover',
        featureNodeId: 'location-1',
        fieldPath: 'data.coordinates',
      }),
    ]);
    expect(enqueuedPlans).toEqual(['rebuild-plan:edge-1']);
  });

  it('does not mark active edges stale when the owning plugin source write fails', async () => {
    await store.recordActiveEdges([createEdge('edge-1')], 100);
    sourceUpdater = {
      applyFeatureCellEdit: vi.fn(async () => {
        throw new Error('plugin source write failed');
      }),
    };

    const result = await createService().applyFeatureCellEdit(createRequest());

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        category: 'source-write',
        code: 'source-write-failed',
        context: expect.objectContaining({
          dependencyEdgeIds: ['edge-1'],
          rebuildTargetIds: ['route-edge-1'],
        }),
      }),
    });
    await expect(store.listEdgesByStatus('active')).resolves.toHaveLength(1);
    await expect(store.listEdgesByStatus('stale')).resolves.toHaveLength(0);
  });

  it('preserves existing stale dependency impact and rebuild requirement', async () => {
    await store.recordActiveEdges([createEdge('edge-1')], 100);
    await store.markStaleByTarget({
      targetNodeId: 'location-1' as NodeId,
      targetFieldPath: 'data.coordinates',
      now: 150,
    });

    const result = await createService().applyFeatureCellEdit(
      createRequest({
        dependencyStatus: 'stale',
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        impact: expect.objectContaining({
          dependencyStatus: 'stale',
          affectedDependencyEdgeIds: ['edge-1'],
          rebuildRequired: true,
          rebuildPlan: {
            planId: 'rebuild-plan:edge-1',
            rebuildTargetIds: ['route-edge-1'],
            staleEdgeIds: ['edge-1'],
          },
        }),
      })
    );
    expect(enqueuedPlans).toEqual(['rebuild-plan:edge-1']);
  });

  it('fails fast for rebuilding dependencies without changing source data', async () => {
    await store.recordActiveEdges([createEdge('edge-1')], 100);
    await store.markStaleByTarget({
      targetNodeId: 'location-1' as NodeId,
      targetFieldPath: 'data.coordinates',
      now: 150,
    });
    await store.markRebuilding({
      edgeIds: ['edge-1'],
      buildTargetNodeId: 'route-edge-1' as NodeId,
      buildSessionId: 'session-1',
      now: 175,
    });

    const result = await createService().applyFeatureCellEdit(
      createRequest({
        dependencyStatus: 'rebuilding',
      })
    );

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        category: 'dependency-conflict',
        code: 'rebuilding-dependency',
        context: expect.objectContaining({
          featureNodeId: 'location-1',
          fieldPath: 'data.coordinates',
          dependencyEdgeIds: ['edge-1'],
          rebuildTargetIds: ['route-edge-1'],
        }),
      }),
    });
    expect(sourceUpdates).toHaveLength(0);
  });

  it('routes orphaned dependencies to diagnostics without changing source data', async () => {
    await store.recordActiveEdges([createEdge('edge-1')], 100);
    await store.detectOrphans({
      existingArtifactIds: new Set(),
      existingNodeIds: new Set(['location-1' as NodeId, 'route-edge-1' as NodeId]),
      now: 175,
    });

    const result = await createService().applyFeatureCellEdit(
      createRequest({
        dependencyStatus: 'orphaned',
      })
    );

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        category: 'dependency-diagnostics',
        code: 'orphaned-dependency',
        context: expect.objectContaining({
          dependencyEdgeIds: ['edge-1'],
          rebuildTargetIds: ['route-edge-1'],
        }),
      }),
    });
    expect(sourceUpdates).toHaveLength(0);
  });

  it('allows pending-reference edits while preserving warning context', async () => {
    const result = await createService().applyFeatureCellEdit(
      createRequest({
        dependencyStatus: 'pending-reference',
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        impact: {
          dependencyStatus: 'pending-reference',
          affectedDependencyEdgeIds: [],
          rebuildRequired: false,
          dependencySummary: {
            edgeCounts: {},
            rebuildRequiredTargetIds: [],
            rebuildingTargetIds: [],
          },
        },
        warnings: [
          {
            code: 'pending-reference',
            message: 'feature cell edit completed while a referenced dependency is pending.',
            context: expect.objectContaining({
              featureNodeId: 'location-1',
              fieldPath: 'data.coordinates',
              dependencyStatus: 'pending-reference',
            }),
          },
        ],
      })
    );
    expect(sourceUpdates).toHaveLength(1);
  });

  it('updates source data without dependency impact for none status', async () => {
    const result = await createService().applyFeatureCellEdit(
      createRequest({
        dependencyStatus: 'none',
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        impact: {
          dependencyStatus: 'none',
          affectedDependencyEdgeIds: [],
          rebuildRequired: false,
          dependencySummary: {
            edgeCounts: {},
            rebuildRequiredTargetIds: [],
            rebuildingTargetIds: [],
          },
        },
      })
    );
    expect(enqueuedPlans).toEqual([]);
  });

  it('rejects missing write-target fields without defaulting them', async () => {
    const result = await createService().applyFeatureCellEdit({
      ...createRequest(),
      fieldPath: '',
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        category: 'validation',
        code: 'missing-required-field',
        context: expect.objectContaining({
          featureNodeId: 'location-1',
          fieldPath: '',
        }),
      }),
    });
    expect(sourceUpdates).toHaveLength(0);
  });

  it('rejects active dependency requests when no matching edge exists', async () => {
    const result = await createService().applyFeatureCellEdit(createRequest());

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        category: 'dependency-diagnostics',
        code: 'dependency-status-mismatch',
        context: expect.objectContaining({
          featureNodeId: 'location-1',
          fieldPath: 'data.coordinates',
          dependencyStatus: 'active',
        }),
      }),
    });
    expect(sourceUpdates).toHaveLength(0);
  });
});
