import type { NodeId } from '@hierarchidb/core-types';
import { Dexie } from 'dexie';
import type { FeatureCollection, Polygon } from 'geojson';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BorderGeometryDatasetRecord } from '../BorderGeometryStorageTypes.js';
import { extractBorderGeometryArcs } from '../extractBorderGeometryArcs.js';
import { ShapeDB } from '../ShapeDB.js';
import { simplifyBorderGeometryArcs } from '../simplifyBorderGeometryArcs.js';

const NODE_ID = 'node-border-geometry-simplification' as NodeId;

const dataset: BorderGeometryDatasetRecord = {
  datasetId: 'dataset:JP:1:rev-2026-simplified',
  nodeId: NODE_ID,
  dataSource: 'fixture',
  countryCode: 'JP',
  adminLevel: 1,
  sourceKey: 'JP:1',
  upstreamRevision: 'rev-2026',
  borderGeometryConfigHash: 'border-config-simplification-v1',
  schemaVersion: 1,
  createdFromRevision: 'rev-2026',
  createdAt: 1000,
  updatedAt: 1000,
};

const jaggedSharedBorder = (): FeatureCollection<Polygon> => ({
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
            [1.1, 0.5],
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
            [1.1, 0.5],
            [1, 0],
          ],
        ],
      },
    },
  ],
});

describe('simplifyBorderGeometryArcs', () => {
  let databaseName: string;
  let db: ShapeDB;

  beforeEach(() => {
    databaseName = `test-border-simplification-${Date.now()}-${Math.random()}`;
    db = new ShapeDB(databaseName);
  });

  afterEach(async () => {
    db.close();
    await Dexie.delete(databaseName);
  });

  it('simplifies a shared arc once and keeps both polygon rings on the same arc', () => {
    const extraction = extractBorderGeometryArcs({
      dataset,
      featureCollection: jaggedSharedBorder(),
      outputArtifactIdPrefix: 'artifact',
      now: 2000,
    });

    const result = simplifyBorderGeometryArcs({
      extraction,
      tolerance: 1,
      now: 3000,
    });

    const sharedArcs = result.arcs.filter((arc) => arc.classification === 'sharedBorder');
    expect(sharedArcs).toHaveLength(1);
    expect(sharedArcs[0]?.ownerPolygonIds).toEqual(['polygon-a', 'polygon-b']);
    expect(sharedArcs[0]?.coordinates).toEqual([
      [1, 0],
      [1, 1],
    ]);
    expect(sharedArcs[0]?.updatedAt).toBe(3000);

    const sharedArcId = sharedArcs[0]?.arcId;
    expect(sharedArcId).toBeDefined();
    const referencesToSharedArc = result.rings.flatMap((ring) =>
      ring.arcRefs.filter((arcRef) => arcRef.arcId === sharedArcId)
    );
    expect(referencesToSharedArc).toHaveLength(2);
  });

  it('keeps coastline simplification distinct from shared-border adjacency', () => {
    const extraction = extractBorderGeometryArcs({
      dataset,
      featureCollection: jaggedSharedBorder(),
      outputArtifactIdPrefix: 'artifact',
      now: 2000,
    });

    const result = simplifyBorderGeometryArcs({
      extraction,
      tolerance: 1,
      now: 3000,
    });

    const coastlineArcs = result.arcs.filter((arc) => arc.classification === 'coastline');
    expect(coastlineArcs).toHaveLength(3);
    expect(coastlineArcs.every((arc) => arc.ownerPolygonIds.length === 1)).toBe(true);
  });

  it('fails visibly when simplification output breaks endpoint or coordinate count invariants', () => {
    const extraction = extractBorderGeometryArcs({
      dataset,
      featureCollection: jaggedSharedBorder(),
      outputArtifactIdPrefix: 'artifact',
      now: 2000,
    });

    expect(() =>
      simplifyBorderGeometryArcs({
        extraction,
        tolerance: 1,
        now: 3000,
        simplifyCoordinates: () => [[0, 0]],
      })
    ).toThrow('border-geometry-simplified-arc-coordinate-count-invalid');

    expect(() =>
      simplifyBorderGeometryArcs({
        extraction,
        tolerance: 1,
        now: 3000,
        simplifyCoordinates: (arc) => [
          [arc.coordinates[0]?.[0] ?? 0, (arc.coordinates[0]?.[1] ?? 0) + 1],
          arc.coordinates[arc.coordinates.length - 1] ?? [0, 0],
        ],
      })
    ).toThrow('border-geometry-simplified-arc-endpoint-mismatch');
  });

  it('rejects invalid tolerance instead of falling back to unsimplified arcs', () => {
    const extraction = extractBorderGeometryArcs({
      dataset,
      featureCollection: jaggedSharedBorder(),
      outputArtifactIdPrefix: 'artifact',
      now: 2000,
    });

    expect(() =>
      simplifyBorderGeometryArcs({
        extraction,
        tolerance: Number.NaN,
        now: 3000,
      })
    ).toThrow('border-geometry-simplification-tolerance-invalid');
  });

  it('stores simplified records through the default-off storage API when explicitly enabled', async () => {
    const extraction = extractBorderGeometryArcs({
      dataset,
      featureCollection: jaggedSharedBorder(),
      outputArtifactIdPrefix: 'artifact',
      now: 2000,
    });
    const result = simplifyBorderGeometryArcs({
      extraction,
      tolerance: 1,
      now: 3000,
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
});
