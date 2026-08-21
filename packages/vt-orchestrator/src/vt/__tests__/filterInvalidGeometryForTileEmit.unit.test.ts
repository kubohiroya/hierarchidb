import type { TileEmitInvalidGeometryFilterConfig } from '@hierarchidb/gis-sdk';
import type { Feature, FeatureCollection, Polygon, Position } from 'geojson';
import { describe, expect, it, vi } from 'vitest';
import { buildInvalidGeometryFilterProgressMessage } from '../createInvalidGeometryFilterProgressReporter.js';
import {
  filterInvalidGeometryForTileEmit,
  type TileEmitInvalidGeometryCheck,
} from '../filterInvalidGeometryForTileEmit.js';

const allDisabled: TileEmitInvalidGeometryFilterConfig = {
  area: false,
  lineLength: false,
  maxEdgeLength: false,
  selfIntersection: false,
  triangleRingRatio: false,
};

const polygonFeature = (
  coordinates: Position[][],
  properties: Record<string, unknown> = {}
): Feature<Polygon> => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Polygon', coordinates },
});

const collection = (...features: Feature[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features,
});

const square: Position[][] = [
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0, 0],
  ],
];

const collapsed: Position[][] = [
  [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ],
];

const bowTie: Position[][] = [
  [
    [0, 0],
    [1, 1],
    [0, 1],
    [1, 0],
    [0, 0],
  ],
];

const narrowTriangle: Position[][] = [
  [
    [0, 0],
    [1, 1],
    [2, 2.000001],
    [0, 0],
  ],
];

const enabled = (check: TileEmitInvalidGeometryCheck): TileEmitInvalidGeometryFilterConfig => ({
  ...allDisabled,
  [check]: true,
});

describe('filterInvalidGeometryForTileEmit', () => {
  it.each([
    ['area', collapsed],
    ['lineLength', collapsed],
    ['maxEdgeLength', collapsed],
    ['selfIntersection', bowTie],
    ['triangleRingRatio', narrowTriangle],
  ] as const)('filters a polygon rejected by the %s check', async (check, coordinates) => {
    const result = await filterInvalidGeometryForTileEmit(collection(polygonFeature(coordinates)), {
      config: enabled(check),
      geometryEngine: 'turf',
    });

    expect(result.collection.features).toHaveLength(0);
    expect(result.metrics.invalidPolygonFilteredCount).toBe(1);
    expect(result.metrics.invalidPolygonCheckedCount).toBe(1);
    expect(result.metrics.invalidPolygonFilteredByCheck[check]).toBe(1);
    expect(result.metrics.affectedFeatureCount).toBe(1);
    expect(result.metrics.featureErrorCountTotal).toBe(1);
  });

  it('uses canonical check order when multiple enabled checks reject one polygon', async () => {
    const result = await filterInvalidGeometryForTileEmit(collection(polygonFeature(collapsed)), {
      config: { ...allDisabled, area: true, lineLength: true },
      geometryEngine: 'turf',
    });

    expect(result.metrics.invalidPolygonFilteredByCheck.area).toBe(1);
    expect(result.metrics.invalidPolygonFilteredByCheck.lineLength).toBe(0);
  });

  it('preserves quality-invalid polygons when every quality check is disabled', async () => {
    const result = await filterInvalidGeometryForTileEmit(collection(polygonFeature(bowTie)), {
      config: allDisabled,
      geometryEngine: 'turf',
    });

    expect(result.collection.features).toHaveLength(1);
    expect(result.metrics.invalidPolygonCheckedCount).toBe(0);
    expect(result.metrics.invalidPolygonFilteredCount).toBe(0);
  });

  it('filters MultiPolygon members independently and increments feature errorCount', async () => {
    const source: Feature = {
      type: 'Feature',
      properties: { errorCount: 2 },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [square, collapsed],
      },
    };
    const result = await filterInvalidGeometryForTileEmit(collection(source), {
      config: enabled('area'),
      geometryEngine: 'turf',
    });

    expect(result.collection.features).toHaveLength(1);
    expect(result.collection.features[0]?.geometry?.type).toBe('MultiPolygon');
    if (result.collection.features[0]?.geometry?.type !== 'MultiPolygon') {
      throw new Error('expected a MultiPolygon result');
    }
    expect(result.collection.features[0].geometry.coordinates).toHaveLength(1);
    expect(result.collection.features[0].properties?.errorCount).toBe(3);
    expect(result.metrics.featureErrorCountTotal).toBe(3);
    expect(result.metrics.invalidPolygonFilteredRate).toBe(0.5);
  });

  it('reports enabled checks with polygon progress', async () => {
    const onProgress = vi.fn();
    await filterInvalidGeometryForTileEmit(
      collection(polygonFeature(square), polygonFeature(square)),
      {
        config: { ...allDisabled, area: true, selfIntersection: true },
        geometryEngine: 'turf',
        onProgress,
      }
    );

    expect(onProgress).toHaveBeenCalledWith({ check: 'area', polygonIndex: 1, polygonTotal: 2 });
    expect(onProgress).toHaveBeenCalledWith({
      check: 'selfIntersection',
      polygonIndex: 2,
      polygonTotal: 2,
    });
    expect(
      buildInvalidGeometryFilterProgressMessage({
        check: 'area',
        polygonIndex: 3,
        polygonTotal: 99,
      })
    ).toBe('Check area of polygon 3 of 99');
  });

  it.each([
    ['missing geometry', { type: 'Feature', properties: {}, geometry: null }],
    [
      'non-finite coordinate',
      polygonFeature([
        [
          [0, 0],
          [1, 0],
          [1, Number.NaN],
          [0, 0],
        ],
      ]),
    ],
    [
      'out-of-range longitude',
      polygonFeature([
        [
          [0, 0],
          [181, 0],
          [1, 1],
          [0, 0],
        ],
      ]),
    ],
  ])('fails the task contract for %s', async (_label, feature) => {
    await expect(
      filterInvalidGeometryForTileEmit(collection(feature as Feature), {
        config: allDisabled,
        geometryEngine: 'turf',
      })
    ).rejects.toThrow(/tileEmit/);
  });

  it('rejects missing required config booleans instead of defaulting them', async () => {
    await expect(
      filterInvalidGeometryForTileEmit(collection(polygonFeature(square)), {
        config: { area: false },
        geometryEngine: 'turf',
      })
    ).rejects.toThrow('invalidGeometryFilter.lineLength must be boolean');
  });
});
