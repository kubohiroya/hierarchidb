import type { NodeId } from '@hierarchidb/core-types';
import type { FeatureCollection, Polygon } from 'geojson';
import { describe, expect, it } from 'vitest';
import type {
  BorderGeometryDatasetRecord,
  BorderGeometryRingRecord,
} from '../BorderGeometryStorageTypes.js';
import type { BorderGeometryExtractionResult } from '../extractBorderGeometryArcs.js';
import { extractBorderGeometryArcs } from '../extractBorderGeometryArcs.js';
import { reconstructBorderGeometryPolygons } from '../reconstructBorderGeometryPolygons.js';
import { simplifyBorderGeometryArcs } from '../simplifyBorderGeometryArcs.js';

const NODE_ID = 'node-border-geometry-reconstruction' as NodeId;

const dataset: BorderGeometryDatasetRecord = {
  datasetId: 'dataset:JP:1:rev-2026-reconstruction',
  nodeId: NODE_ID,
  dataSource: 'fixture',
  countryCode: 'JP',
  adminLevel: 1,
  sourceKey: 'JP:1',
  upstreamRevision: 'rev-2026',
  borderGeometryConfigHash: 'border-config-reconstruction-v1',
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

const createSimplifiedExtraction = (): BorderGeometryExtractionResult => {
  const extraction = extractBorderGeometryArcs({
    dataset,
    featureCollection: adjacentSquares(),
    outputArtifactIdPrefix: 'artifact',
    now: 2000,
  });
  return simplifyBorderGeometryArcs({
    extraction,
    tolerance: 0,
    now: 3000,
  });
};

const replaceRing = (
  extraction: BorderGeometryExtractionResult,
  ringId: string,
  update: (ring: BorderGeometryRingRecord) => BorderGeometryRingRecord
): BorderGeometryExtractionResult => ({
  ...extraction,
  rings: extraction.rings.map((ring) => (ring.ringId === ringId ? update(ring) : ring)),
});

describe('reconstructBorderGeometryPolygons', () => {
  it('reconstructs polygons from coastline and shared arcs with lineage metadata', () => {
    const extraction = createSimplifiedExtraction();
    const result = reconstructBorderGeometryPolygons({
      dataset,
      extraction,
      now: 4000,
    });

    expect(result.polygons.map((polygon) => polygon.polygonId)).toEqual(['polygon-a', 'polygon-b']);
    expect(result.polygons[0]?.geometry).toEqual({
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
    });
    expect(result.polygons[0]?.outputArtifactId).toBe('artifact:polygon-a');
    expect(result.polygons[0]?.createdFromRevision).toBe(dataset.createdFromRevision);
    expect(result.polygons[0]?.reconstructedAt).toBe(4000);
  });

  it('fails visibly when a ring references a missing arc', () => {
    const extraction = createSimplifiedExtraction();
    const broken = replaceRing(extraction, 'polygon-a#outer-0', (ring) => ({
      ...ring,
      arcRefs: [{ arcId: 'missing-arc', direction: 'forward' }],
    }));

    expect(() =>
      reconstructBorderGeometryPolygons({
        dataset,
        extraction: broken,
        now: 4000,
      })
    ).toThrow('border-geometry-ring-arc-ref-missing');
  });

  it('fails visibly when adjacent arc endpoints do not close a ring', () => {
    const extraction = createSimplifiedExtraction();
    const broken = replaceRing(extraction, 'polygon-a#outer-0', (ring) => ({
      ...ring,
      arcRefs: ring.arcRefs.map((arcRef, index) =>
        index === 0 ? { ...arcRef, direction: 'reverse' } : arcRef
      ),
    }));

    expect(() =>
      reconstructBorderGeometryPolygons({
        dataset,
        extraction: broken,
        now: 4000,
      })
    ).toThrow('border-geometry-reconstruction-ring-open');
  });

  it('fails visibly when ring orientation does not match the stored relation', () => {
    const extraction = createSimplifiedExtraction();
    const broken = replaceRing(extraction, 'polygon-a#outer-0', (ring) => ({
      ...ring,
      orientation: ring.orientation === 'clockwise' ? 'counterclockwise' : 'clockwise',
    }));

    expect(() =>
      reconstructBorderGeometryPolygons({
        dataset,
        extraction: broken,
        now: 4000,
      })
    ).toThrow('border-geometry-reconstruction-ring-orientation-mismatch');
  });

  it('fails visibly when an arc owner relation does not include the target polygon', () => {
    const extraction = createSimplifiedExtraction();
    const broken: BorderGeometryExtractionResult = {
      ...extraction,
      arcs: extraction.arcs.map((arc) =>
        arc.ownerPolygonIds.includes('polygon-a')
          ? { ...arc, ownerPolygonIds: ['other-polygon'] }
          : arc
      ),
    };

    expect(() =>
      reconstructBorderGeometryPolygons({
        dataset,
        extraction: broken,
        now: 4000,
      })
    ).toThrow('border-geometry-reconstruction-arc-owner-mismatch');
  });

  it('fails visibly when dataset lineage is stale', () => {
    const extraction = createSimplifiedExtraction();
    const staleDataset: BorderGeometryDatasetRecord = {
      ...dataset,
      createdFromRevision: 'stale-revision',
    };

    expect(() =>
      reconstructBorderGeometryPolygons({
        dataset: staleDataset,
        extraction,
        now: 4000,
      })
    ).toThrow('border-geometry-reconstruction-dataset-lineage-mismatch');
  });
});
