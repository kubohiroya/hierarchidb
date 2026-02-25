import { describe, expect, it } from 'vitest';
import type { Tile } from 'geojson-vt';
import { buildBoundaryDiagnostics } from '../createTransformByBandHandler/helpers/collection';
import { collectLayerForTile } from '../../vt/vtStageTaskLayerBuilderLayerHelpers';

const squarePolygon = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
};

describe('shape boundary helper behavior', () => {
  it('counts only canonical boundary layers in diagnostics', () => {
    const diagnostics = buildBoundaryDiagnostics({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { layer: '0' }, geometry: squarePolygon },
        { type: 'Feature', properties: { layer: '0-b' }, geometry: squarePolygon },
        { type: 'Feature', properties: { layer: '1-boundary' }, geometry: squarePolygon },
      ],
    });
    expect(diagnostics).not.toBeNull();
    expect(diagnostics?.layers).toMatchObject({
      '0-b': {
        featureCount: 1,
      },
    });
    expect(diagnostics?.totalFeatures).toBe(1);
  });
});

describe('collectLayerForTile boundary detection', () => {
  const buildTile = (linePairs: number[][][]): Tile => ({
    features: [
      {
        type: 2,
        geometry: linePairs,
        tags: {},
      },
    ] as unknown as Tile['features'],
  } as Tile);

  const buildIndex = (tile: Tile | null) => ({
    getTile: (_z: number, _x: number, _y: number) => tile,
  });

  it('dedupes only canonical boundary layers when boundary dedupe is enabled', () => {
    const tile = buildTile([
      [
        [0, 0],
        [1, 1],
      ],
      [
        [1, 1],
        [0, 0],
      ],
    ]);
    const collected = collectLayerForTile(
      buildIndex(tile) as { getTile: () => Tile | null; },
      '1-b',
      0,
      0,
      0,
      true,
    );
    const geometry = collected?.features?.[0];
    expect(collected).not.toBeNull();
    expect(geometry).toBeDefined();
    expect((geometry?.geometry as number[][][]).length).toBe(1);
  });

  it('does not dedupe non-boundary layer names for boundary dedupe path', () => {
    const tile = buildTile([
      [
        [0, 0],
        [1, 1],
      ],
      [
        [1, 1],
        [0, 0],
      ],
    ]);
    const collected = collectLayerForTile(
      buildIndex(tile) as { getTile: () => Tile | null; },
      '1',
      0,
      0,
      0,
      true,
    );
    const geometry = collected?.features?.[0];
    expect(collected).not.toBeNull();
    expect(geometry).toBeDefined();
    expect((geometry?.geometry as number[][][]).length).toBe(2);
  });
});
