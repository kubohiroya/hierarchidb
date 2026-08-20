import type { NodeId } from '@hierarchidb/core-types';
import { EphemeralDB } from '@hierarchidb/gis-sdk';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  runShapeArtifactCascadeCleanup,
  ShapeArtifactCascadeCleanupError,
} from '../../services/vt/runShapeArtifactCascadeCleanup.js';

const targetNodeId = 'artifact-cleanup-target' as NodeId;
const otherNodeId = 'artifact-cleanup-other' as NodeId;

const putSourceCache = async (
  store: EphemeralDB,
  input: { id: string; nodeId: NodeId; sourceKey: string }
): Promise<void> => {
  await store.transaction('rw', [store.sourceCache, store.sourceCacheMeta], async () => {
    await store.sourceCache.put({
      ...input,
      domainType: 'shape',
      data: new ArrayBuffer(8),
      featureCount: 1,
      bbox: [0, 0, 1, 1],
      downloadTime: 1,
      size: 8,
      metadata: { rawSourceCacheKey: `download:test:${input.sourceKey.toLowerCase()}` },
      timestamp: 1,
    });
  });
};

const putGeometryCache = async (
  store: EphemeralDB,
  input: { id: string; nodeId: NodeId; sourceKey: string; bandIndex: number }
): Promise<void> => {
  await store.transaction('rw', [store.geometryCache, store.geometryCacheMeta], async () => {
    await store.geometryCache.put({
      ...input,
      domainType: 'shape',
      data: new ArrayBuffer(8),
      featureCount: 1,
      vertexCount: 4,
      polygonCount: 1,
      extractionRatio: 1,
      tolerance: 0,
      timestamp: 1,
    });
  });
};

const putTask = async (
  store: EphemeralDB,
  input: { taskId: string; nodeId: NodeId; stage: 'source' | 'geometry' | 'tileEmit' }
): Promise<void> => {
  await store.buildTasks.put({
    ...input,
    version: 1,
    status: 'queued',
    index: 0,
    progress: 0,
  });
};

const putRelation = async (
  store: EphemeralDB,
  input: { id: string; nodeId: NodeId; bufferId: string }
): Promise<void> => {
  await store.tileEmitBufferRelations.put({
    ...input,
    domainType: 'shape',
    bandIndex: 0,
    tileId: '0/0/0',
    createdAt: 1,
  });
};

describe('runShapeArtifactCascadeCleanup', () => {
  const store = new EphemeralDB('shape-artifact-cascade-cleanup-unit');

  beforeAll(async () => {
    await store.open();
  });

  beforeEach(async () => {
    await Promise.all([store.clearNodeData(targetNodeId), store.clearNodeData(otherNodeId)]);
  });

  afterAll(async () => {
    store.close();
    await store.delete();
  });

  it('rejects an aborted pipeline before starting cleanup writes', async () => {
    const abortController = new AbortController();
    abortController.abort();
    const deletePersistentArtifactsByNode = vi.fn(async (_nodeId: NodeId): Promise<void> => {});
    const deleteRawSourceBuffersByKeys = vi.fn(
      async (_nodeId: NodeId, cacheKeys: string[]): Promise<number> => cacheKeys.length
    );

    await expect(
      runShapeArtifactCascadeCleanup({
        nodeId: targetNodeId,
        target: { kind: 'stage', stage: 'source' },
        abortSignal: abortController.signal,
        dependencies: {
          ephemeralStore: store,
          deletePersistentArtifactsByNode,
          deleteRawSourceBuffersByKeys,
        },
      })
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(deletePersistentArtifactsByNode).not.toHaveBeenCalled();
    expect(deleteRawSourceBuffersByKeys).not.toHaveBeenCalled();
  });

  it('cascades a removed selection and preserves unrelated caches and nodes', async () => {
    await Promise.all([
      putSourceCache(store, { id: 'source-jp', nodeId: targetNodeId, sourceKey: 'JP:0' }),
      putSourceCache(store, { id: 'source-us', nodeId: targetNodeId, sourceKey: 'US:0' }),
      putSourceCache(store, { id: 'source-other', nodeId: otherNodeId, sourceKey: 'JP:0' }),
    ]);
    await Promise.all([
      putGeometryCache(store, {
        id: 'geometry-jp',
        nodeId: targetNodeId,
        sourceKey: 'JP:0',
        bandIndex: 0,
      }),
      putGeometryCache(store, {
        id: 'geometry-us',
        nodeId: targetNodeId,
        sourceKey: 'US:0',
        bandIndex: 1,
      }),
      putGeometryCache(store, {
        id: 'geometry-other',
        nodeId: otherNodeId,
        sourceKey: 'JP:0',
        bandIndex: 0,
      }),
    ]);
    await Promise.all([
      putTask(store, { taskId: 'target-source-task', nodeId: targetNodeId, stage: 'source' }),
      putTask(store, { taskId: 'target-tile-task', nodeId: targetNodeId, stage: 'tileEmit' }),
      putTask(store, { taskId: 'other-task', nodeId: otherNodeId, stage: 'source' }),
      putRelation(store, { id: 'target-relation', nodeId: targetNodeId, bufferId: 'geometry-us' }),
      putRelation(store, { id: 'other-relation', nodeId: otherNodeId, bufferId: 'geometry-other' }),
    ]);
    const deletePersistentArtifactsByNode = vi.fn(async (_nodeId: NodeId): Promise<void> => {});
    const deleteRawSourceBuffersByKeys = vi.fn(
      async (_nodeId: NodeId, cacheKeys: string[]): Promise<number> => cacheKeys.length
    );

    const result = await runShapeArtifactCascadeCleanup({
      nodeId: targetNodeId,
      target: {
        kind: 'selection',
        removedSelections: [{ countryCode: 'JP', adminLevel: 0 }],
      },
      dependencies: {
        ephemeralStore: store,
        deletePersistentArtifactsByNode,
        deleteRawSourceBuffersByKeys,
      },
    });

    expect(deletePersistentArtifactsByNode).toHaveBeenCalledWith(targetNodeId);
    expect(deleteRawSourceBuffersByKeys).toHaveBeenCalledWith(targetNodeId, ['download:test:jp:0']);
    expect(result).toMatchObject({
      sourceCachesDeleted: 1,
      geometryCachesDeleted: 1,
      taskRowsDeleted: 2,
      relationRowsDeleted: 1,
      rawSourceBuffersDeleted: 1,
      persistentArtifactsDeleted: true,
    });
    expect(await store.sourceCache.get('source-jp')).toBeUndefined();
    expect(await store.geometryCache.get('geometry-jp')).toBeUndefined();
    expect(await store.sourceCache.get('source-us')).toBeDefined();
    expect(await store.geometryCache.get('geometry-us')).toBeDefined();
    expect(await store.sourceCache.get('source-other')).toBeDefined();
    expect(await store.geometryCache.get('geometry-other')).toBeDefined();
    expect(await store.buildTasks.get('target-source-task')).toBeUndefined();
    expect(await store.buildTasks.get('target-tile-task')).toBeUndefined();
    expect(await store.buildTasks.get('other-task')).toBeDefined();
    expect(await store.tileEmitBufferRelations.get('target-relation')).toBeUndefined();
    expect(await store.tileEmitBufferRelations.get('other-relation')).toBeDefined();
  });

  it('does not mutate raw or ephemeral stores when persistent deletion fails', async () => {
    await putSourceCache(store, { id: 'source-jp', nodeId: targetNodeId, sourceKey: 'JP:0' });
    await putTask(store, { taskId: 'target-task', nodeId: targetNodeId, stage: 'source' });
    const deleteRawSourceBuffersByKeys = vi.fn(
      async (_nodeId: NodeId, cacheKeys: string[]): Promise<number> => cacheKeys.length
    );

    await expect(
      runShapeArtifactCascadeCleanup({
        nodeId: targetNodeId,
        target: {
          kind: 'selection',
          removedSelections: [{ countryCode: 'JP', adminLevel: 0 }],
        },
        dependencies: {
          ephemeralStore: store,
          deletePersistentArtifactsByNode: async () => {
            throw new Error('persistent delete failed');
          },
          deleteRawSourceBuffersByKeys,
        },
      })
    ).rejects.toMatchObject({
      name: 'ShapeArtifactCascadeCleanupError',
      step: 'delete-persistent-artifacts',
    });

    expect(deleteRawSourceBuffersByKeys).not.toHaveBeenCalled();
    expect(await store.sourceCache.get('source-jp')).toBeDefined();
    expect(await store.buildTasks.get('target-task')).toBeDefined();
  });

  it('cascades an invalid source cache to dependent geometry lineage', async () => {
    await putSourceCache(store, { id: 'invalid-source', nodeId: targetNodeId, sourceKey: 'JP:0' });
    await putGeometryCache(store, {
      id: 'dependent-geometry',
      nodeId: targetNodeId,
      sourceKey: 'JP:0',
      bandIndex: 0,
    });
    await putGeometryCache(store, {
      id: 'unrelated-geometry',
      nodeId: targetNodeId,
      sourceKey: 'US:0',
      bandIndex: 1,
    });

    const result = await runShapeArtifactCascadeCleanup({
      nodeId: targetNodeId,
      target: {
        kind: 'invalid-caches',
        sourceCacheIds: ['invalid-source'],
        geometryCacheIds: [],
      },
      dependencies: {
        ephemeralStore: store,
        deletePersistentArtifactsByNode: async () => {},
        deleteRawSourceBuffersByKeys: async (
          _nodeId: NodeId,
          cacheKeys: string[]
        ): Promise<number> => cacheKeys.length,
      },
    });

    expect(result).toMatchObject({
      sourceCachesDeleted: 1,
      geometryCachesDeleted: 1,
    });
    expect(await store.sourceCache.get('invalid-source')).toBeUndefined();
    expect(await store.geometryCache.get('dependent-geometry')).toBeUndefined();
    expect(await store.geometryCache.get('unrelated-geometry')).toBeDefined();
  });

  it('retains ephemeral lineage on raw failure and succeeds on retry', async () => {
    await putSourceCache(store, { id: 'source-jp', nodeId: targetNodeId, sourceKey: 'JP:0' });
    await putTask(store, { taskId: 'target-task', nodeId: targetNodeId, stage: 'source' });
    const target = {
      kind: 'selection' as const,
      removedSelections: [{ countryCode: 'JP', adminLevel: 0 }],
    };

    await expect(
      runShapeArtifactCascadeCleanup({
        nodeId: targetNodeId,
        target,
        dependencies: {
          ephemeralStore: store,
          deletePersistentArtifactsByNode: async () => {},
          deleteRawSourceBuffersByKeys: async () => {
            throw new Error('raw delete failed');
          },
        },
      })
    ).rejects.toMatchObject({ step: 'delete-raw-source-buffers' });

    expect(await store.sourceCache.get('source-jp')).toBeDefined();
    expect(await store.buildTasks.get('target-task')).toBeDefined();

    const retryResult = await runShapeArtifactCascadeCleanup({
      nodeId: targetNodeId,
      target,
      dependencies: {
        ephemeralStore: store,
        deletePersistentArtifactsByNode: async () => {},
        deleteRawSourceBuffersByKeys: async (
          _nodeId: NodeId,
          cacheKeys: string[]
        ): Promise<number> => cacheKeys.length,
      },
    });

    expect(retryResult).toMatchObject({
      sourceCachesDeleted: 1,
      rawSourceBuffersDeleted: 1,
    });
    expect(await store.sourceCache.get('source-jp')).toBeUndefined();
    expect(await store.buildTasks.get('target-task')).toBeUndefined();
  });

  it('keeps source caches and supports idempotent geometry-stage retries', async () => {
    await putSourceCache(store, { id: 'source-jp', nodeId: targetNodeId, sourceKey: 'JP:0' });
    await putGeometryCache(store, {
      id: 'geometry-jp',
      nodeId: targetNodeId,
      sourceKey: 'JP:0',
      bandIndex: 0,
    });
    await putTask(store, { taskId: 'target-task', nodeId: targetNodeId, stage: 'geometry' });
    const dependencies = {
      ephemeralStore: store,
      deletePersistentArtifactsByNode: async (_nodeId: NodeId): Promise<void> => {},
      deleteRawSourceBuffersByKeys: async (_nodeId: NodeId, cacheKeys: string[]): Promise<number> =>
        cacheKeys.length,
    };

    const first = await runShapeArtifactCascadeCleanup({
      nodeId: targetNodeId,
      target: { kind: 'stage', stage: 'geometry' },
      dependencies,
    });
    const second = await runShapeArtifactCascadeCleanup({
      nodeId: targetNodeId,
      target: { kind: 'stage', stage: 'geometry' },
      dependencies,
    });

    expect(first.geometryCachesDeleted).toBe(1);
    expect(second.geometryCachesDeleted).toBe(0);
    expect(await store.sourceCache.get('source-jp')).toBeDefined();
    expect(await store.geometryCache.get('geometry-jp')).toBeUndefined();
    expect(await store.buildTasks.get('target-task')).toBeUndefined();
  });

  it('limits tile-stage cleanup to downstream lineage', async () => {
    await putSourceCache(store, { id: 'source-jp', nodeId: targetNodeId, sourceKey: 'JP:0' });
    await putGeometryCache(store, {
      id: 'geometry-jp',
      nodeId: targetNodeId,
      sourceKey: 'JP:0',
      bandIndex: 0,
    });
    await Promise.all([
      putTask(store, { taskId: 'source-task', nodeId: targetNodeId, stage: 'source' }),
      putTask(store, { taskId: 'tile-task', nodeId: targetNodeId, stage: 'tileEmit' }),
      putRelation(store, { id: 'tile-relation', nodeId: targetNodeId, bufferId: 'geometry-jp' }),
    ]);

    await runShapeArtifactCascadeCleanup({
      nodeId: targetNodeId,
      target: { kind: 'stage', stage: 'tileEmit' },
      dependencies: {
        ephemeralStore: store,
        deletePersistentArtifactsByNode: async () => {},
      },
    });

    expect(await store.sourceCache.get('source-jp')).toBeDefined();
    expect(await store.geometryCache.get('geometry-jp')).toBeDefined();
    expect(await store.buildTasks.get('source-task')).toBeDefined();
    expect(await store.buildTasks.get('tile-task')).toBeUndefined();
    expect(await store.tileEmitBufferRelations.get('tile-relation')).toBeUndefined();
  });

  it('rejects mismatched raw lineage before deleting persistent artifacts', async () => {
    await putSourceCache(store, { id: 'source-jp', nodeId: targetNodeId, sourceKey: 'JP:0' });
    await store.sourceCacheMeta.update('source-jp', {
      metadata: { rawSourceCacheKey: 'download:test:mismatched' },
    });
    const deletePersistentArtifactsByNode = vi.fn(async (_nodeId: NodeId): Promise<void> => {});
    const deleteRawSourceBuffersByKeys = vi.fn(
      async (_nodeId: NodeId, cacheKeys: string[]): Promise<number> => cacheKeys.length
    );

    await expect(
      runShapeArtifactCascadeCleanup({
        nodeId: targetNodeId,
        target: {
          kind: 'selection',
          removedSelections: [{ countryCode: 'JP', adminLevel: 0 }],
        },
        dependencies: {
          ephemeralStore: store,
          deletePersistentArtifactsByNode,
          deleteRawSourceBuffersByKeys,
        },
      })
    ).rejects.toMatchObject({
      name: 'ShapeArtifactCascadeCleanupError',
      step: 'resolve-plan',
    });

    expect(deletePersistentArtifactsByNode).not.toHaveBeenCalled();
    expect(deleteRawSourceBuffersByKeys).not.toHaveBeenCalled();
    expect(await store.sourceCache.get('source-jp')).toBeDefined();
  });

  it('rejects cache IDs owned by another node before deleting artifacts', async () => {
    await putSourceCache(store, {
      id: 'source-other',
      nodeId: otherNodeId,
      sourceKey: 'JP:0',
    });
    const deletePersistentArtifactsByNode = vi.fn(async (_nodeId: NodeId): Promise<void> => {});

    await expect(
      runShapeArtifactCascadeCleanup({
        nodeId: targetNodeId,
        target: {
          kind: 'invalid-caches',
          sourceCacheIds: ['source-other'],
          geometryCacheIds: [],
        },
        dependencies: {
          ephemeralStore: store,
          deletePersistentArtifactsByNode,
        },
      })
    ).rejects.toMatchObject({
      name: 'ShapeArtifactCascadeCleanupError',
      step: 'resolve-plan',
    });

    expect(deletePersistentArtifactsByNode).not.toHaveBeenCalled();
    expect(await store.sourceCache.get('source-other')).toBeDefined();
  });

  it('rejects a non-canonical selection before deleting persistent artifacts', async () => {
    const deletePersistentArtifactsByNode = vi.fn(async (_nodeId: NodeId): Promise<void> => {});

    await expect(
      runShapeArtifactCascadeCleanup({
        nodeId: targetNodeId,
        target: {
          kind: 'selection',
          removedSelections: [{ countryCode: 'jp', adminLevel: 0 }],
        },
        dependencies: {
          ephemeralStore: store,
          deletePersistentArtifactsByNode,
        },
      })
    ).rejects.toBeInstanceOf(ShapeArtifactCascadeCleanupError);

    expect(deletePersistentArtifactsByNode).not.toHaveBeenCalled();
  });
});
