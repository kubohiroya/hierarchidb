import type { Feature, Polygon } from 'geojson';
import { describe, expect, it, vi } from 'vitest';
import type { VTStageContext } from '../../contextTypes.js';
import { buildTileLayerIndexFromFeatures } from '../buildTileLayerIndexFromFeatures.js';

const validFeature: Feature<Polygon> = {
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

const buildContext = (): VTStageContext =>
  ({
    geometryEngine: 'turf',
    tileEmitConfig: {
      indexMaxPoints: 100_000,
      buffer: 0,
      extent: 4_096,
      tolerance: 0,
      promoteId: 'id',
      invalidGeometryFilter: {
        area: false,
        lineLength: false,
        maxEdgeLength: false,
        selfIntersection: false,
        triangleRingRatio: false,
      },
    },
  }) as unknown as VTStageContext;

describe('buildTileLayerIndexFromFeatures', () => {
  it('validates the final collection immediately before geojson-vt', async () => {
    const geojsonVt = vi.fn(() => ({ getTile: () => null }));

    await buildTileLayerIndexFromFeatures({
      layerName: 'shape',
      features: [validFeature],
      z: 0,
      x: 0,
      y: 0,
      bandMaxZoom: 0,
      context: buildContext(),
      geojsonVt,
    });

    expect(geojsonVt).toHaveBeenCalledOnce();
    expect(geojsonVt.mock.calls[0]?.[0]).toEqual({
      type: 'FeatureCollection',
      features: [validFeature],
    });
  });

  it('rejects malformed final geometry before geojson-vt', async () => {
    const geojsonVt = vi.fn(() => ({ getTile: () => null }));
    const openRing: Feature<Polygon> = {
      ...validFeature,
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
    };

    await expect(
      buildTileLayerIndexFromFeatures({
        layerName: 'shape',
        features: [openRing],
        z: 0,
        x: 0,
        y: 0,
        bandMaxZoom: 0,
        context: buildContext(),
        geojsonVt,
      })
    ).rejects.toThrow('must be closed');
    expect(geojsonVt).not.toHaveBeenCalled();
  });

  it('rejects tile-local TopoJSON simplification at the canonical boundary', async () => {
    const geojsonVt = vi.fn(() => ({ getTile: () => null }));

    await expect(
      buildTileLayerIndexFromFeatures({
        layerName: 'shape',
        features: [validFeature],
        z: 0,
        x: 0,
        y: 0,
        bandMaxZoom: 0,
        context: buildContext(),
        geojsonVt,
        topojsonSimplify: {
          enabled: true,
          toleranceK: 0.1,
          retryToleranceStep: 0.02,
        },
      })
    ).rejects.toThrow('tile-local TopoJSON simplification is not supported');
    expect(geojsonVt).not.toHaveBeenCalled();
  });
});
