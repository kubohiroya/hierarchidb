import type { NodeId } from '@hierarchidb/core-types';
import { Dexie } from 'dexie';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BorderGeometryDatasetRecord } from '../BorderGeometryStorageTypes.js';
import { extractBorderGeometryArcs } from '../extractBorderGeometryArcs.js';
import { ShapeDB } from '../ShapeDB.js';

const NODE_ID = 'node-border-geometry-extraction' as NodeId;

const dataset: BorderGeometryDatasetRecord = {
  datasetId: 'dataset:JP:1:rev-2026',
  nodeId: NODE_ID,
  dataSource: 'fixture',
  countryCode: 'JP',
  adminLevel: 1,
  sourceKey: 'JP:1',
  upstreamRevision: 'rev-2026',
  borderGeometryConfigHash: 'border-config-v1',
  schemaVersion: 1,
  createdFromRevision: 'rev-2026',
  createdAt: 1000,
  updatedAt: 1000,
};

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

const coastlineOnlySquare = (): FeatureCollection<Polygon> => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'island-a',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [10, 10],
            [11, 10],
            [11, 11],
            [10, 11],
            [10, 10],
          ],
        ],
      },
    },
  ],
});

const tripleSharedEdge = (): FeatureCollection<Polygon> => ({
  type: 'FeatureCollection',
  features: [
    ...adjacentSquares().features,
    {
      type: 'Feature',
      id: 'polygon-c',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [1, 0],
            [1, 1],
            [0.5, 0.5],
            [1, 0],
          ],
        ],
      },
    },
  ],
});

describe('extractBorderGeometryArcs', () => {
  let databaseName: string;
  let db: ShapeDB;

  beforeEach(() => {
    databaseName = `test-border-extraction-${Date.now()}-${Math.random()}`;
    db = new ShapeDB(databaseName);
  });

  afterEach(async () => {
    db.close();
    await Dexie.delete(databaseName);
  });

  it('extracts shared-border and coastline arcs with owner polygon invariants', () => {
    const result = extractBorderGeometryArcs({
      dataset,
      featureCollection: adjacentSquares(),
      outputArtifactIdPrefix: 'artifact',
      now: 2000,
    });

    const sharedArcs = result.arcs.filter((arc) => arc.classification === 'sharedBorder');
    const coastlineArcs = result.arcs.filter((arc) => arc.classification === 'coastline');

    expect(sharedArcs).toHaveLength(1);
    expect(sharedArcs[0]?.ownerPolygonIds).toEqual(['polygon-a', 'polygon-b']);
    expect(sharedArcs[0]?.coordinates).toEqual([
      [1, 0],
      [1, 1],
    ]);
    expect(coastlineArcs).toHaveLength(3);
    expect(result.rings).toHaveLength(2);
    expect(result.polygonRelations).toHaveLength(2);
    expect(result.rings.every((ring) => ring.arcRefs.length > 0)).toBe(true);
  });

  it('keeps coastline-only topology out of shared-border adjacency', () => {
    const result = extractBorderGeometryArcs({
      dataset,
      featureCollection: coastlineOnlySquare(),
      outputArtifactIdPrefix: 'artifact',
      now: 2000,
    });

    expect(result.arcs).toHaveLength(1);
    expect(result.arcs[0]?.classification).toBe('coastline');
    expect(result.arcs[0]?.ownerPolygonIds).toEqual(['island-a']);
  });

  it('fails visibly when shared-border ownership is ambiguous', () => {
    expect(() =>
      extractBorderGeometryArcs({
        dataset,
        featureCollection: tripleSharedEdge(),
        outputArtifactIdPrefix: 'artifact',
        now: 2000,
      })
    ).toThrow('border-geometry-shared-border-owner-cardinality-invalid');
  });

  it('fails visibly for open rings and non-finite coordinates', () => {
    const openRing: FeatureCollection<Polygon> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'open',
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
    };
    expect(() =>
      extractBorderGeometryArcs({
        dataset,
        featureCollection: openRing,
        outputArtifactIdPrefix: 'artifact',
        now: 2000,
      })
    ).toThrow('border-geometry-ring-open');

    const invalidCoordinate: FeatureCollection<Polygon> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'invalid',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [Number.NaN, 0],
                [1, 1],
                [0, 0],
              ],
            ],
          },
        },
      ],
    };
    expect(() =>
      extractBorderGeometryArcs({
        dataset,
        featureCollection: invalidCoordinate,
        outputArtifactIdPrefix: 'artifact',
        now: 2000,
      })
    ).toThrow('border-geometry-arc-coordinates-invalid');
  });

  it('stores extracted records through the default-off storage API when explicitly enabled', async () => {
    const result = extractBorderGeometryArcs({
      dataset,
      featureCollection: adjacentSquares(),
      outputArtifactIdPrefix: 'artifact',
      now: 2000,
    });

    const options = { enabled: true };
    await db.putBorderGeometryDataset(dataset, options);
    for (const arc of result.arcs) {
      await db.putBorderGeometryArc(arc, options);
    }
    for (const ring of result.rings) {
      await db.putBorderGeometryRing(ring, options);
    }
    for (const relation of result.polygonRelations) {
      await db.putBorderGeometryPolygonRelation(relation, options);
    }

    await expect(db.borderGeometryArcs.count()).resolves.toBe(4);
    await expect(db.borderGeometryRings.count()).resolves.toBe(2);
    await expect(db.borderGeometryPolygonRelations.count()).resolves.toBe(2);
  });

  it('uses feature identity plus polygon part for multipolygon members', () => {
    const collection: FeatureCollection<MultiPolygon> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'multi-a',
          properties: {},
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 0],
                ],
              ],
              [
                [
                  [2, 0],
                  [3, 0],
                  [3, 1],
                  [2, 0],
                ],
              ],
            ],
          },
        },
      ],
    };

    const result = extractBorderGeometryArcs({
      dataset,
      featureCollection: collection,
      outputArtifactIdPrefix: 'artifact',
      now: 2000,
    });

    expect(result.polygonRelations.map((relation) => relation.polygonId)).toEqual([
      'multi-a#polygon-0',
      'multi-a#polygon-1',
    ]);
  });
});
