import { describe, expect, it } from 'vitest';
import {
  assertGadmGeoJsonSourcePayload,
  assertGenericGeoJsonSourcePayload,
  assertGeoBoundariesGeoJsonSourcePayload,
  assertNaturalEarthGeoJsonSourcePayload,
} from '../../services/datasources/providerGeoJsonSourcePayloadSchemas.js';

const polygonGeometry = {
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
};

const createFeatureCollection = (properties: Record<string, unknown>) => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: polygonGeometry,
      properties,
    },
  ],
});

describe('provider GeoJSON source payload schemas', () => {
  it('accepts generic FeatureCollection containers without provider properties', () => {
    expect(() => {
      assertGenericGeoJsonSourcePayload(createFeatureCollection({}));
    }).not.toThrow();
  });

  it('keeps generic validation at container level', () => {
    expect(() => {
      assertGenericGeoJsonSourcePayload({
        type: 'FeatureCollection',
        features: [{ type: 'Feature' }],
      });
    }).not.toThrow();
  });

  it('rejects generic payloads that are not FeatureCollections', () => {
    expect(() => {
      assertGenericGeoJsonSourcePayload({ type: 'Feature', features: [] });
    }).toThrow('generic-geojson-source-payload-invalid');
  });

  it('accepts Natural Earth payloads with stable identity properties', () => {
    expect(() => {
      assertNaturalEarthGeoJsonSourcePayload(
        createFeatureCollection({
          ISO_A3: 'JPN',
          NAME: 'Japan',
        })
      );
    }).not.toThrow();
  });

  it('rejects Natural Earth payloads without identity properties', () => {
    expect(() => {
      assertNaturalEarthGeoJsonSourcePayload(createFeatureCollection({ POP_EST: 125000000 }));
    }).toThrow('natural-earth-geojson-source-payload-invalid');
  });

  it('accepts GADM payloads with level-specific administrative keys', () => {
    expect(() => {
      assertGadmGeoJsonSourcePayload(
        createFeatureCollection({
          GID_0: 'JPN',
          NAME_0: 'Japan',
          GID_1: 'JPN.1_1',
          NAME_1: 'Hokkaido',
        }),
        1
      );
    }).not.toThrow();
  });

  it('rejects GADM payloads missing the requested level properties', () => {
    expect(() => {
      assertGadmGeoJsonSourcePayload(
        createFeatureCollection({
          GID_0: 'JPN',
          NAME_0: 'Japan',
        }),
        1
      );
    }).toThrow('gadm-geojson-source-payload-invalid');
  });

  it('rejects unsupported GADM levels instead of clamping', () => {
    expect(() => {
      assertGadmGeoJsonSourcePayload(
        createFeatureCollection({
          GID_0: 'JPN',
          NAME_0: 'Japan',
        }),
        6
      );
    }).toThrow('gadm-geojson-source-payload-invalid-level: 6');
  });

  it('accepts GeoBoundaries payloads with shapeName', () => {
    expect(() => {
      assertGeoBoundariesGeoJsonSourcePayload(
        createFeatureCollection({
          shapeName: 'Japan',
          shapeISO: 'JPN',
        })
      );
    }).not.toThrow();
  });

  it('rejects GeoBoundaries payloads without shapeName', () => {
    expect(() => {
      assertGeoBoundariesGeoJsonSourcePayload(createFeatureCollection({ shapeISO: 'JPN' }));
    }).toThrow('geoboundaries-geojson-source-payload-invalid');
  });
});
