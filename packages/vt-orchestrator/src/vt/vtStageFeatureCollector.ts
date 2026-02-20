import type { Feature, FeatureCollection } from 'geojson';
import type { EphemeralTransformCacheRecord } from '@hierarchidb/gis-sdk';
import { geojson as geojsonApi } from 'flatgeobuf';
import type { VTStageContext } from '~/contexts';
import type {
  InputFeatureStats,
} from './vtStageGeometry.js';
import {
  countLineStringsFromGeometry,
  countPolygonsFromGeometry,
  countVerticesFromGeometry,
  featureBBox,
  normalizeGeojsonByteSize,
  resolveFeatureId,
} from './vtStageGeometry.js';

export const normalizeFeatureCollection = async (decoded: unknown): Promise<FeatureCollection | null> => {
  if (!decoded || typeof decoded !== 'object') return null;
  const collection = decoded as FeatureCollection;
  if (collection.type === 'FeatureCollection') {
    const features = Array.isArray(collection.features) ? collection.features : [];
    return { ...collection, features };
  }
  if (typeof (decoded as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    const features: Feature[] = [];
    const iterator = (decoded as AsyncIterable<Feature>)[Symbol.asyncIterator]();
    const testIterTimeoutMs = (globalThis as { __HDB_VT_ASYNC_ITER_TIMEOUT_MS?: number }).__HDB_VT_ASYNC_ITER_TIMEOUT_MS;
    while (true) {
      const next = typeof testIterTimeoutMs === 'number' && testIterTimeoutMs > 0
        ? await new Promise<IteratorResult<Feature>>((resolve, reject) => {
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

export const decodeTransformByBandCache = async (buffer: ArrayBuffer): Promise<FeatureCollection | null> => {
  const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
  return normalizeFeatureCollection(decoded as unknown);
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

export const collectFeatures = async (
  context: VTStageContext,
  bufferIds: string[],
  nodeId: string,
  options?: { groupByContinent?: boolean; continentByCountry?: Map<string, string> },
): Promise<{
  collection: FeatureCollection;
  featureStats: InputFeatureStats[];
  bufferSizes: Map<string, number>;
  featuresByContinent?: Map<string, Feature[]>;
} | null> => {
  const allFeatures: Feature[] = [];
  const featureStats: InputFeatureStats[] = [];
  const bufferSizes = new Map<string, number>();
  const featuresByContinent = options?.groupByContinent ? new Map<string, Feature[]>() : undefined;
  const debugCollect = (globalThis as { __HDB_VT_DEBUG_COLLECT?: boolean }).__HDB_VT_DEBUG_COLLECT === true;
  if (debugCollect) {
    const testTimeoutMs = (globalThis as { __HDB_VT_COLLECT_TIMEOUT_MS?: number }).__HDB_VT_COLLECT_TIMEOUT_MS;
    console.info('[vt][debug] collect buffers', JSON.stringify({
      nodeId,
      bufferCount: bufferIds.length,
      testTimeoutMs: typeof testTimeoutMs === 'number' ? testTimeoutMs : null,
    }));
  }
  if (debugCollect) {
    const countStartedAt = Date.now();
    console.info('[vt][debug] collect count start', JSON.stringify({ nodeId }));
    const count = await context.ephemeralDB.transformCache.count();
    console.info('[vt][debug] collect count done', JSON.stringify({
      nodeId,
      count,
      durationMs: Date.now() - countStartedAt,
    }));
    console.info('[vt][debug] collect fetch start', JSON.stringify({
      nodeId,
      useBulkGet: (globalThis as { __HDB_VT_COLLECT_BULKGET?: boolean }).__HDB_VT_COLLECT_BULKGET === true,
      bufferCount: bufferIds.length,
    }));
  }
  const useBulkGet = (globalThis as { __HDB_VT_COLLECT_BULKGET?: boolean }).__HDB_VT_COLLECT_BULKGET === true;
  const useGetEach = (globalThis as { __HDB_VT_COLLECT_GET_EACH?: boolean }).__HDB_VT_COLLECT_GET_EACH === true;
  const txPromise = context.ephemeralDB.transaction('r', [context.ephemeralDB.transformCache], async () => {
    if (debugCollect) {
      console.info('[vt][debug] collect transaction start', JSON.stringify({ nodeId }));
    }
    let loaded: EphemeralTransformCacheRecord[];
    if (useGetEach) {
      const collected: EphemeralTransformCacheRecord[] = [];
      for (const bufferId of bufferIds) {
        if (debugCollect) {
          console.info('[vt][debug] collect get start', JSON.stringify({ nodeId, bufferId }));
        }
        const record = await context.ephemeralDB.transformCache.get(bufferId);
        if (debugCollect) {
          console.info('[vt][debug] collect get done', JSON.stringify({
            nodeId,
            bufferId,
            hasRecord: Boolean(record),
          }));
        }
        if (record) {
          collected.push(record);
        }
      }
      loaded = collected;
    } else if (useBulkGet) {
      loaded = (await context.ephemeralDB.transformCache.bulkGet(bufferIds))
        .filter((record): record is EphemeralTransformCacheRecord => Boolean(record));
    } else {
      loaded = await context.ephemeralDB.transformCache
        .where('id')
        .anyOf(bufferIds)
        .toArray();
    }
    if (debugCollect) {
      console.info('[vt][debug] collect transaction done', JSON.stringify({ nodeId }));
    }
    if (debugCollect) {
      console.log('[vt][debug] collect transaction return', JSON.stringify({
        nodeId,
        recordCount: loaded.length,
        bufferIdCount: bufferIds.length,
        recordSample: loaded.slice(0, Math.min(loaded.length, 3)).map((record) => record.id),
      }));
      const first = loaded[0];
      console.info('[vt][debug] record manual probe', JSON.stringify({
        nodeId,
        hasRecord: Boolean(first),
        bufferId: first?.id ?? null,
        byteLength: first?.data?.byteLength ?? null,
      }));
      const data = first?.data ?? null;
      const dataIsObject = data !== null && typeof data === 'object';
      const dataConstructorName = dataIsObject
        ? (data as { constructor?: { name?: string } }).constructor?.name ?? null
        : null;
      const dataByteLength = dataIsObject && 'byteLength' in (data as { byteLength?: number })
        ? (data as { byteLength?: number }).byteLength ?? null
        : null;
      const dataSize = dataIsObject && 'size' in (data as { size?: number })
        ? (data as { size?: number }).size ?? null
        : null;
      const isArrayBuffer = typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer;
      const isArrayBufferView = dataIsObject
        && typeof ArrayBuffer !== 'undefined'
        && typeof ArrayBuffer.isView === 'function'
        ? ArrayBuffer.isView(data as unknown as ArrayBufferView)
        : null;
      const isUint8Array = typeof Uint8Array !== 'undefined' && data instanceof Uint8Array;
      console.info('[vt][debug] record shape probe', JSON.stringify({
        nodeId,
        hasRecord: Boolean(first),
        recordKeys: first ? Object.keys(first) : [],
        dataType: data === null ? 'null' : typeof data,
        dataConstructorName,
        dataByteLength,
        dataSize,
        isArrayBuffer,
        isArrayBufferView,
        isUint8Array,
        timestamp: first?.timestamp ?? null,
        countryCode: first?.countryCode ?? null,
        sourceKey: first?.sourceKey ?? null,
      }));
    }
    return loaded;
  });
  if (debugCollect) {
    txPromise
      .then(() => {
        console.info('[vt][debug] collect transaction resolved', JSON.stringify({ nodeId }));
      })
      .catch((error) => {
        console.info('[vt][debug] collect transaction rejected', JSON.stringify({
          nodeId,
          error: error instanceof Error ? error.message : String(error),
        }));
      });
  }
  const records: EphemeralTransformCacheRecord[] = debugCollect
    ? await Promise.race([
      txPromise,
      new Promise<never>((_, reject) => {
        const timeoutMs = (globalThis as { __HDB_VT_COLLECT_TIMEOUT_MS?: number }).__HDB_VT_COLLECT_TIMEOUT_MS ?? 15000;
        const timeoutId = setTimeout(() => {
          reject(new Error(`[vt][debug] collect transaction timeout after ${timeoutMs}ms (nodeId=${String(nodeId)})`));
        }, timeoutMs);
        txPromise.finally(() => clearTimeout(timeoutId));
      }),
    ])
    : await txPromise;

  if (debugCollect) {
    try {
      console.info('[vt][debug] record loop start', JSON.stringify({
        nodeId,
        recordCount: records.length,
      }));
    } catch (error) {
      console.info('[vt][debug] record loop start failed', JSON.stringify({
        nodeId,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }
  for (const record of records) {
    if (!record || record.timestamp <= 0) continue;
    bufferSizes.set(record.id, record.data.byteLength);
    if (debugCollect) {
      console.info('[vt][debug] record loop entry', JSON.stringify({
        nodeId,
        bufferId: record.id,
        byteLength: record.data.byteLength,
      }));
    }
    if (debugCollect) {
      console.info('[vt][debug] decode start', JSON.stringify({
        nodeId,
        bufferId: record.id,
        byteLength: record.data.byteLength,
      }));
    }
    const collection = await decodeTransformByBandCache(record.data);
    if (debugCollect) {
      console.info('[vt][debug] decode done', JSON.stringify({
        nodeId,
        bufferId: record.id,
        hasCollection: Boolean(collection),
        featureCount: collection?.features?.length ?? 0,
      }));
    }
    if (!collection) {
      const debug = describeBuffer(record.data);
      console.warn('[shape-vt] failed to decode transform cache for vt stage', JSON.stringify({
        nodeId,
        bufferId: record.id,
        timestamp: record.timestamp,
        byteLength: debug.byteLength,
        headHex: debug.headHex,
        headAscii: debug.headAscii,
        jsonLike: debug.isJsonLike,
      }));
      continue;
    }
    const continentKey = featuresByContinent
      ? (() => {
        const rawCountry = record.countryCode ?? record.sourceKey?.split(':')[0] ?? '';
        const code = rawCountry.trim().toUpperCase();
        const continent = code ? options?.continentByCountry?.get(code) : undefined;
        return continent ?? 'Unknown';
      })()
      : null;
    let featureLoopStartedAt = 0;
    if (debugCollect) {
      featureLoopStartedAt = Date.now();
      console.info('[vt][debug] feature loop start', JSON.stringify({
        nodeId,
        bufferId: record.id,
        featureCount: collection.features.length,
      }));
    }
    collection.features.forEach((feature) => {
      allFeatures.push(feature);
      if (featuresByContinent && continentKey) {
        const bucket = featuresByContinent.get(continentKey);
        if (bucket) {
          bucket.push(feature);
        } else {
          featuresByContinent.set(continentKey, [feature]);
        }
      }
      const bbox = featureBBox(feature);
      if (!bbox) return;
      const featureId = resolveFeatureId(feature);
      const geojsonByteSize = featureId
        ? normalizeGeojsonByteSize(context.featureGeojsonByteSizeById?.get(featureId))
        : undefined;
      featureStats.push({
        bbox,
        vertexCount: countVerticesFromGeometry(feature.geometry),
        polygonCount: countPolygonsFromGeometry(feature.geometry),
        lineStringCount: countLineStringsFromGeometry(feature.geometry),
        bufferId: record.id,
        featureId,
        geojsonByteSize,
      });
    });
    if (debugCollect) {
      console.info('[vt][debug] feature loop done', JSON.stringify({
        nodeId,
        bufferId: record.id,
        featureCount: collection.features.length,
        durationMs: Date.now() - featureLoopStartedAt,
      }));
    }
  }
  if (debugCollect) {
    console.info('[vt][debug] collect features summary', JSON.stringify({
      nodeId,
      allFeatures: allFeatures.length,
      featureStats: featureStats.length,
      bufferSizeCount: bufferSizes.size,
    }));
  }
  if (allFeatures.length === 0) return null;
  return {
    collection: { type: 'FeatureCollection', features: allFeatures },
    featureStats,
    bufferSizes,
    ...(featuresByContinent ? { featuresByContinent } : {}),
  };
};
