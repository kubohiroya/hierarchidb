import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertFeatureCollection } from '../../dist/index.js';

const validFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [139.76, 35.68],
      },
      properties: {
        name: 'Tokyo',
      },
    },
  ],
};

describe('FeatureCollection JSON Schema', () => {
  it('accepts valid FeatureCollection containers', () => {
    assert.doesNotThrow(() => assertFeatureCollection(validFeatureCollection));
  });

  it('rejects non-FeatureCollection containers', () => {
    assert.throws(
      () => assertFeatureCollection({ type: 'Feature', features: [] }),
      /feature-collection-schema-invalid/
    );
  });

  it('rejects invalid coordinate values without coercion', () => {
    const invalid = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: ['139.76', 35.68],
          },
          properties: {},
        },
      ],
    };

    assert.throws(() => assertFeatureCollection(invalid), /feature-collection-schema-invalid/);
    assert.equal(invalid.features[0].geometry.coordinates[0], '139.76');
  });
});
