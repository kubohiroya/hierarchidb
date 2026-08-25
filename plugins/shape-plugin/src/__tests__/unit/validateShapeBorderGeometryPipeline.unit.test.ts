import type { NodeId } from '@hierarchidb/core-types';
import { SHAPE_BORDER_GEOMETRY_STORAGE_FLAG, ShapeDB } from '@hierarchidb/shape-store';
import { Dexie } from 'dexie';
import type { FeatureCollection, Polygon } from 'geojson';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateShapeBorderGeometryPipeline } from '../../services/vt/validateShapeBorderGeometryPipeline.js';

const nodeId = 'node-border-geometry-pipeline-validation' as NodeId;

const adjacentSquares = (): FeatureCollection<Polygon> => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'polygon-a',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      id: 'polygon-b',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [1, 0],
            [2, 0],
            [2, 1],
            [1, 1],
            [1, 0],
          ],
        ],
      },
    },
  ],
});

const openRing = (): FeatureCollection<Polygon> => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'open-ring',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
        ],
      },
    },
  ],
});

const runtimeEnvScope = globalThis as Record<string, unknown>;

const setBorderGeometryStorageEnv = (enabled: boolean): void => {
  runtimeEnvScope.__HDB_ENV__ = {
    [SHAPE_BORDER_GEOMETRY_STORAGE_FLAG]: enabled ? 'true' : 'false',
  };
};

const clearRuntimeEnv = (): void => {
  delete runtimeEnvScope.__HDB_ENV__;
};

describe('validateShapeBorderGeometryPipeline', () => {
  let databaseName: string;
  let shapeDb: ShapeDB;

  beforeEach(() => {
    databaseName = `shape-border-pipeline-validation-${Date.now()}-${Math.random()}`;
    shapeDb = new ShapeDB(databaseName);
  });

  afterEach(async () => {
    clearRuntimeEnv();
    shapeDb.close();
    await Dexie.delete(databaseName);
  });

  it('keeps the pipeline path disabled by default without touching border geometry storage', async () => {
    const result = await validateShapeBorderGeometryPipeline({
      shapeDb,
      nodeId,
      dataSource: 'fixture',
      countryCode: 'JP',
      adminLevel: 1,
      sourceKey: 'JP:1',
      upstreamRevision: 'rev-2026',
      borderGeometryConfigHash: 'border-config-v1',
      featureCollection: adjacentSquares(),
      outputArtifactIdPrefix: 'artifact',
      simplifyTolerance: 0,
      now: 2000,
    });

    expect(result).toEqual({
      status: 'skipped',
      reason: 'feature-disabled',
    });
    await expect(shapeDb.borderGeometryDatasets.count()).resolves.toBe(0);
    await expect(shapeDb.borderGeometryArcs.count()).resolves.toBe(0);
    await expect(shapeDb.borderGeometryRings.count()).resolves.toBe(0);
    await expect(shapeDb.borderGeometryPolygonRelations.count()).resolves.toBe(0);
  });

  it('validates extraction, simplification, reconstruction, and storage when explicitly enabled', async () => {
    const result = await validateShapeBorderGeometryPipeline({
      shapeDb,
      nodeId,
      dataSource: 'fixture',
      countryCode: 'JP',
      adminLevel: 1,
      sourceKey: 'JP:1',
      upstreamRevision: 'rev-2026',
      borderGeometryConfigHash: 'border-config-v1',
      featureCollection: adjacentSquares(),
      outputArtifactIdPrefix: 'artifact',
      simplifyTolerance: 0,
      now: 2000,
      storage: { enabled: true },
    });

    expect(result.status).toBe('completed');
    if (result.status !== 'completed') {
      throw new Error('border-geometry-pipeline-validation-not-completed');
    }
    expect(result.metrics).toMatchObject({
      arcCount: 4,
      ringCount: 2,
      polygonRelationCount: 2,
      reconstructedPolygonCount: 2,
    });
    expect(Number.isFinite(result.metrics.durationMs)).toBe(true);
    expect(result.metrics.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.reconstruction.polygons.map((polygon) => polygon.polygonId)).toEqual([
      'polygon-a',
      'polygon-b',
    ]);
    await expect(shapeDb.borderGeometryDatasets.count()).resolves.toBe(1);
    await expect(shapeDb.borderGeometryArcs.count()).resolves.toBe(4);
    await expect(shapeDb.borderGeometryRings.count()).resolves.toBe(2);
    await expect(shapeDb.borderGeometryPolygonRelations.count()).resolves.toBe(2);
  });

  it('uses the runtime storage gate when no explicit storage option is provided', async () => {
    setBorderGeometryStorageEnv(true);

    const result = await validateShapeBorderGeometryPipeline({
      shapeDb,
      nodeId,
      dataSource: 'fixture',
      countryCode: 'JP',
      adminLevel: 1,
      sourceKey: 'JP:1',
      upstreamRevision: 'rev-2026',
      borderGeometryConfigHash: 'border-config-v1',
      featureCollection: adjacentSquares(),
      outputArtifactIdPrefix: 'artifact',
      simplifyTolerance: 0,
      now: 2000,
    });

    expect(result.status).toBe('completed');
    await expect(shapeDb.borderGeometryDatasets.count()).resolves.toBe(1);
    await expect(shapeDb.borderGeometryArcs.count()).resolves.toBe(4);
  });

  it('preserves other source datasets for the same node when replacing one dataset', async () => {
    const firstResult = await validateShapeBorderGeometryPipeline({
      shapeDb,
      nodeId,
      dataSource: 'fixture',
      countryCode: 'JP',
      adminLevel: 1,
      sourceKey: 'JP:1',
      upstreamRevision: 'rev-2026',
      borderGeometryConfigHash: 'border-config-v1',
      featureCollection: adjacentSquares(),
      outputArtifactIdPrefix: 'artifact-jp-1',
      simplifyTolerance: 0,
      now: 2000,
      storage: { enabled: true },
    });
    const secondResult = await validateShapeBorderGeometryPipeline({
      shapeDb,
      nodeId,
      dataSource: 'fixture',
      countryCode: 'JP',
      adminLevel: 2,
      sourceKey: 'JP:2',
      upstreamRevision: 'rev-2026',
      borderGeometryConfigHash: 'border-config-v1',
      featureCollection: adjacentSquares(),
      outputArtifactIdPrefix: 'artifact-jp-2',
      simplifyTolerance: 0,
      now: 3000,
      storage: { enabled: true },
    });
    if (firstResult.status !== 'completed' || secondResult.status !== 'completed') {
      throw new Error('border-geometry-pipeline-validation-not-completed');
    }

    await expect(shapeDb.borderGeometryDatasets.count()).resolves.toBe(2);
    await expect(shapeDb.borderGeometryArcs.count()).resolves.toBe(8);

    await validateShapeBorderGeometryPipeline({
      shapeDb,
      nodeId,
      dataSource: 'fixture',
      countryCode: 'JP',
      adminLevel: 1,
      sourceKey: 'JP:1',
      upstreamRevision: 'rev-2026',
      borderGeometryConfigHash: 'border-config-v1',
      featureCollection: adjacentSquares(),
      outputArtifactIdPrefix: 'artifact-jp-1-rebuilt',
      simplifyTolerance: 0,
      now: 4000,
      storage: { enabled: true },
    });

    await expect(shapeDb.borderGeometryDatasets.count()).resolves.toBe(2);
    await expect(shapeDb.borderGeometryArcs.count()).resolves.toBe(8);
    await expect(
      shapeDb.getBorderGeometryDataset(firstResult.dataset.datasetId, { enabled: true })
    ).resolves.toMatchObject({
      borderGeometryConfigHash: 'border-config-v1',
      updatedAt: 4000,
    });
    await expect(
      shapeDb.getBorderGeometryDataset(secondResult.dataset.datasetId, { enabled: true })
    ).resolves.toMatchObject({
      borderGeometryConfigHash: 'border-config-v1',
      updatedAt: 3000,
    });
  });

  it('uses node and border config identity when deriving dataset ids', async () => {
    const sameNodeFirstConfig = await validateShapeBorderGeometryPipeline({
      shapeDb,
      nodeId,
      dataSource: 'fixture',
      countryCode: 'JP',
      adminLevel: 1,
      sourceKey: 'JP:1',
      upstreamRevision: 'rev-2026',
      borderGeometryConfigHash: 'border-config-v1',
      featureCollection: adjacentSquares(),
      outputArtifactIdPrefix: 'artifact-config-1',
      simplifyTolerance: 0,
      now: 2000,
      storage: { enabled: true },
    });
    const sameNodeSecondConfig = await validateShapeBorderGeometryPipeline({
      shapeDb,
      nodeId,
      dataSource: 'fixture',
      countryCode: 'JP',
      adminLevel: 1,
      sourceKey: 'JP:1',
      upstreamRevision: 'rev-2026',
      borderGeometryConfigHash: 'border-config-v2',
      featureCollection: adjacentSquares(),
      outputArtifactIdPrefix: 'artifact-config-2',
      simplifyTolerance: 0,
      now: 3000,
      storage: { enabled: true },
    });
    const otherNodeSameSource = await validateShapeBorderGeometryPipeline({
      shapeDb,
      nodeId: 'node-border-geometry-pipeline-validation-other' as NodeId,
      dataSource: 'fixture',
      countryCode: 'JP',
      adminLevel: 1,
      sourceKey: 'JP:1',
      upstreamRevision: 'rev-2026',
      borderGeometryConfigHash: 'border-config-v1',
      featureCollection: adjacentSquares(),
      outputArtifactIdPrefix: 'artifact-other-node',
      simplifyTolerance: 0,
      now: 4000,
      storage: { enabled: true },
    });
    if (
      sameNodeFirstConfig.status !== 'completed' ||
      sameNodeSecondConfig.status !== 'completed' ||
      otherNodeSameSource.status !== 'completed'
    ) {
      throw new Error('border-geometry-pipeline-validation-not-completed');
    }

    expect(
      new Set([
        sameNodeFirstConfig.dataset.datasetId,
        sameNodeSecondConfig.dataset.datasetId,
        otherNodeSameSource.dataset.datasetId,
      ]).size
    ).toBe(3);
    await expect(shapeDb.borderGeometryDatasets.count()).resolves.toBe(3);
    await expect(shapeDb.borderGeometryArcs.count()).resolves.toBe(12);
  });

  it('fails visibly before storage writes when enabled input violates geometry contracts', async () => {
    await expect(
      validateShapeBorderGeometryPipeline({
        shapeDb,
        nodeId,
        dataSource: 'fixture',
        countryCode: 'JP',
        adminLevel: 1,
        sourceKey: 'JP:1',
        upstreamRevision: 'rev-2026',
        borderGeometryConfigHash: 'border-config-v1',
        featureCollection: openRing(),
        outputArtifactIdPrefix: 'artifact',
        simplifyTolerance: 0,
        now: 2000,
        storage: { enabled: true },
      })
    ).rejects.toThrow('border-geometry-ring-open');

    await expect(shapeDb.borderGeometryDatasets.count()).resolves.toBe(0);
    await expect(shapeDb.borderGeometryArcs.count()).resolves.toBe(0);
    await expect(shapeDb.borderGeometryRings.count()).resolves.toBe(0);
    await expect(shapeDb.borderGeometryPolygonRelations.count()).resolves.toBe(0);
  });
});
