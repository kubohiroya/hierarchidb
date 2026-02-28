import { describe, expect, it } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { vtStageTestUtils } from '../vtStageTestUtils.js';

describe('vtStage summary helpers', () => {
  it('builds admin feature summary from feature levels', () => {
    const collection: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: null, properties: { level: 0, layer: '0' } },
        { type: 'Feature', geometry: null, properties: { layer: '1' } },
        { type: 'Feature', geometry: null, properties: { layer: '1-b' } },
      ],
    };

    expect(vtStageTestUtils.buildAdminFeatureSummary(collection)).toBe('features: ADM0:1 / ADM1:1');
  });

  it('builds tile summary in zoom order', () => {
    const tilesByZoom = new Map<number, { total: number; generated: number }>([
      [1, { total: 4, generated: 2 }],
      [0, { total: 1, generated: 1 }],
    ]);

    expect(vtStageTestUtils.buildTileSummary(tilesByZoom)).toBe('tiles -> 1/1, 2/4');
  });

  it('builds skipped message with reason', () => {
    const summary = vtStageTestUtils.buildSkippedMessage(
      'features: ADM0:1',
      'tiles -> 0/1',
      'no layers',
    );

    expect(summary).toBe('features: ADM0:1, tiles -> 0/1 (skipped: no layers)');
  });

  it('builds parent input summary from intersecting features and geojson bytes', () => {
    const summary = vtStageTestUtils.buildVtParentInputSummary({
      featureStats: [
        {
          bbox: { minX: 0, minY: 0, maxX: 5, maxY: 5 },
          vertexCount: 12,
          polygonCount: 1,
          lineStringCount: 0,
          bufferId: 'buffer-a',
          geojsonByteSize: 123,
          countryCode: 'JP',
          featureAreaSqMeters: 300,
        },
        {
          bbox: { minX: 20, minY: 20, maxX: 25, maxY: 25 },
          vertexCount: 8,
          polygonCount: 1,
          lineStringCount: 0,
          bufferId: 'buffer-b',
          geojsonByteSize: 999,
          countryCode: 'US',
          featureAreaSqMeters: 1000,
        },
        {
          bbox: { minX: 4, minY: 4, maxX: 10, maxY: 10 },
          vertexCount: 20,
          polygonCount: 2,
          lineStringCount: 0,
          bufferId: 'buffer-c',
          geojsonByteSize: 77,
          countryCode: 'US',
          featureAreaSqMeters: 200,
        },
        {
          bbox: { minX: 3, minY: 3, maxX: 8, maxY: 8 },
          vertexCount: 10,
          polygonCount: 1,
          lineStringCount: 0,
          bufferId: 'buffer-d',
          geojsonByteSize: 22,
          countryCode: 'CA',
          featureAreaSqMeters: 700,
        },
      ],
      parentBBox: { minX: -1, minY: -1, maxX: 10, maxY: 10 },
      parentTile: { z: 6, x: 15, y: 23 },
    });

    expect(summary.parentTile).toEqual({ z: 6, x: 15, y: 23 });
    expect(summary.intersectingFeatureCount).toBe(3);
    expect(summary.intersectingGeojsonByteSize).toBe(222);
    expect(summary.topCountriesByIntersectingArea).toEqual([
      { countryCode: 'CA', intersectingAreaSqMeters: 700 },
      { countryCode: 'JP', intersectingAreaSqMeters: 300 },
    ]);
  });

  it('normalizes debug focus config and matches tile/feature filters', () => {
    const config = vtStageTestUtils.resolveVtDebugFocusConfig({
      enabled: true,
      tiles: ['3/0/2', 'invalid', '3/0/2'],
      features: ['feat-a', '', 'feat-a', 'feat-b'],
    });
    const match = vtStageTestUtils.resolveVtDebugFocusMatch(
      config,
      vtStageTestUtils.buildTileKey(3, 0, 2),
      ['feat-z', 'feat-b'],
    );

    expect(match.shouldLog).toBe(true);
    expect(match.tileMatched).toBe(true);
    expect(match.featureMatched).toBe(true);
    expect(match.matchedFeatureIds).toEqual(['feat-b']);
  });

  it('builds empty-tile summary reason with empty tile count', () => {
    const detail = {
      z: 6,
      x: 58,
      y: 20,
      layerName: '0',
      clippedFeatureCount: 1,
      featureCount: 3,
    };
    const reason = vtStageTestUtils.buildGeojsonVtEmptyTileSummaryReason(4, detail);
    expect(reason).toContain('geojson-vt produced empty tile for clipped features');
    expect(reason).toContain('tile=6/58/20');
    expect(reason).toContain('emptyTileCount=4');
  });

  it('computes output tile totals for polygons and vertices', () => {
    const tiles = [
      {
        features: [
          {
            type: 3,
            geometry: [
              [
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
                [0, 0],
              ],
            ],
          },
          {
            type: 2,
            geometry: [
              [
                [0, 0],
                [5, 5],
              ],
            ],
          },
        ],
      },
      {
        features: [
          {
            type: 3,
            geometry: [
              [
                [1, 1],
                [2, 1],
                [2, 2],
                [1, 2],
                [1, 1],
              ],
            ],
          },
        ],
      },
    ];

    const totals = vtStageTestUtils.computeOutputTileTotals(tiles as Parameters<
      typeof vtStageTestUtils.computeOutputTileTotals
    >[0]);

    expect(totals.polygonCount).toBeGreaterThan(0);
    expect(totals.vertexCount).toBeGreaterThan(0);
  });
});
