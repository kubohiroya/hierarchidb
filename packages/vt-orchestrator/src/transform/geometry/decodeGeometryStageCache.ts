import { geojson as geojsonApi } from 'flatgeobuf';
import type { FeatureCollection } from 'geojson';

const normalizeFeatureCollection = async (decoded: unknown): Promise<FeatureCollection | null> => {
  if (!decoded || typeof decoded !== 'object') return null;
  const collection = decoded as FeatureCollection;
  if (collection.type === 'FeatureCollection') {
    const features = Array.isArray(collection.features) ? collection.features : [];
    return { ...collection, features };
  }
  if (typeof (decoded as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    const features: FeatureCollection['features'] = [];
    const iterator = (decoded as AsyncIterable<FeatureCollection['features'][number]>)[
      Symbol.asyncIterator
    ]();
    while (true) {
      const next = await iterator.next();
      if (next.done) break;
      features.push(next.value);
    }
    return { type: 'FeatureCollection', features };
  }
  return null;
};

export const decodeGeometryStageCache = async (
  buffer: ArrayBuffer
): Promise<FeatureCollection | null> => {
  const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
  return normalizeFeatureCollection(decoded);
};

export const loadGeojsonVt = async (): Promise<unknown> => {
  const mod = await import('geojson-vt');
  const candidate = mod as { default?: typeof import('geojson-vt') } & typeof import('geojson-vt');
  return candidate.default ?? candidate;
};
