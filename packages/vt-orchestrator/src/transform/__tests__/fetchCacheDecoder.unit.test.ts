import { describe, expect, it, beforeEach } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { geojson as geojsonApi } from 'flatgeobuf';
import { decodeSourceCacheByFormat } from '../../transform/createTransformByBandHandler/helpers/validation';
import {
  __getTopojsonRuntimeLoadCount,
  __resetTopojsonRuntimeForTests,
} from '../../transform/topojsonRuntimeAdapter';

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => (
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
);

const buildFlatGeobuf = async (collection: FeatureCollection): Promise<ArrayBuffer> => {
  const encoded = await geojsonApi.serialize(collection);
  return toArrayBuffer(encoded);
};

const buildSimpleTopojsonBuffer = (): ArrayBuffer => {
  const topology = {
    type: 'Topology',
    objects: {
      collection: {
        type: 'GeometryCollection',
        geometries: [
          {
            type: 'Point',
            coordinates: [0, 0],
            properties: { id: 'p1' },
          },
        ],
      },
    },
    arcs: [],
    transform: {
      scale: [1, 1],
      translate: [0, 0],
    },
  };
  return new TextEncoder().encode(JSON.stringify(topology)).buffer;
};

describe('decodeSourceCacheByFormat', () => {
  beforeEach(() => {
    __resetTopojsonRuntimeForTests();
  });

  it('does not load topojson runtime for non-topojson format', async () => {
    const collection: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [139.75, 35.68],
          },
          properties: { id: 'tokyo' },
        },
      ],
    };
    const buffer = await buildFlatGeobuf(collection);
    const decoded = await decodeSourceCacheByFormat({
      buffer,
      format: 'flatgeobuf',
      zTarget: 5,
      toleranceK: 0.5,
      quantize: 1_000_000,
    });
    expect(decoded?.features.length).toBe(1);
    expect(__getTopojsonRuntimeLoadCount()).toBe(0);
  });

  it('loads topojson runtime when topojson format is decoded', async () => {
    const buffer = buildSimpleTopojsonBuffer();
    const decoded = await decodeSourceCacheByFormat({
      buffer,
      format: 'topojson',
      zTarget: 5,
      toleranceK: 0,
      quantize: 1_000_000,
      simplifyAlgorithm: 'topojson',
    });
    expect(decoded?.features.length).toBe(1);
    expect(__getTopojsonRuntimeLoadCount()).toBe(1);
  });

  it('supports geojson simplify algorithm for topojson fetch cache', async () => {
    const buffer = buildSimpleTopojsonBuffer();
    const decoded = await decodeSourceCacheByFormat({
      buffer,
      format: 'topojson',
      zTarget: 5,
      toleranceK: 0.5,
      quantize: 1_000_000,
      simplifyAlgorithm: 'geojson',
    });
    expect(decoded?.features.length).toBe(1);
    expect(__getTopojsonRuntimeLoadCount()).toBe(1);
  });
});
