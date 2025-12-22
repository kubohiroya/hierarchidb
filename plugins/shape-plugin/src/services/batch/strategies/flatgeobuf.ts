import { geojson as geojsonApi } from 'flatgeobuf';
import type { Feature, FeatureCollection } from 'geojson';

const isAsyncIterable = (value: unknown): value is AsyncIterable<Feature> =>
  !!value && typeof (value as AsyncIterable<Feature>)[Symbol.asyncIterator] === 'function';

const isFeatureCollection = (value: unknown): value is FeatureCollection =>
  !!value
  && typeof value === 'object'
  && (value as FeatureCollection).type === 'FeatureCollection'
  && Array.isArray((value as FeatureCollection).features);

export const decodeFlatGeoJson = async (buffer: ArrayBuffer): Promise<FeatureCollection> => {
  const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
  if (isAsyncIterable(decoded)) {
    const features: Feature[] = [];
    for await (const feature of decoded) {
      features.push(feature);
    }
    return { type: 'FeatureCollection', features };
  }
  if (isFeatureCollection(decoded)) {
    return decoded;
  }
  return { type: 'FeatureCollection', features: [] };
};

export const encodeFlatGeoJson = async (collection: FeatureCollection): Promise<ArrayBuffer> => {
  const bytes = await geojsonApi.serialize(collection);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};
