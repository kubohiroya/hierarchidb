import { describe, expect, it } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { applyFeatureMetadata } from './applyFeatureMetadata.js';

const fc = (properties?: Record<string, unknown>): FeatureCollection => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties,
    },
  ],
});

const propsOf = (collection: FeatureCollection): Record<string, unknown> => {
  const props = collection.features[0]?.properties;
  if (!props) return {};
  return props as Record<string, unknown>;
};

describe('applyFeatureMetadata', () => {
  it('fills missing properties', () => {
    const collection = fc(undefined);

    applyFeatureMetadata(collection, {
      continent: 'Asia',
      countryName: 'Japan',
      countryCode: 'JP',
      adminCode: '01',
    });

    const props = propsOf(collection);
    expect(props.continent).toBe('Asia');
    expect(props.countryName).toBe('Japan');
    expect(props.countryCode).toBe('JP');
    expect(props.adminCode).toBe('01');
  });

  it('does not override existing string properties', () => {
    const collection = fc({ countryCode: 'US' });

    applyFeatureMetadata(collection, {
      countryCode: 'JP',
    });

    const props = propsOf(collection);
    expect(props.countryCode).toBe('US');
  });

  it('overrides non-string properties', () => {
    const collection = fc({ countryCode: 123 });

    applyFeatureMetadata(collection, {
      countryCode: 'JP',
    });

    const props = propsOf(collection);
    expect(props.countryCode).toBe('JP');
  });

  it('writes originKey to originKeyPropertyName when provided', () => {
    const collection = fc({});

    applyFeatureMetadata(collection, {
      originKey: 'datasource:x:y',
      originKeyPropertyName: '__hdb_origin_key',
    });

    const props = propsOf(collection);
    expect(props.__hdb_origin_key).toBe('datasource:x:y');
  });

  it('does not override existing originKeyPropertyName when already string', () => {
    const collection = fc({ __hdb_origin_key: 'keep-me' });

    applyFeatureMetadata(collection, {
      originKey: 'datasource:x:y',
      originKeyPropertyName: '__hdb_origin_key',
    });

    const props = propsOf(collection);
    expect(props.__hdb_origin_key).toBe('keep-me');
  });

  it('does nothing for originKey when originKeyPropertyName is missing', () => {
    const collection = fc({});

    applyFeatureMetadata(collection, {
      originKey: 'datasource:x:y',
    });

    const props = propsOf(collection);
    expect(props.__hdb_origin_key).toBeUndefined();
  });
});
