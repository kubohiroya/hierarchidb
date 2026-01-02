import { geojson as geojsonApi } from 'flatgeobuf';
import type { Feature, FeatureCollection } from 'geojson';

export const isFeatureCollection = (candidate: unknown): candidate is FeatureCollection => {
  return Boolean(
    candidate
    && typeof candidate === 'object'
    && (candidate as FeatureCollection).type === 'FeatureCollection'
    && Array.isArray((candidate as FeatureCollection).features),
  );
};

export async function decodeFeatureCollection(buffer: ArrayBuffer): Promise<FeatureCollection | null> {
  const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
  if (decoded && typeof (decoded as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    const features: Feature[] = [];
    for await (const feature of decoded as AsyncIterable<Feature>) {
      if (feature) features.push(feature);
    }
    return { type: 'FeatureCollection', features };
  }
  if (isFeatureCollection(decoded)) {
    return decoded;
  }
  return null;
}

export async function encodeFeatureCollection(collection: FeatureCollection): Promise<ArrayBuffer> {
  const bytes = await geojsonApi.serialize(collection);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

