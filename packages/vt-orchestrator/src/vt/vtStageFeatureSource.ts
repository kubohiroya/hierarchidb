import { geojson as geojsonApi } from 'flatgeobuf';
import type { FeatureCollection } from 'geojson';

export const decodeTransformByBandCache = async (buffer: ArrayBuffer): Promise<FeatureCollection | null> => {
  const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
  return normalizeFeatureCollection(decoded as unknown);
};

export const normalizeFeatureCollection = async (decoded: unknown): Promise<FeatureCollection | null> => {
  if (!decoded || typeof decoded !== 'object') return null;
  const collection = decoded as FeatureCollection;
  if (collection.type === 'FeatureCollection') {
    const features = Array.isArray(collection.features) ? collection.features : [];
    return { ...collection, features };
  }
  if (typeof (decoded as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    const features: FeatureCollection['features'] = [];
    const iterator = (decoded as AsyncIterable<FeatureCollection['features'][number]>)[Symbol.asyncIterator]();
    const testIterTimeoutMs = (globalThis as { __HDB_VT_ASYNC_ITER_TIMEOUT_MS?: number }).__HDB_VT_ASYNC_ITER_TIMEOUT_MS;
    while (true) {
      const next = typeof testIterTimeoutMs === 'number' && testIterTimeoutMs > 0
        ? await new Promise<IteratorResult<FeatureCollection['features'][number]>>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`[vt] async iterator timeout after ${testIterTimeoutMs}ms`));
          }, testIterTimeoutMs);
          iterator.next()
            .then((value) => resolve(value))
            .catch((error) => reject(error))
            .finally(() => clearTimeout(timeoutId));
        })
        : await iterator.next();
      if (next.done) break;
      features.push(next.value);
    }
    return { type: 'FeatureCollection', features };
  }
  return null;
};

export const describeBuffer = (buffer: ArrayBuffer): {
  byteLength: number;
  headHex: string;
  headAscii: string;
  isJsonLike: boolean;
} => {
  const bytes = new Uint8Array(buffer);
  const head = bytes.slice(0, 16);
  const headHex = Array.from(head).map((value) => value.toString(16).padStart(2, '0')).join('');
  const headAscii = Array.from(head).map((value) => (
    value >= 0x20 && value <= 0x7e ? String.fromCharCode(value) : '.'
  )).join('');
  let firstNonWhitespace: number | null = null;
  for (let i = 0; i < bytes.length; i += 1) {
    const value = bytes[i];
    if (value === undefined) continue;
    if (value === 0x20 || value === 0x0a || value === 0x0d || value === 0x09) continue;
    firstNonWhitespace = value;
    break;
  }
  const isJsonLike = firstNonWhitespace === 0x7b || firstNonWhitespace === 0x5b;
  return {
    byteLength: bytes.byteLength,
    headHex,
    headAscii,
    isJsonLike,
  };
};

export const loadGeojsonVt = async () => {
  const mod = await import('geojson-vt');
  const candidate = mod as unknown as { default?: typeof import('geojson-vt') } & typeof import('geojson-vt');
  return candidate.default ?? candidate;
};

export const loadVtPbf = async () => {
  const mod = await import('@maplibre/vt-pbf');
  const candidate = mod as unknown as { default?: typeof import('@maplibre/vt-pbf') } & typeof import('@maplibre/vt-pbf');
  return candidate.default ?? candidate;
};
