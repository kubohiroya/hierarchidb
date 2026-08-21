import type { Feature, Polygon } from 'geojson';
import { describe, expect, it } from 'vitest';
import type { VTStageContext } from '../../contextTypes.js';
import {
  applyTileEmitInvalidGeometryFilter,
  buildTileEmitInvalidGeometryFilterTaskMetadata,
} from '../applyTileEmitInvalidGeometryFilter.js';
import type { CollectedVtFeatures } from '../vtStageTaskTypes.js';

const validPolygon: Feature<Polygon> = {
  type: 'Feature',
  id: 'valid',
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
};

const filteredPolygon: Feature<Polygon> = {
  type: 'Feature',
  id: 'filtered',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [2, 2],
        [2, 2],
        [2, 2],
        [2, 2],
      ],
    ],
  },
};

const buildContext = (): VTStageContext =>
  ({
    tileEmitConfig: {
      invalidGeometryFilter: {
        area: true,
        lineLength: false,
        maxEdgeLength: false,
        selfIntersection: false,
        triangleRingRatio: false,
      },
    },
    geometryEngine: 'turf',
  }) as unknown as VTStageContext;

describe('applyTileEmitInvalidGeometryFilter', () => {
  it('rebuilds feature stats and continent groups from the filtered collection', async () => {
    const collected: CollectedVtFeatures = {
      collection: {
        type: 'FeatureCollection',
        features: [validPolygon, filteredPolygon],
      },
      featureStats: [],
      bufferSizes: new Map([
        ['buffer-a', 100],
        ['buffer-b', 200],
      ]),
      featuresByContinent: new Map([
        ['Europe', [validPolygon]],
        ['Asia', [filteredPolygon]],
      ]),
      featureSources: new Map([
        [
          validPolygon,
          {
            bufferId: 'buffer-a',
            countryCode: 'FR',
            geojsonByteSize: 50,
            continentKey: 'Europe',
          },
        ],
        [
          filteredPolygon,
          {
            bufferId: 'buffer-b',
            countryCode: 'JP',
            geojsonByteSize: 75,
            continentKey: 'Asia',
          },
        ],
      ]),
    };

    const result = await applyTileEmitInvalidGeometryFilter(collected, buildContext());

    expect(result.collected.collection.features.map((feature) => feature.id)).toEqual(['valid']);
    expect(result.collected.featureStats).toMatchObject([
      {
        bufferId: 'buffer-a',
        featureId: 'valid',
        countryCode: 'FR',
        geojsonByteSize: 50,
        polygonCount: 1,
      },
    ]);
    expect(Array.from(result.collected.featuresByContinent?.keys() ?? [])).toEqual(['Europe']);
    expect(
      result.collected.featuresByContinent?.get('Europe')?.map((feature) => feature.id)
    ).toEqual(['valid']);
    expect(result.metrics.invalidPolygonFilteredCount).toBe(1);
  });

  it('adds warning severity only when quality filtering removed a polygon', () => {
    const baseMetrics = {
      invalidPolygonFilteredCount: 0,
      invalidPolygonCheckedCount: 2,
      invalidPolygonFilteredRate: 0,
      affectedFeatureCount: 0,
      featureErrorCountTotal: 0,
      invalidPolygonFilteredByCheck: {
        area: 0,
        lineLength: 0,
        maxEdgeLength: 0,
        selfIntersection: 0,
        triangleRingRatio: 0,
      },
    };

    expect(buildTileEmitInvalidGeometryFilterTaskMetadata({ parent: true }, baseMetrics)).toEqual({
      parent: true,
      ...baseMetrics,
    });
    expect(
      buildTileEmitInvalidGeometryFilterTaskMetadata(
        { parent: true },
        {
          ...baseMetrics,
          invalidPolygonFilteredCount: 1,
          invalidPolygonFilteredRate: 0.5,
          affectedFeatureCount: 1,
          featureErrorCountTotal: 1,
          invalidPolygonFilteredByCheck: { ...baseMetrics.invalidPolygonFilteredByCheck, area: 1 },
        }
      )
    ).toMatchObject({
      resultSeverity: 'warning',
      invalidPolygonFilteredCount: 1,
      invalidPolygonFilteredByCheck: { area: 1 },
    });
  });
});
