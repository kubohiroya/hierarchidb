import type { Feature, FeatureCollection, Geometry, LineString, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import type { Topology } from 'topojson-specification';
import { geojson as geojsonApi } from 'flatgeobuf';
import {
  geometryArea,
  geometryBbox,
  geometryBboxClip,
  geometryIsValid,
  geometrySimplify,
  type GeometryEngine,
  type TransformSimplifyAlgorithm,
} from '@hierarchidb/gis-sdk';
import { quantizeTopoJsonToGrid } from '~/transform/topojsonGrid.js';
import { getTopojsonRuntime } from '~/transform/topojsonRuntimeAdapter.js';

export const TASKDEBUG_BUILD_TAG = 'taskdebug-2026-02-09-0240';
export const isTaskDebugLoggingEnabled = (): boolean => (
  (globalThis as { __HDB_VT_TASK_DEBUG?: boolean }).__HDB_VT_TASK_DEBUG === true
);
export const TRANSFORM_DB_WRITE_TIMEOUT_MS = 30000;
export const TRANSFORM_TASK_UPDATE_TIMEOUT_MS = 15000;

export const withTimeout = async <T>(params: {
  taskId: string;
  operation: string;
  timeoutMs: number;
  promise: Promise<T>;
}): Promise<T> => {
  const startedAt = Date.now();
  const { taskId, operation, timeoutMs, promise } = params;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(
        `db timeout (operation=${operation}, taskId=${taskId}, timeoutMs=${timeoutMs}, elapsedMs=${Date.now() - startedAt})`
      ));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timerId) {
      clearTimeout(timerId);
    }
  }
};

export const normalizeFeatureCollection = async (decoded: unknown): Promise<FeatureCollection | null> => {
  if (!decoded || typeof decoded !== 'object') return null;
  const collection = decoded as FeatureCollection;
  if (collection.type === 'FeatureCollection') {
    const features = Array.isArray(collection.features) ? collection.features : [];
    return { ...collection, features };
  }
  if (typeof (decoded as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    const features: Feature[] = [];
    for await (const feature of decoded as AsyncIterable<Feature>) {
      features.push(feature);
    }
    return { type: 'FeatureCollection', features };
  }
  return null;
};

export const topojsonTextDecoder = new TextDecoder('utf-8');

export const decodeTopoJson = (buffer: ArrayBuffer): Topology => {
  const text = topojsonTextDecoder.decode(new Uint8Array(buffer));
  return JSON.parse(text) as Topology;
};

export const resolveTopoJsonObject = (topology: Topology): Topology['objects'][string] | null => {
  const keys = Object.keys(topology.objects ?? {});
  const key = keys[0];
  if (!key) return null;
  return topology.objects[key] ?? null;
};

export const normalizeTopoJsonCollection = async (topology: Topology): Promise<FeatureCollection> => {
  const object = resolveTopoJsonObject(topology);
  if (!object) return { type: 'FeatureCollection', features: [] };
  const runtime = await getTopojsonRuntime();
  const geojson = runtime.feature(topology, object);
  if (geojson.type === 'FeatureCollection') {
    const features = Array.isArray(geojson.features) ? geojson.features : [];
    return { ...geojson, features };
  }
  return { type: 'FeatureCollection', features: [geojson as Feature] };
};

export const decompressGzip = async (buffer: ArrayBuffer): Promise<ArrayBuffer> => {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('DecompressionStream is not available for gzip decompression');
  }
  const stream = new DecompressionStream('gzip');
  const writer = stream.writable.getWriter();
  await writer.write(new Uint8Array(buffer));
  await writer.close();
  return await new Response(stream.readable).arrayBuffer();
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

export const validateEncodedFlatGeobuf = async (buffer: ArrayBuffer): Promise<void> => {
  try {
    const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
    const normalized = await normalizeFeatureCollection(decoded as unknown);
    if (!normalized) {
      throw new Error('normalize returned null');
    }
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    const debug = describeBuffer(buffer);
    throw new Error(
      `invalid flatgeobuf: ${err} (byteLength=${debug.byteLength} headHex=${debug.headHex} headAscii=${debug.headAscii} jsonLike=${debug.isJsonLike ? '1' : '0'})`,
    );
  }
};

export const decodeFetchCache = async (buffer: ArrayBuffer): Promise<FeatureCollection | null> => {
  const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
  return normalizeFeatureCollection(decoded as unknown);
};

export const decodeTopoJsonFetchCache = async (params: {
  buffer: ArrayBuffer;
  compression?: string;
  zTarget: number;
  toleranceK: number;
  quantize?: number;
  simplifyAlgorithm?: TransformSimplifyAlgorithm;
  skipSimplification?: boolean;
}): Promise<FeatureCollection | null> => {
  const decompressed = params.compression === 'gzip'
    ? await decompressGzip(params.buffer)
    : params.buffer;
  const topology = decodeTopoJson(decompressed);
  if (params.skipSimplification) {
    return normalizeTopoJsonCollection(topology);
  }
  if (params.simplifyAlgorithm === 'geojson') {
    return normalizeTopoJsonCollection(topology);
  }
  const snappedTopology = await quantizeTopoJsonToGrid(topology, {
    zTarget: params.zTarget,
    quantize: params.quantize,
  });
  let { collection, appliedToleranceK } = await simplifyTopoJsonByZoom({
    topology: snappedTopology,
    zTarget: params.zTarget,
    toleranceK: params.toleranceK,
  });
  let maxVertices = maxVerticesInCollection(collection);
  if (maxVertices > MAX_VERTICES_PER_FEATURE) {
    const retryToleranceK = appliedToleranceK * 1.5;
    const retry = await simplifyTopoJsonByZoom({
      topology,
      zTarget: params.zTarget,
      toleranceK: retryToleranceK,
    });
    const retryMaxVertices = maxVerticesInCollection(retry.collection);
    collection = retry.collection;
    maxVertices = retryMaxVertices;
  }
  return collection;
};

export const EARTH_RADIUS_METERS = 6378137;
export const MVT_EXTENT = 4096;
export const MAX_VERTICES_PER_FEATURE = 65535;
export const DEFAULT_RETRY_VERTEX_LIMIT = 6553;
export const LARGE_COUNTRY_RETRY_VERTEX_LIMIT = 32768;
export const LARGE_COUNTRY_CODES = new Set(['RU', 'CA', 'AU']);
export const TRANSFORM_CACHE_WRITE_SLOW_LOG_MS = 20_000;
export const DEFAULT_SIMPLIFY_ALGORITHM: TransformSimplifyAlgorithm = 'topojson';
export const TASK_PHASE_PROGRESS_UPDATE_INTERVAL_MS = 2_000;

export const resolveRetryVertexLimit = (countryCode?: string): number => {
  const normalized = typeof countryCode === 'string' ? countryCode.trim().toUpperCase() : '';
  return LARGE_COUNTRY_CODES.has(normalized)
    ? LARGE_COUNTRY_RETRY_VERTEX_LIMIT
    : DEFAULT_RETRY_VERTEX_LIMIT;
};

export const resolveSimplifyAlgorithm = (algorithm?: TransformSimplifyAlgorithm): TransformSimplifyAlgorithm => (
  algorithm === 'geojson' ? 'geojson' : DEFAULT_SIMPLIFY_ALGORITHM
);

export type TransformTraceLogLevel = 'off' | 'summary' | 'verbose';

export const TRACE_LOG_PRIORITY: Record<TransformTraceLogLevel, number> = {
  off: 0,
  summary: 1,
  verbose: 2,
};

export const normalizeTraceLogLevel = (level?: string): TransformTraceLogLevel => {
  if (level === 'off' || level === 'summary' || level === 'verbose') {
    return level;
  }
  return 'summary';
};

export const shouldLogTransformTrace = (
  configuredLevel: TransformTraceLogLevel,
  requestedLevel: TransformTraceLogLevel
): boolean => TRACE_LOG_PRIORITY[configuredLevel] >= TRACE_LOG_PRIORITY[requestedLevel];

export const emitTransformTrace = (
  configuredLevel: TransformTraceLogLevel,
  requestedLevel: TransformTraceLogLevel,
  message: string,
  payload: Record<string, unknown>
): void => {
  if (!shouldLogTransformTrace(configuredLevel, requestedLevel)) return;
  console.info('[ShapeTransform][ExecutionTrace]', message, payload);
};

export const metersPerPixel = (z: number): number => {
  return (2 * Math.PI * EARTH_RADIUS_METERS) / (MVT_EXTENT * Math.pow(2, z));
};

export const resolveSimplifyToleranceDegrees = (zTarget: number, toleranceK: number): number => {
  if (!Number.isFinite(zTarget) || !Number.isFinite(toleranceK)) return 0;
  const toleranceMeters = toleranceK * metersPerPixel(zTarget);
  if (!Number.isFinite(toleranceMeters) || toleranceMeters <= 0) return 0;
  return (toleranceMeters / (2 * Math.PI * EARTH_RADIUS_METERS)) * 360;
};

const hasCoordinates = (coords: unknown): boolean => {
  if (!Array.isArray(coords)) return false;
  if (coords.length === 0) return false;
  if (typeof coords[0] === 'number') return true;
  return coords.some((entry) => hasCoordinates(entry));
};

const hasCoordinatesFromGeometry = (geometry: Geometry): boolean => {
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.some((child) => hasCoordinatesFromGeometry(child));
  }
  return hasCoordinates((geometry as Geometry & { coordinates: unknown }).coordinates);
};

const countVertices = (coords: unknown): number => {
  if (!Array.isArray(coords)) return 0;
  if (coords.length === 0) return 0;
  if (typeof coords[0] === 'number') return 1;
  return coords.reduce((sum: number, child: unknown) => sum + countVertices(child), 0);
};

const countVerticesFromGeometry = (geometry?: Geometry | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum: number, child: Geometry) => sum + countVerticesFromGeometry(child), 0);
  }
  return countVertices(geometry.coordinates);
};

const maxVerticesInCollection = (collection: FeatureCollection): number => {
  let maxVertices = 0;
  for (const feature of collection.features) {
    const vertexCount = countVerticesFromGeometry(feature.geometry);
    if (vertexCount > maxVertices) {
      maxVertices = vertexCount;
    }
  }
  return maxVertices;
};

export type GeometryOps = {
  simplifyCollection: (collection: FeatureCollection, zTarget: number, toleranceK: number) => FeatureCollection;
  simplifyFeature: (feature: Feature, zTarget: number, toleranceK: number) => Feature;
  bbox: (feature: Feature<Geometry>) => [number, number, number, number] | null;
  area: (feature: Feature<Geometry>) => number;
  isValid: (geometry?: Geometry | null) => boolean;
  countSelfIntersections: (geometry: Geometry) => number;
  intersectsBBox: (
    feature: Feature<Geometry>,
    bbox: { minX: number; minY: number; maxX: number; maxY: number },
  ) => boolean;
};

export const createGeometryOps = (engine: GeometryEngine): GeometryOps => {
  const simplifyCollection = (collection: FeatureCollection, zTarget: number, toleranceK: number): FeatureCollection => {
    const tolerance = resolveSimplifyToleranceDegrees(zTarget, toleranceK);
    if (!Number.isFinite(tolerance) || tolerance <= 0) return collection;
    const simplified = geometrySimplify(collection, engine, {
      tolerance,
      highQuality: false,
      mutate: false,
      preserveTopology: true,
    });
    if (!simplified || simplified.type !== 'FeatureCollection') {
      throw new Error('simplify returned non-FeatureCollection');
    }
    return simplified as FeatureCollection;
  };

  const simplifyFeature = (feature: Feature, zTarget: number, toleranceK: number): Feature => {
    const tolerance = resolveSimplifyToleranceDegrees(zTarget, toleranceK);
    if (!Number.isFinite(tolerance) || tolerance <= 0) return feature;
    const simplified = geometrySimplify(feature, engine, {
      tolerance,
      highQuality: false,
      mutate: false,
      preserveTopology: true,
    });
    if (!simplified || simplified.type !== 'Feature') {
      throw new Error('simplify returned non-Feature');
    }
    return simplified as Feature;
  };

  const bbox = (feature: Feature<Geometry>): [number, number, number, number] | null => {
    return geometryBbox(feature, engine);
  };

  const area = (feature: Feature<Geometry>): number => {
    return geometryArea(feature, engine);
  };

  const isValid = (geometry?: Geometry | null): boolean => {
    if (!geometry) return true;
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return true;
    return geometryIsValid(geometry, engine);
  };

  const countSelfIntersections = (geometry: Geometry): number => {
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return 0;
    return isValid(geometry) ? 0 : 1;
  };

  const intersectsBBox = (
    feature: Feature<Geometry>,
    bboxParams: { minX: number; minY: number; maxX: number; maxY: number },
  ): boolean => {
    const clipped = geometryBboxClip(
      feature as Feature<LineString | MultiLineString | Polygon | MultiPolygon>,
      [bboxParams.minX, bboxParams.minY, bboxParams.maxX, bboxParams.maxY],
      engine,
    );
    return Boolean(clipped?.geometry && hasCoordinatesFromGeometry(clipped.geometry));
  };

  return {
    simplifyCollection,
    simplifyFeature,
    bbox,
    area,
    isValid,
    countSelfIntersections,
    intersectsBBox,
  };
};

export const resolveTransformTolerance = (
  toleranceByBand: number[] | undefined,
  bandIndex: number,
  fallback: number,
): number => {
  if (!Array.isArray(toleranceByBand) || toleranceByBand.length === 0) {
    return fallback;
  }
  const normalizedBandIndex = Number.isFinite(bandIndex) ? Math.floor(bandIndex) : 0;
  const safeIndex = Math.max(0, Math.min(toleranceByBand.length - 1, normalizedBandIndex));
  const candidate = toleranceByBand[safeIndex];
  const resolvedCandidate = typeof candidate === 'number' ? candidate : fallback;
  return Number.isFinite(resolvedCandidate) ? resolvedCandidate : fallback;
};

export const simplifyTopoJsonByZoom = async (params: {
  topology: Topology;
  zTarget: number;
  toleranceK: number;
}): Promise<{ topology: Topology; collection: FeatureCollection; appliedToleranceK: number }> => {
  const baseCollection = await normalizeTopoJsonCollection(params.topology);
  const appliedToleranceK = params.toleranceK;
  const tolerance = resolveSimplifyToleranceDegrees(params.zTarget, appliedToleranceK);
  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    return { topology: params.topology, collection: baseCollection, appliedToleranceK };
  }
  const runtime = await getTopojsonRuntime();
  const presimplified = runtime.presimplify(params.topology);
  const simplified = runtime.simplify(presimplified, tolerance);
  const simplifiedCollection = await normalizeTopoJsonCollection(simplified);
  return { topology: simplified, collection: simplifiedCollection, appliedToleranceK };
};
