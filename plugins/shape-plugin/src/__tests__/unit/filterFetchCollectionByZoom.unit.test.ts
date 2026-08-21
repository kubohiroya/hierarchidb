import type { FeatureCollection } from 'geojson';
import { describe, expect, it } from 'vitest';
import { filterFetchCollectionByZoom } from '../../services/vt/filterFetchCollectionByZoom';

const options = {
  zTarget: 8,
  omitDetailsConfig: { level: 'weak' as const },
  excludePolygonAreaCoefficient: 0,
  minRingVertices: 4,
  geometryEngine: 'turf' as const,
};

const polygonCollection = (position: unknown): FeatureCollection =>
  ({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[[0, 0], position, [1, 1], [0, 0]]],
        },
      },
    ],
  }) as FeatureCollection;

describe('filterFetchCollectionByZoom source geometry contract', () => {
  it.each([
    { position: [], message: 'must contain longitude and latitude' },
    { position: [Number.NaN, 1], message: 'must be a finite number' },
    { position: [181, 1], message: 'longitude must be within -180..180' },
    { position: [1, -91], message: 'latitude must be within -90..90' },
  ])('rejects an invalid position without defaulting or clamping it', ({ position, message }) => {
    expect(() => filterFetchCollectionByZoom(polygonCollection(position), options)).toThrow(
      message
    );
  });

  it('rejects a missing geometry instead of silently dropping the feature', () => {
    const collection = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: null }],
    } as FeatureCollection;

    expect(() => filterFetchCollectionByZoom(collection, options)).toThrow(
      'feature[0].geometry is required'
    );
  });

  it('rejects an open polygon ring instead of treating it as a quality drop', () => {
    const collection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
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
    } as FeatureCollection;

    expect(() => filterFetchCollectionByZoom(collection, options)).toThrow('must be closed');
  });
});
