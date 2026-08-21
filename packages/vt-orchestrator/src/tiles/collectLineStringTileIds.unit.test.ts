import { describe, expect, it } from 'vitest';
import { collectLineStringTileIds } from './collectLineStringTileIds.js';
import { unpackTileId } from './tileId.js';

describe('collectLineStringTileIds', () => {
  it('returns every base-zoom tile touched by a LineString', () => {
    const zoom = 2;
    const tiles = collectLineStringTileIds(
      [
        [-100, 40],
        [10, 20],
      ],
      zoom
    ).map((tileId) => unpackTileId(tileId, zoom));

    expect(tiles).toEqual([
      { x: 0, y: 1, z: zoom },
      { x: 1, y: 1, z: zoom },
      { x: 2, y: 1, z: zoom },
    ]);
  });

  it('includes both sides when a route lies on a tile boundary', () => {
    const zoom = 1;
    const tiles = collectLineStringTileIds(
      [
        [-10, 0],
        [10, 0],
      ],
      zoom
    ).map((tileId) => unpackTileId(tileId, zoom));

    expect(tiles).toEqual([
      { x: 0, y: 0, z: zoom },
      { x: 0, y: 1, z: zoom },
      { x: 1, y: 0, z: zoom },
      { x: 1, y: 1, z: zoom },
    ]);
  });

  it('rejects coordinates outside the Web Mercator contract', () => {
    expect(() =>
      collectLineStringTileIds(
        [
          [0, 0],
          [1, 90],
        ],
        4
      )
    ).toThrow('must be within Web Mercator latitude range');
  });

  it('wraps the longitude seam while keeping the latitude edge single-sided', () => {
    const maximumLatitude = 85.05112877980659;
    const southEdgeTiles = collectLineStringTileIds(
      [
        [-10, -maximumLatitude],
        [10, -maximumLatitude],
      ],
      1
    ).map((tileId) => unpackTileId(tileId, 1));
    expect(southEdgeTiles).toEqual([
      { x: 0, y: 1, z: 1 },
      { x: 1, y: 1, z: 1 },
    ]);

    const eastEdgeTiles = collectLineStringTileIds(
      [
        [170, 10],
        [180, 10],
      ],
      1
    ).map((tileId) => unpackTileId(tileId, 1));
    expect(eastEdgeTiles).toEqual([
      { x: 0, y: 0, z: 1 },
      { x: 1, y: 0, z: 1 },
    ]);
  });

  it('indexes an antimeridian crossing without traversing the world interior', () => {
    const tiles = collectLineStringTileIds(
      [
        [170, 10],
        [-170, 10],
      ],
      2
    ).map((tileId) => unpackTileId(tileId, 2));

    expect(tiles).toEqual([
      { x: 0, y: 1, z: 2 },
      { x: 3, y: 1, z: 2 },
    ]);
  });
});
