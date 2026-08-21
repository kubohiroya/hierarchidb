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

  it.each([2, 22])(
    'includes both sides of a non-equatorial projected tile boundary at zoom %i',
    (zoom) => {
      const scale = 2 ** zoom;
      const boundaryY = 1;
      const boundaryX = scale / 2;
      const boundaryLatitude =
        (Math.atan(Math.sinh(Math.PI * (1 - (2 * boundaryY) / scale))) * 180) / Math.PI;
      const startLongitude = ((boundaryX - 0.25) / scale) * 360 - 180;
      const endLongitude = ((boundaryX + 0.25) / scale) * 360 - 180;
      const tiles = collectLineStringTileIds(
        [
          [startLongitude, boundaryLatitude],
          [endLongitude, boundaryLatitude],
        ],
        zoom
      ).map((tileId) => unpackTileId(tileId, zoom));

      expect(tiles).toEqual([
        { x: boundaryX - 1, y: 0, z: zoom },
        { x: boundaryX - 1, y: 1, z: zoom },
        { x: boundaryX, y: 0, z: zoom },
        { x: boundaryX, y: 1, z: zoom },
      ]);
    }
  );

  it('does not snap a valid projected coordinate onto a nearby boundary', () => {
    const zoom = 22;
    const scale = 2 ** zoom;
    const projectedY = 1 + 0.000001;
    const boundaryX = scale / 2;
    const latitude =
      (Math.atan(Math.sinh(Math.PI * (1 - (2 * projectedY) / scale))) * 180) / Math.PI;
    const startLongitude = ((boundaryX - 0.25) / scale) * 360 - 180;
    const endLongitude = ((boundaryX + 0.25) / scale) * 360 - 180;
    const tiles = collectLineStringTileIds(
      [
        [startLongitude, latitude],
        [endLongitude, latitude],
      ],
      zoom
    ).map((tileId) => unpackTileId(tileId, zoom));

    expect(tiles).toEqual([
      { x: boundaryX - 1, y: 1, z: zoom },
      { x: boundaryX, y: 1, z: zoom },
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

  it('includes every tile touching a projected tile corner despite projection roundoff', () => {
    const zoom = 2;
    const scale = 2 ** zoom;
    const toLongitudeLatitude = (x: number, y: number): [number, number] => [
      (x / scale) * 360 - 180,
      (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale))) * 180) / Math.PI,
    ];
    const tiles = collectLineStringTileIds(
      [toLongitudeLatitude(0.5, 0.5), toLongitudeLatitude(2.5, 2.5)],
      zoom
    ).map((tileId) => unpackTileId(tileId, zoom));

    expect(tiles).toEqual([
      { x: 0, y: 0, z: zoom },
      { x: 0, y: 1, z: zoom },
      { x: 1, y: 0, z: zoom },
      { x: 1, y: 1, z: zoom },
      { x: 1, y: 2, z: zoom },
      { x: 2, y: 1, z: zoom },
      { x: 2, y: 2, z: zoom },
    ]);
  });

  it('does not snap a line passing near a projected tile corner onto the corner', () => {
    const zoom = 2;
    const scale = 2 ** zoom;
    const projectedOffset = 0.000001;
    const toLongitudeLatitude = (x: number, y: number): [number, number] => [
      (x / scale) * 360 - 180,
      (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale))) * 180) / Math.PI,
    ];
    const tiles = collectLineStringTileIds(
      [
        toLongitudeLatitude(0.5, 0.5 + projectedOffset),
        toLongitudeLatitude(2.5, 2.5 + projectedOffset),
      ],
      zoom
    ).map((tileId) => unpackTileId(tileId, zoom));

    expect(tiles).toEqual([
      { x: 0, y: 0, z: zoom },
      { x: 0, y: 1, z: zoom },
      { x: 1, y: 1, z: zoom },
      { x: 1, y: 2, z: zoom },
      { x: 2, y: 2, z: zoom },
    ]);
  });
});
