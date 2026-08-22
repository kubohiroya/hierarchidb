import type { NodeId } from '@hierarchidb/core-types';
import { ShapeDB } from '@hierarchidb/shape-store';
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

describe('validateShapeBorderGeometryPipeline', () => {
  let databaseName: string;
  let shapeDb: ShapeDB;

  beforeEach(() => {
    databaseName = `shape-border-pipeline-validation-${Date.now()}-${Math.random()}`;
    shapeDb = new ShapeDB(databaseName);
  });

  afterEach(async () => {
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
