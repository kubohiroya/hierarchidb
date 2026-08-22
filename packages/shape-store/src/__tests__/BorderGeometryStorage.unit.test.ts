import type { NodeId } from '@hierarchidb/core-types';
import { Dexie } from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  BorderGeometryArcRecord,
  BorderGeometryDatasetRecord,
  BorderGeometryPolygonRelationRecord,
  BorderGeometryRingRecord,
  BorderGeometrySpatialIndexRecord,
} from '../BorderGeometryStorageTypes.js';
import {
  isShapeBorderGeometryStorageEnabled,
  SHAPE_BORDER_GEOMETRY_STORAGE_FLAG,
} from '../isShapeBorderGeometryStorageEnabled.js';
import { ShapeDB } from '../ShapeDB.js';

const NODE_ID = 'node-border-geometry' as NodeId;

const createDatasetRecord = (
  overrides: Partial<BorderGeometryDatasetRecord> = {}
): BorderGeometryDatasetRecord => ({
  datasetId: 'dataset:JPN:1:rev-2026',
  nodeId: NODE_ID,
  dataSource: 'geoboundaries',
  countryCode: 'JP',
  adminLevel: 1,
  sourceKey: 'JP:1',
  upstreamRevision: 'rev-2026',
  borderGeometryConfigHash: 'config-hash-1',
  schemaVersion: 1,
  createdFromRevision: 'rev-2026',
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

const createArcRecord = (
  overrides: Partial<BorderGeometryArcRecord> = {}
): BorderGeometryArcRecord => ({
  datasetId: 'dataset:JPN:1:rev-2026',
  arcId: 'arc-1',
  nodeId: NODE_ID,
  classification: 'sharedBorder',
  orientation: 'canonical-forward',
  coordinates: [
    [130, 30],
    [140, 40],
  ],
  coordinateHash: 'coordinate-hash-1',
  endpointHash: 'endpoint-hash-1',
  ownerPolygonIds: ['polygon-a', 'polygon-b'],
  createdFromRevision: 'rev-2026',
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

const createSpatialIndexRecord = (
  overrides: Partial<BorderGeometrySpatialIndexRecord> = {}
): BorderGeometrySpatialIndexRecord => ({
  datasetId: 'dataset:JPN:1:rev-2026',
  indexId: 'index-1',
  nodeId: NODE_ID,
  sourceKey: 'JP:1',
  schemaVersion: 1,
  indexKind: 'arcBounds',
  indexConfigHash: 'index-config-hash-1',
  bounds: [130, 30, 140, 40],
  targetIds: ['arc-1'],
  createdFromRevision: 'rev-2026',
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

const createRingRecord = (
  overrides: Partial<BorderGeometryRingRecord> = {}
): BorderGeometryRingRecord => ({
  datasetId: 'dataset:JPN:1:rev-2026',
  ringId: 'ring-1',
  nodeId: NODE_ID,
  polygonId: 'polygon-a',
  role: 'outer',
  arcRefs: [{ arcId: 'arc-1', direction: 'forward' }],
  closed: true,
  orientation: 'clockwise',
  createdFromRevision: 'rev-2026',
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

const createPolygonRelationRecord = (
  overrides: Partial<BorderGeometryPolygonRelationRecord> = {}
): BorderGeometryPolygonRelationRecord => ({
  datasetId: 'dataset:JPN:1:rev-2026',
  polygonId: 'polygon-a',
  nodeId: NODE_ID,
  outerRingId: 'ring-1',
  innerRingIds: [],
  sourceFeatureId: 'feature-a',
  outputArtifactId: 'artifact-a',
  createdFromRevision: 'rev-2026',
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

describe('Border geometry storage', () => {
  let databaseName: string;
  let db: ShapeDB;

  beforeEach(() => {
    databaseName = `test-shape-border-geometry-${Date.now()}-${Math.random()}`;
    db = new ShapeDB(databaseName);
  });

  afterEach(async () => {
    db.close();
    await Dexie.delete(databaseName);
    const scope = globalThis as Record<string, unknown>;
    const env = scope.__HDB_ENV__;
    if (env && typeof env === 'object') {
      delete (env as Record<string, unknown>)[SHAPE_BORDER_GEOMETRY_STORAGE_FLAG];
    }
  });

  it('fails closed when the default-off flag is disabled', async () => {
    expect(isShapeBorderGeometryStorageEnabled()).toBe(false);
    await expect(db.putBorderGeometryDataset(createDatasetRecord())).rejects.toThrow(
      'shape-border-geometry-storage-disabled'
    );
    await expect(db.getBorderGeometryDataset('dataset:JPN:1:rev-2026')).rejects.toThrow(
      'shape-border-geometry-storage-disabled'
    );
  });

  it('stores valid dataset, arc, ring, polygon relation, and spatial index records when explicitly enabled', async () => {
    const options = { enabled: true };
    const dataset = createDatasetRecord();
    await db.putBorderGeometryDataset(dataset, options);
    await db.putBorderGeometryArc(createArcRecord(), options);
    await db.putBorderGeometryRing(createRingRecord(), options);
    await db.putBorderGeometryPolygonRelation(createPolygonRelationRecord(), options);
    await db.putBorderSpatialIndex(createSpatialIndexRecord(), options);

    await expect(db.getBorderGeometryDataset(dataset.datasetId, options)).resolves.toEqual(dataset);
    await expect(db.borderGeometryArcs.count()).resolves.toBe(1);
    await expect(db.borderGeometryRings.count()).resolves.toBe(1);
    await expect(db.borderGeometryPolygonRelations.count()).resolves.toBe(1);
    await expect(db.borderSpatialIndexes.count()).resolves.toBe(1);
  });

  it('clears border geometry artifacts by node for pipeline rollback cleanup', async () => {
    const options = { enabled: true };
    const otherNodeId = 'other-node' as NodeId;
    await db.putBorderGeometryDataset(createDatasetRecord(), options);
    await db.putBorderGeometryArc(createArcRecord(), options);
    await db.putBorderGeometryRing(createRingRecord(), options);
    await db.putBorderGeometryPolygonRelation(createPolygonRelationRecord(), options);
    await db.putBorderSpatialIndex(createSpatialIndexRecord(), options);
    await db.putBorderGeometryDataset(
      createDatasetRecord({
        datasetId: 'dataset:US:1:rev-2026',
        nodeId: otherNodeId,
        countryCode: 'US',
        sourceKey: 'US:1',
      }),
      options
    );

    await db.clearBorderGeometryByNode(NODE_ID, options);

    await expect(db.borderGeometryDatasets.where('nodeId').equals(NODE_ID).count()).resolves.toBe(
      0
    );
    await expect(db.borderGeometryArcs.where('nodeId').equals(NODE_ID).count()).resolves.toBe(0);
    await expect(db.borderGeometryRings.where('nodeId').equals(NODE_ID).count()).resolves.toBe(0);
    await expect(
      db.borderGeometryPolygonRelations.where('nodeId').equals(NODE_ID).count()
    ).resolves.toBe(0);
    await expect(db.borderSpatialIndexes.where('nodeId').equals(NODE_ID).count()).resolves.toBe(0);
    await expect(
      db.borderGeometryDatasets.where('nodeId').equals(otherNodeId).count()
    ).resolves.toBe(1);
  });

  it('rejects invalid dataset identity instead of supplementing defaults', async () => {
    await expect(
      db.putBorderGeometryDataset(
        createDatasetRecord({
          countryCode: 'JPN',
          sourceKey: 'JP:1',
        }),
        { enabled: true }
      )
    ).rejects.toThrow('border-geometry-country-code-invalid');

    await expect(
      db.putBorderGeometryDataset(
        createDatasetRecord({
          countryCode: 'JP',
          sourceKey: 'JP:',
        }),
        { enabled: true }
      )
    ).rejects.toThrow('border-geometry-source-key-invalid');
  });

  it('rejects arc and index records whose ownership does not match the dataset', async () => {
    const options = { enabled: true };
    await db.putBorderGeometryDataset(createDatasetRecord(), options);

    await expect(
      db.putBorderGeometryArc(createArcRecord({ nodeId: 'other-node' as NodeId }), options)
    ).rejects.toThrow('border-geometry-dataset-ownership-mismatch');

    await expect(
      db.putBorderGeometryPolygonRelation(
        createPolygonRelationRecord({ createdFromRevision: 'stale-revision' }),
        options
      )
    ).rejects.toThrow('border-geometry-dataset-ownership-mismatch');

    await expect(
      db.putBorderSpatialIndex(createSpatialIndexRecord({ sourceKey: 'US:1' }), options)
    ).rejects.toThrow('border-geometry-dataset-ownership-mismatch');
  });

  it('rejects invalid arc coordinate contracts', async () => {
    const options = { enabled: true };
    await db.putBorderGeometryDataset(createDatasetRecord(), options);

    await expect(
      db.putBorderGeometryArc(
        createArcRecord({
          coordinates: [
            [130, 30],
            [181, 40],
          ],
        }),
        options
      )
    ).rejects.toThrow('border-geometry-arc-coordinates-invalid');
  });

  it('rejects invalid ring and polygon relation contracts', async () => {
    const options = { enabled: true };
    await db.putBorderGeometryDataset(createDatasetRecord(), options);

    await expect(
      db.putBorderGeometryRing(createRingRecord({ closed: false }), options)
    ).rejects.toThrow('border-geometry-ring-open');

    await expect(
      db.putBorderGeometryPolygonRelation(createPolygonRelationRecord({ outerRingId: '' }), options)
    ).rejects.toThrow('border-geometry-polygon-outer-ring-id-required');
  });

  it('allows environment opt-in without enabling by default', async () => {
    const scope = globalThis as Record<string, unknown>;
    scope.__HDB_ENV__ = {
      ...(typeof scope.__HDB_ENV__ === 'object' && scope.__HDB_ENV__ ? scope.__HDB_ENV__ : {}),
      [SHAPE_BORDER_GEOMETRY_STORAGE_FLAG]: '1',
    };

    expect(isShapeBorderGeometryStorageEnabled()).toBe(true);
    await expect(db.putBorderGeometryDataset(createDatasetRecord())).resolves.toBeUndefined();
  });
});
