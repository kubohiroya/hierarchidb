import type { Feature, FeatureCollection, Geometry, LineString, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import type { NodeId } from '@hierarchidb/core-types';
import type { Topology } from 'topojson-specification';
import { geojson as geojsonApi } from 'flatgeobuf';
import {
  applyFeatureFiltering,
  encodeFlatGeobufFromFeatureCollection,
  geometryArea,
  geometryBbox,
  geometryBboxClip,
  geometryIsValid,
  geometrySimplify,
  geometryUnkinkPolygons,
  latToTileY,
  lonToTileX,
  type GeometryEngine,
  type TransformSimplifyAlgorithm,
} from '@hierarchidb/gis-sdk';
import type { ShapeTransformErrorRecord } from '@hierarchidb/shape-api';
import type { TaskDisplayPayload } from '@hierarchidb/batch-api';
import { buildBoundaryFeature } from './geometry.js';
import { quantizeTopoJsonToGrid } from './topojsonGrid.js';
import type { TransformByBandStageContext } from '../contexts.js';
import type { StageHandler, StageHandlerResult, TransformByBandTaskInput } from '../types/types.js';
import { VtTaskQueueDb, updateTask } from '../task/taskQueue.js';
import { logDebug } from '../debug/persistentDebugLog.js';
import { packTileId } from '../tiles/tileId.js';
import { getTopojsonRuntime } from './topojsonRuntimeAdapter.js';

const TASKDEBUG_BUILD_TAG = 'taskdebug-2026-02-09-0240';
let structuredCloneLogged = false;
const isTaskDebugLoggingEnabled = (): boolean => (
  (globalThis as { __HDB_VT_TASK_DEBUG?: boolean }).__HDB_VT_TASK_DEBUG === true
);
const TRANSFORM_DB_WRITE_TIMEOUT_MS = 30000;
const TRANSFORM_TASK_UPDATE_TIMEOUT_MS = 15000;

const withTimeout = async <T>(params: {
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

const normalizeFeatureCollection = async (decoded: unknown): Promise<FeatureCollection | null> => {
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

const topojsonTextDecoder = new TextDecoder('utf-8');

const decodeTopoJson = (buffer: ArrayBuffer): Topology => {
  const text = topojsonTextDecoder.decode(new Uint8Array(buffer));
  return JSON.parse(text) as Topology;
};

const resolveTopoJsonObject = (topology: Topology): Topology['objects'][string] | null => {
  const keys = Object.keys(topology.objects ?? {});
  const key = keys[0];
  if (!key) return null;
  return topology.objects[key] ?? null;
};

const normalizeTopoJsonCollection = async (topology: Topology): Promise<FeatureCollection> => {
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

const decompressGzip = async (buffer: ArrayBuffer): Promise<ArrayBuffer> => {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('DecompressionStream is not available for gzip decompression');
  }
  const stream = new DecompressionStream('gzip');
  const writer = stream.writable.getWriter();
  await writer.write(new Uint8Array(buffer));
  await writer.close();
  return await new Response(stream.readable).arrayBuffer();
};

const describeBuffer = (buffer: ArrayBuffer): {
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

const validateEncodedFlatGeobuf = async (buffer: ArrayBuffer): Promise<void> => {
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

const decodeFetchCache = async (buffer: ArrayBuffer): Promise<FeatureCollection | null> => {
  const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
  return normalizeFeatureCollection(decoded as unknown);
};

const decodeTopoJsonFetchCache = async (params: {
  buffer: ArrayBuffer;
  compression?: string;
  zTarget: number;
  toleranceK: number;
  quantize?: number;
  simplifyAlgorithm?: TransformSimplifyAlgorithm;
}): Promise<FeatureCollection | null> => {
  const decompressed = params.compression === 'gzip'
    ? await decompressGzip(params.buffer)
    : params.buffer;
  const topology = decodeTopoJson(decompressed);
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

const EARTH_RADIUS_METERS = 6378137;
const MVT_EXTENT = 4096;
const MAX_VERTICES_PER_FEATURE = 65535;
const DEFAULT_RETRY_VERTEX_LIMIT = 6553;
const LARGE_COUNTRY_RETRY_VERTEX_LIMIT = 32768;
const LARGE_COUNTRY_CODES = new Set(['RU', 'CA', 'AU']);
const TRANSFORM_CACHE_WRITE_SLOW_LOG_MS = 20_000;
const DEFAULT_SIMPLIFY_ALGORITHM: TransformSimplifyAlgorithm = 'topojson';
const TASK_PHASE_PROGRESS_UPDATE_INTERVAL_MS = 2_000;

const resolveRetryVertexLimit = (countryCode?: string): number => {
  const normalized = typeof countryCode === 'string' ? countryCode.trim().toUpperCase() : '';
  return LARGE_COUNTRY_CODES.has(normalized)
    ? LARGE_COUNTRY_RETRY_VERTEX_LIMIT
    : DEFAULT_RETRY_VERTEX_LIMIT;
};

const resolveSimplifyAlgorithm = (algorithm?: TransformSimplifyAlgorithm): TransformSimplifyAlgorithm => (
  algorithm === 'geojson' ? 'geojson' : DEFAULT_SIMPLIFY_ALGORITHM
);

type SimplifyExecutionPath =
  | 'topojson_decode_simplify_geojson_skip'
  | 'topojson_decode_only_geojson_run'
  | 'geojson_decode_geojson_run';

export const resolveSimplifyExecutionPath = (params: {
  fetchFormat?: string;
  simplifyAlgorithm: TransformSimplifyAlgorithm;
}): SimplifyExecutionPath => {
  const isTopojsonInput = params.fetchFormat === 'topojson';
  if (!isTopojsonInput) {
    return 'geojson_decode_geojson_run';
  }
  return params.simplifyAlgorithm === 'topojson'
    ? 'topojson_decode_simplify_geojson_skip'
    : 'topojson_decode_only_geojson_run';
};

type TransformTraceLogLevel = 'off' | 'summary' | 'verbose';

const TRACE_LOG_PRIORITY: Record<TransformTraceLogLevel, number> = {
  off: 0,
  summary: 1,
  verbose: 2,
};

const normalizeTraceLogLevel = (level?: string): TransformTraceLogLevel => {
  if (level === 'off' || level === 'summary' || level === 'verbose') {
    return level;
  }
  return 'summary';
};

const shouldLogTransformTrace = (
  configuredLevel: TransformTraceLogLevel,
  requestedLevel: TransformTraceLogLevel,
): boolean => TRACE_LOG_PRIORITY[configuredLevel] >= TRACE_LOG_PRIORITY[requestedLevel];

const emitTransformTrace = (
  configuredLevel: TransformTraceLogLevel,
  requestedLevel: TransformTraceLogLevel,
  message: string,
  payload: Record<string, unknown>,
): void => {
  if (!shouldLogTransformTrace(configuredLevel, requestedLevel)) return;
  console.info('[ShapeTransform][ExecutionTrace]', message, payload);
};

const metersPerPixel = (z: number): number => {
  return (2 * Math.PI * EARTH_RADIUS_METERS) / (MVT_EXTENT * Math.pow(2, z));
};

const resolveSimplifyToleranceDegrees = (zTarget: number, toleranceK: number): number => {
  if (!Number.isFinite(zTarget) || !Number.isFinite(toleranceK)) return 0;
  const toleranceMeters = toleranceK * metersPerPixel(zTarget);
  if (!Number.isFinite(toleranceMeters) || toleranceMeters <= 0) return 0;
  return (toleranceMeters / (2 * Math.PI * EARTH_RADIUS_METERS)) * 360;
};

type GeometryOps = {
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

const createGeometryOps = (
  engine: GeometryEngine,
  options?: { preserveTopology?: boolean },
): GeometryOps => {
  const preserveTopology = options?.preserveTopology ?? true;
  const simplifyCollection = (collection: FeatureCollection, zTarget: number, toleranceK: number): FeatureCollection => {
    const tolerance = resolveSimplifyToleranceDegrees(zTarget, toleranceK);
    if (!Number.isFinite(tolerance) || tolerance <= 0) return collection;
    const simplified = geometrySimplify(collection, engine, {
      tolerance,
      highQuality: false,
      mutate: false,
      preserveTopology,
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
      preserveTopology,
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

const resolveTransformTolerance = (
  baseTolerance: number,
  _zTarget: number,
): number => {
  if (!Number.isFinite(baseTolerance)) return baseTolerance;
  return baseTolerance;
};

const simplifyTopoJsonByZoom = async (params: {
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

export const decodeFetchCacheByFormat = async (params: {
  buffer: ArrayBuffer;
  format?: string;
  compression?: string;
  zTarget: number;
  toleranceK: number;
  quantize?: number;
  simplifyAlgorithm?: TransformSimplifyAlgorithm;
}): Promise<FeatureCollection | null> => {
  if (params.format === 'topojson') {
    return decodeTopoJsonFetchCache({
      buffer: params.buffer,
      compression: params.compression,
      zTarget: params.zTarget,
      toleranceK: params.toleranceK,
      quantize: params.quantize,
      simplifyAlgorithm: resolveSimplifyAlgorithm(params.simplifyAlgorithm),
    });
  }
  return decodeFetchCache(params.buffer);
};

const simplifyOnlyCollection = (
  collection: FeatureCollection,
  zTarget: number,
  toleranceK: number,
  geometryOps: GeometryOps,
  _options?: { skipLargeArea?: boolean },
): FeatureCollection => geometryOps.simplifyCollection(collection, zTarget, toleranceK);

type GeojsonValidationIssue = {
  layer: string;
  featureId: string;
  geometryType: string;
  vertexCount: number;
  reason: string;
  sampleCoords?: number[][];
};

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

const isValidPosition = (value: unknown): value is number[] => (
  Array.isArray(value)
  && value.length >= 2
  && isFiniteNumber(value[0])
  && isFiniteNumber(value[1])
);

const isClosedRing = (ring: number[][]): boolean => {
  if (ring.length < 4) return false;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return Boolean(first && last && first[0] === last[0] && first[1] === last[1]);
};

const validateLineStringCoords = (coords: unknown): number[][] | null => {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const points = coords.filter((p) => isValidPosition(p)) as number[][];
  return points.length === coords.length ? points : null;
};

const validatePolygonCoords = (coords: unknown): number[][][] | null => {
  if (!Array.isArray(coords) || coords.length === 0) return null;
  const rings = coords as unknown[];
  const out: number[][][] = [];
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 4) return null;
    const points = ring.filter((p) => isValidPosition(p)) as number[][];
    if (points.length !== ring.length) return null;
    if (!isClosedRing(points)) return null;
    out.push(points);
  }
  return out;
};

const validateGeometryForVt = (geometry: Geometry | null | undefined): string | null => {
  if (!geometry) return 'missing geometry';
  switch (geometry.type) {
    case 'Point':
      return isValidPosition(geometry.coordinates) ? null : 'invalid point coordinates';
    case 'MultiPoint':
      return Array.isArray(geometry.coordinates)
        && geometry.coordinates.every((coord) => isValidPosition(coord))
        ? null
        : 'invalid multipoint coordinates';
    case 'LineString':
      return validateLineStringCoords(geometry.coordinates) ? null : 'invalid linestring coordinates';
    case 'MultiLineString':
      return Array.isArray(geometry.coordinates)
        && geometry.coordinates.every((line) => validateLineStringCoords(line))
        ? null
        : 'invalid multilinestring coordinates';
    case 'Polygon':
      return validatePolygonCoords(geometry.coordinates) ? null : 'invalid polygon coordinates';
    case 'MultiPolygon':
      return Array.isArray(geometry.coordinates)
        && geometry.coordinates.every((poly) => validatePolygonCoords(poly))
        ? null
        : 'invalid multipolygon coordinates';
    case 'GeometryCollection':
      return geometry.geometries.every((geom) => !validateGeometryForVt(geom))
        ? null
        : 'invalid geometry collection';
    default:
      return 'unknown geometry type';
  }
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

const countPolygonsFromGeometry = (geometry?: Geometry | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum: number, child: Geometry) => sum + countPolygonsFromGeometry(child), 0);
  }
  if (geometry.type === 'Polygon') {
    return 1;
  }
  if (geometry.type === 'MultiPolygon') {
    return Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0;
  }
  return 0;
};

const countLinesFromGeometry = (geometry?: Geometry | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum: number, child: Geometry) => sum + countLinesFromGeometry(child), 0);
  }
  if (geometry.type === 'LineString') return 1;
  if (geometry.type === 'MultiLineString') {
    return Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0;
  }
  return 0;
};

const segmentLength = (pointA: number[], pointB: number[]): number => {
  const ax = pointA[0];
  const ay = pointA[1];
  const bx = pointB[0];
  const by = pointB[1];
  if (
    ax === undefined
    || ay === undefined
    || bx === undefined
    || by === undefined
    || !Number.isFinite(ax)
    || !Number.isFinite(ay)
    || !Number.isFinite(bx)
    || !Number.isFinite(by)
  ) {
    return 0;
  }
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt((dx * dx) + (dy * dy));
};

const collectLineLengths = (coords: number[][]): { total: number; max: number } => {
  let total = 0;
  let max = 0;
  for (let index = 1; index < coords.length; index += 1) {
    const current = coords[index];
    const prev = coords[index - 1];
    if (!current || !prev) continue;
    const length = segmentLength(prev, current);
    total += length;
    if (length > max) {
      max = length;
    }
  }
  return { total, max };
};

const collectGeometryLengthMetrics = (geometry?: Geometry | null): { total: number; max: number } => {
  if (!geometry) return { total: 0, max: 0 };
  if (geometry.type === 'LineString') {
    return collectLineLengths(Array.isArray(geometry.coordinates) ? geometry.coordinates as number[][] : []);
  }
  if (geometry.type === 'MultiLineString') {
    let total = 0;
    let max = 0;
    const lines = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    for (const line of lines) {
      const metrics = collectLineLengths(Array.isArray(line) ? line as number[][] : []);
      total += metrics.total;
      if (metrics.max > max) {
        max = metrics.max;
      }
    }
    return { total, max };
  }
  if (geometry.type === 'Polygon') {
    let total = 0;
    let max = 0;
    const rings = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    for (const ring of rings) {
      const metrics = collectLineLengths(Array.isArray(ring) ? ring as number[][] : []);
      total += metrics.total;
      if (metrics.max > max) {
        max = metrics.max;
      }
    }
    return { total, max };
  }
  if (geometry.type === 'MultiPolygon') {
    let total = 0;
    let max = 0;
    const polygons = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    for (const polygon of polygons) {
      if (!Array.isArray(polygon)) continue;
      for (const ring of polygon) {
        const metrics = collectLineLengths(Array.isArray(ring) ? ring as number[][] : []);
        total += metrics.total;
        if (metrics.max > max) {
          max = metrics.max;
        }
      }
    }
    return { total, max };
  }
  if (geometry.type === 'GeometryCollection') {
    let total = 0;
    let max = 0;
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    for (const child of geometries) {
      const metrics = collectGeometryLengthMetrics(child);
      total += metrics.total;
      if (metrics.max > max) {
        max = metrics.max;
      }
    }
    return { total, max };
  }
  return { total: 0, max: 0 };
};

type CollectionAnomalyMetrics = {
  featureCount: number;
  vertexCount: number;
  polygonCount: number;
  lineCount: number;
  totalArea: number;
  totalLength: number;
  maxEdgeLength: number;
  selfIntersectionCount: number;
  triangleRingCount: number;
  triangleRingSharePercent: number;
  maxTriangleEdgeToBBoxRatio: number;
};

type TriangleRingMetrics = {
  triangleRingCount: number;
  maxTriangleEdgeToBBoxRatio: number;
};

type CoordinatePair = [number, number];

const normalizeRingVertices = (ring: number[][]): CoordinatePair[] => {
  if (!Array.isArray(ring) || ring.length < 4) return [];
  const normalized: CoordinatePair[] = [];
  ring.forEach((coord) => {
    if (!Array.isArray(coord)) return;
    const x = coord[0];
    const y = coord[1];
    if (typeof x !== 'number' || !Number.isFinite(x)) return;
    if (typeof y !== 'number' || !Number.isFinite(y)) return;
    normalized.push([x, y]);
  });
  if (normalized.length < 4) return [];
  const deduped: CoordinatePair[] = [];
  normalized.forEach((coord) => {
    const prev = deduped[deduped.length - 1];
    if (!prev) {
      deduped.push(coord);
      return;
    }
    if (prev[0] === coord[0] && prev[1] === coord[1]) return;
    deduped.push(coord);
  });
  const first = deduped[0];
  const last = deduped[deduped.length - 1];
  if (!first || !last) return [];
  if (first[0] !== last[0] || first[1] !== last[1]) return [];
  const openRing = deduped.slice(0, deduped.length - 1);
  if (openRing.length < 3) return [];
  return openRing;
};

const collectTriangleRingMetricsFromPolygonCoordinates = (coordinates: number[][][]): TriangleRingMetrics => {
  let triangleRingCount = 0;
  let maxTriangleEdgeToBBoxRatio = 0;
  for (const ring of coordinates) {
    const vertices = normalizeRingVertices(ring);
    if (vertices.length !== 3) continue;
    triangleRingCount += 1;
    const xs = vertices.map((vertex) => vertex[0]);
    const ys = vertices.map((vertex) => vertex[1]);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    const bboxSpan = Math.max(spanX, spanY);
    if (!Number.isFinite(bboxSpan) || bboxSpan <= 0) continue;
    const [vertexA, vertexB, vertexC] = vertices;
    if (!vertexA || !vertexB || !vertexC) continue;
    const edges = [
      segmentLength(vertexA, vertexB),
      segmentLength(vertexB, vertexC),
      segmentLength(vertexC, vertexA),
    ];
    const longestEdge = Math.max(...edges);
    if (!Number.isFinite(longestEdge) || longestEdge <= 0) continue;
    const ratio = longestEdge / bboxSpan;
    if (ratio > maxTriangleEdgeToBBoxRatio) {
      maxTriangleEdgeToBBoxRatio = ratio;
    }
  }
  return { triangleRingCount, maxTriangleEdgeToBBoxRatio };
};

const collectTriangleRingMetricsFromGeometry = (geometry?: Geometry | null): TriangleRingMetrics => {
  if (!geometry) return { triangleRingCount: 0, maxTriangleEdgeToBBoxRatio: 0 };
  if (geometry.type === 'Polygon') {
    return collectTriangleRingMetricsFromPolygonCoordinates(
      Array.isArray(geometry.coordinates) ? geometry.coordinates : [],
    );
  }
  if (geometry.type === 'MultiPolygon') {
    let triangleRingCount = 0;
    let maxTriangleEdgeToBBoxRatio = 0;
    const polygons = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    for (const polygon of polygons) {
      const metrics = collectTriangleRingMetricsFromPolygonCoordinates(Array.isArray(polygon) ? polygon : []);
      triangleRingCount += metrics.triangleRingCount;
      if (metrics.maxTriangleEdgeToBBoxRatio > maxTriangleEdgeToBBoxRatio) {
        maxTriangleEdgeToBBoxRatio = metrics.maxTriangleEdgeToBBoxRatio;
      }
    }
    return { triangleRingCount, maxTriangleEdgeToBBoxRatio };
  }
  if (geometry.type === 'GeometryCollection') {
    let triangleRingCount = 0;
    let maxTriangleEdgeToBBoxRatio = 0;
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    for (const child of geometries) {
      const metrics = collectTriangleRingMetricsFromGeometry(child);
      triangleRingCount += metrics.triangleRingCount;
      if (metrics.maxTriangleEdgeToBBoxRatio > maxTriangleEdgeToBBoxRatio) {
        maxTriangleEdgeToBBoxRatio = metrics.maxTriangleEdgeToBBoxRatio;
      }
    }
    return { triangleRingCount, maxTriangleEdgeToBBoxRatio };
  }
  return { triangleRingCount: 0, maxTriangleEdgeToBBoxRatio: 0 };
};

const collectCollectionAnomalyMetrics = (
  collection: FeatureCollection,
  geometryOps: GeometryOps,
): CollectionAnomalyMetrics => {
  let vertexCount = 0;
  let polygonCount = 0;
  let lineCount = 0;
  let totalArea = 0;
  let totalLength = 0;
  let maxEdgeLength = 0;
  let selfIntersectionCount = 0;
  let triangleRingCount = 0;
  let maxTriangleEdgeToBBoxRatio = 0;
  for (const feature of collection.features) {
    if (!feature?.geometry) continue;
    const geometry = feature.geometry;
    vertexCount += countVerticesFromGeometry(geometry);
    polygonCount += countPolygonsFromGeometry(geometry);
    lineCount += countLinesFromGeometry(geometry);
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
      totalArea += Math.abs(geometryOps.area(feature as Feature<Geometry>));
      selfIntersectionCount += geometryOps.countSelfIntersections(geometry);
    }
    const lineMetrics = collectGeometryLengthMetrics(geometry);
    totalLength += lineMetrics.total;
    if (lineMetrics.max > maxEdgeLength) {
      maxEdgeLength = lineMetrics.max;
    }
    const triangleMetrics = collectTriangleRingMetricsFromGeometry(geometry);
    triangleRingCount += triangleMetrics.triangleRingCount;
    if (triangleMetrics.maxTriangleEdgeToBBoxRatio > maxTriangleEdgeToBBoxRatio) {
      maxTriangleEdgeToBBoxRatio = triangleMetrics.maxTriangleEdgeToBBoxRatio;
    }
  }
  const triangleRingSharePercent = polygonCount > 0
    ? triangleRingCount / polygonCount * 100
    : 0;
  return {
    featureCount: collection.features.length,
    vertexCount,
    polygonCount,
    lineCount,
    totalArea,
    totalLength,
    maxEdgeLength,
    selfIntersectionCount,
    triangleRingCount,
    triangleRingSharePercent,
    maxTriangleEdgeToBBoxRatio,
  };
};

type AnomalyProfile = 'polygon' | 'line';

type TopojsonSharedArcDiagnostics = {
  totalArcRefs: number;
  sharedArcRefs: number;
  uniqueArcCount: number;
  sharedUniqueArcCount: number;
  sharedArcRatioPercent: number;
};

const normalizeTopojsonArcIndex = (value: number): number | null => {
  if (!Number.isInteger(value)) return null;
  return value < 0 ? ~value : value;
};

const collectTopojsonSharedArcDiagnostics = (topology: Topology): TopojsonSharedArcDiagnostics | null => {
  const arcUsage = new Map<number, number>();
  let totalArcRefs = 0;
  const visitArcNode = (node: unknown): void => {
    if (typeof node === 'number') {
      const arcIndex = normalizeTopojsonArcIndex(node);
      if (arcIndex === null) return;
      totalArcRefs += 1;
      arcUsage.set(arcIndex, (arcUsage.get(arcIndex) ?? 0) + 1);
      return;
    }
    if (!Array.isArray(node)) return;
    node.forEach((child) => visitArcNode(child));
  };
  const visitGeometryObject = (geometryObject: unknown): void => {
    if (!geometryObject || typeof geometryObject !== 'object') return;
    const record = geometryObject as {
      type?: string;
      arcs?: unknown;
      geometries?: unknown[];
    };
    if (record.type === 'GeometryCollection') {
      const geometries = Array.isArray(record.geometries) ? record.geometries : [];
      geometries.forEach((child) => visitGeometryObject(child));
      return;
    }
    if ('arcs' in record) {
      visitArcNode(record.arcs);
    }
  };
  Object.values(topology.objects ?? {}).forEach((objectValue) => visitGeometryObject(objectValue));
  if (totalArcRefs <= 0) return null;
  let sharedArcRefs = 0;
  let sharedUniqueArcCount = 0;
  arcUsage.forEach((count) => {
    if (count < 2) return;
    sharedArcRefs += count;
    sharedUniqueArcCount += 1;
  });
  const uniqueArcCount = arcUsage.size;
  const sharedArcRatioPercent = sharedArcRefs / totalArcRefs * 100;
  return {
    totalArcRefs,
    sharedArcRefs,
    uniqueArcCount,
    sharedUniqueArcCount,
    sharedArcRatioPercent,
  };
};

type AnomalyAssessment = {
  isAnomalous: boolean;
  score: number;
  scoreThreshold: number;
  edgeLengthRatio: number;
  areaDriftPercent: number;
  lineLengthDriftPercent: number;
  vertexDriftPercent: number;
  triangleShareDriftPercent: number;
  triangleEdgeToBBoxRatio: number;
  topoSharedArcRatioPercent: number | null;
  selfIntersectionCount: number;
  reasons: string[];
};

const safeRatio = (numerator: number, denominator: number): number => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 1;
  }
  return numerator / denominator;
};

export const assessAnomalyRisk = (params: {
  profile: AnomalyProfile;
  baseline: CollectionAnomalyMetrics;
  candidate: CollectionAnomalyMetrics;
  thresholds?: {
    scoreThreshold?: number;
    maxEdgeLengthRatio?: number;
    maxAreaDriftPercent?: number;
    maxSelfIntersectionCount?: number;
    maxLineLengthDriftPercent?: number;
    maxVertexDriftPercent?: number;
    geojson?: {
      maxTriangleShareDriftPercent?: number;
      maxTriangleEdgeToBBoxRatio?: number;
    };
    topojson?: {
      minSharedArcRatioPercent?: number;
    };
  };
  diagnostics?: {
    topoSharedArcRatioPercent?: number | null;
  };
}): AnomalyAssessment => {
  const scoreThreshold = params.thresholds?.scoreThreshold ?? 2.2;
  const maxEdgeLengthRatio = params.thresholds?.maxEdgeLengthRatio ?? Number.POSITIVE_INFINITY;
  const maxAreaDriftPercent = params.thresholds?.maxAreaDriftPercent ?? Number.POSITIVE_INFINITY;
  const maxSelfIntersectionCount = params.thresholds?.maxSelfIntersectionCount ?? Number.POSITIVE_INFINITY;
  const maxLineLengthDriftPercent = params.thresholds?.maxLineLengthDriftPercent ?? Number.POSITIVE_INFINITY;
  const maxVertexDriftPercent = params.thresholds?.maxVertexDriftPercent ?? Number.POSITIVE_INFINITY;
  const maxTriangleShareDriftPercent = params.thresholds?.geojson?.maxTriangleShareDriftPercent
    ?? Number.POSITIVE_INFINITY;
  const maxTriangleEdgeToBBoxRatio = params.thresholds?.geojson?.maxTriangleEdgeToBBoxRatio
    ?? Number.POSITIVE_INFINITY;
  const minSharedArcRatioPercent = params.thresholds?.topojson?.minSharedArcRatioPercent
    ?? Number.NEGATIVE_INFINITY;

  const edgeLengthRatio = safeRatio(params.candidate.maxEdgeLength, params.baseline.maxEdgeLength);
  const areaDriftPercent = params.profile === 'polygon' && params.baseline.totalArea > 0
    ? Math.abs(params.candidate.totalArea - params.baseline.totalArea) / params.baseline.totalArea * 100
    : 0;
  const lineLengthDriftPercent = params.baseline.totalLength > 0
    ? Math.abs(params.candidate.totalLength - params.baseline.totalLength) / params.baseline.totalLength * 100
    : 0;
  const vertexDriftPercent = params.baseline.vertexCount > 0
    ? Math.abs(params.candidate.vertexCount - params.baseline.vertexCount) / params.baseline.vertexCount * 100
    : 0;
  const triangleShareDriftPercent = params.profile === 'polygon'
    ? Math.max(0, params.candidate.triangleRingSharePercent - params.baseline.triangleRingSharePercent)
    : 0;
  const triangleEdgeToBBoxRatio = params.profile === 'polygon'
    ? params.candidate.maxTriangleEdgeToBBoxRatio
    : 0;
  const topoSharedArcRatioPercent = typeof params.diagnostics?.topoSharedArcRatioPercent === 'number'
    && Number.isFinite(params.diagnostics.topoSharedArcRatioPercent)
    ? params.diagnostics.topoSharedArcRatioPercent
    : null;
  const topoSharedArcDeficitPercent = topoSharedArcRatioPercent === null
    ? 0
    : Math.max(0, minSharedArcRatioPercent - topoSharedArcRatioPercent);
  const selfIntersectionCount = params.candidate.selfIntersectionCount;

  const reasons: string[] = [];
  if (edgeLengthRatio > maxEdgeLengthRatio) {
    reasons.push(`edgeLengthRatio>${maxEdgeLengthRatio}`);
  }
  if (params.profile === 'polygon' && areaDriftPercent > maxAreaDriftPercent) {
    reasons.push(`areaDriftPercent>${maxAreaDriftPercent}`);
  }
  if (params.profile === 'polygon' && selfIntersectionCount > maxSelfIntersectionCount) {
    reasons.push(`selfIntersectionCount>${maxSelfIntersectionCount}`);
  }
  if (params.profile === 'line' && lineLengthDriftPercent > maxLineLengthDriftPercent) {
    reasons.push(`lineLengthDriftPercent>${maxLineLengthDriftPercent}`);
  }
  if (vertexDriftPercent > maxVertexDriftPercent) {
    reasons.push(`vertexDriftPercent>${maxVertexDriftPercent}`);
  }
  if (
    params.profile === 'polygon'
    && triangleShareDriftPercent > maxTriangleShareDriftPercent
    && triangleEdgeToBBoxRatio > maxTriangleEdgeToBBoxRatio
  ) {
    reasons.push(
      `triangleShareDriftPercent>${maxTriangleShareDriftPercent}&triangleEdgeToBBoxRatio>${maxTriangleEdgeToBBoxRatio}`,
    );
  }
  if (params.profile === 'polygon' && topoSharedArcRatioPercent !== null && topoSharedArcRatioPercent < minSharedArcRatioPercent) {
    reasons.push(`topoSharedArcRatioPercent<${minSharedArcRatioPercent}`);
  }

  const normalized = (value: number, threshold: number): number => {
    if (!Number.isFinite(value) || !Number.isFinite(threshold) || threshold <= 0) return 0;
    return Math.min(3, value / threshold);
  };
  const edgeScore = normalized(edgeLengthRatio, maxEdgeLengthRatio);
  const areaScore = params.profile === 'polygon'
    ? normalized(areaDriftPercent, maxAreaDriftPercent)
    : 0;
  const lineScore = params.profile === 'line'
    ? normalized(lineLengthDriftPercent, maxLineLengthDriftPercent)
    : 0;
  const vertexScore = normalized(vertexDriftPercent, maxVertexDriftPercent);
  const selfIntersectionScore = params.profile === 'polygon' && Number.isFinite(maxSelfIntersectionCount)
    ? Math.min(3, Math.max(0, selfIntersectionCount - maxSelfIntersectionCount))
    : 0;
  const triangleShareScore = params.profile === 'polygon'
    ? normalized(triangleShareDriftPercent, maxTriangleShareDriftPercent)
    : 0;
  const triangleEdgeScore = params.profile === 'polygon'
    ? normalized(triangleEdgeToBBoxRatio, maxTriangleEdgeToBBoxRatio)
    : 0;
  const topoSharedArcScore = params.profile === 'polygon'
    ? normalized(topoSharedArcDeficitPercent, Math.max(1, minSharedArcRatioPercent))
    : 0;
  const triangleCompositeScore = triangleShareScore > 0
    ? (triangleShareScore + triangleEdgeScore) / 2
    : 0;
  const score = edgeScore + areaScore + lineScore + vertexScore + selfIntersectionScore + triangleCompositeScore + topoSharedArcScore;

  return {
    isAnomalous: score >= scoreThreshold,
    score,
    scoreThreshold,
    edgeLengthRatio,
    areaDriftPercent,
    lineLengthDriftPercent,
    vertexDriftPercent,
    triangleShareDriftPercent,
    triangleEdgeToBBoxRatio,
    topoSharedArcRatioPercent,
    selfIntersectionCount,
    reasons,
  };
};

const repairCollectionSelfIntersections = (
  collection: FeatureCollection,
  geometryOps: GeometryOps,
  engine: GeometryEngine,
  options?: { sourceKey?: string; maxIssueRecords?: number },
): { collection: FeatureCollection; repairedFeatureCount: number; repairedIssues: TransformIssueEntry[] } => {
  let repairedFeatureCount = 0;
  const repairedFeatures: Feature[] = [];
  const repairedIssues: TransformIssueEntry[] = [];
  const maxIssueRecords = Math.max(0, options?.maxIssueRecords ?? 120);
  for (const [featureIndex, feature] of collection.features.entries()) {
    const geometry = feature?.geometry;
    if (!geometry) {
      repairedFeatures.push(feature);
      continue;
    }
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
      repairedFeatures.push(feature);
      continue;
    }
    if (geometryOps.isValid(geometry)) {
      repairedFeatures.push(feature);
      continue;
    }
    try {
      const polygons = geometryUnkinkPolygons(feature as Feature<Polygon | MultiPolygon>, engine);
      if (!Array.isArray(polygons) || polygons.length === 0) {
        repairedFeatures.push(feature);
        continue;
      }
      const singlePolygon = polygons.length === 1 ? polygons[0] : null;
      if (polygons.length === 1 && !singlePolygon) {
        repairedFeatures.push(feature);
        continue;
      }
      const repairedGeometry: Polygon | MultiPolygon = singlePolygon
        ? singlePolygon
        : { type: 'MultiPolygon', coordinates: polygons.map((polygon) => polygon.coordinates) };
      if (!geometryOps.isValid(repairedGeometry)) {
        repairedFeatures.push(feature);
        continue;
      }
      repairedFeatureCount += 1;
      if (repairedIssues.length < maxIssueRecords) {
        const featureId = resolveFeatureIdentifier(feature, featureIndex, options?.sourceKey);
        const lineFeaturesCandidate = buildErrorLineFeatures(repairedGeometry, featureId);
        repairedIssues.push({
          featureIndex,
          featureId,
          issueStage: 'simplify-only',
          issueKind: 'self-intersection-repaired',
          message: 'self-intersection repaired after simplify',
          geometryType: lineFeaturesCandidate?.geometryType ?? repairedGeometry.type,
          polygonCount: lineFeaturesCandidate?.polygonCount ?? countPolygonsFromGeometry(repairedGeometry),
          ringCount: lineFeaturesCandidate?.ringCount ?? 0,
          lineFeatures: toLineFeatureCollection(lineFeaturesCandidate),
        });
      }
      repairedFeatures.push({
        ...feature,
        geometry: repairedGeometry,
      });
    } catch {
      repairedFeatures.push(feature);
    }
  }
  if (repairedFeatureCount === 0) {
    return { collection, repairedFeatureCount, repairedIssues };
  }
  return {
    collection: {
      ...collection,
      features: repairedFeatures,
    },
    repairedFeatureCount,
    repairedIssues,
  };
};

type BoundaryLayerSummary = {
  featureCount: number;
  vertexCount: number;
  maxVertexCount: number;
  geometryTypes: Record<string, number>;
};

type BoundaryDiagnostics = {
  totalFeatures: number;
  totalVertices: number;
  maxVertices: number;
  layers: Record<string, BoundaryLayerSummary>;
};

const buildBoundaryDiagnostics = (collection: FeatureCollection): BoundaryDiagnostics | null => {
  const layers: Record<string, BoundaryLayerSummary> = {};
  let totalFeatures = 0;
  let totalVertices = 0;
  let maxVertices = 0;
  for (const feature of collection.features) {
    if (!feature) continue;
    const props = feature.properties as Record<string, unknown> | undefined;
    const layer = typeof props?.layer === 'string' ? props.layer : 'unknown';
    if (!layer.endsWith('-boundary')) continue;
    const geometryType = feature.geometry?.type ?? 'unknown';
    const vertexCount = countVerticesFromGeometry(feature.geometry);
    totalFeatures += 1;
    totalVertices += vertexCount;
    maxVertices = Math.max(maxVertices, vertexCount);
    const summary = layers[layer] ?? {
      featureCount: 0,
      vertexCount: 0,
      maxVertexCount: 0,
      geometryTypes: {},
    };
    summary.featureCount += 1;
    summary.vertexCount += vertexCount;
    summary.maxVertexCount = Math.max(summary.maxVertexCount, vertexCount);
    summary.geometryTypes[geometryType] = (summary.geometryTypes[geometryType] ?? 0) + 1;
    layers[layer] = summary;
  }
  if (totalFeatures === 0) return null;
  return {
    totalFeatures,
    totalVertices,
    maxVertices,
    layers,
  };
};

const validateOutputForVt = (collection: FeatureCollection): GeojsonValidationIssue[] => {
  const issues: GeojsonValidationIssue[] = [];
  for (let index = 0; index < collection.features.length; index += 1) {
    const feature = collection.features[index];
    if (!feature) continue;
    const props = feature.properties as Record<string, unknown> | undefined;
    const layer = typeof props?.layer === 'string' ? props.layer : 'unknown';
    const featureId = String(feature.id ?? props?.id ?? props?.boundaryID ?? props?.boundaryISO ?? `${layer}:${index}`);
    const reason = validateGeometryForVt(feature.geometry ?? null);
    if (!reason) continue;
    const geometryType = feature.geometry?.type ?? 'unknown';
    const vertexCount = countVerticesFromGeometry(feature.geometry);
    let sampleCoords: number[][] | undefined;
    if (feature.geometry?.type === 'LineString') {
      sampleCoords = (feature.geometry.coordinates ?? []).slice(0, 3) as number[][];
    } else if (feature.geometry?.type === 'Polygon') {
      sampleCoords = (feature.geometry.coordinates?.[0] ?? []).slice(0, 3) as number[][];
    } else if (feature.geometry?.type === 'MultiPolygon') {
      sampleCoords = (feature.geometry.coordinates?.[0]?.[0] ?? []).slice(0, 3) as number[][];
    }
    issues.push({
      layer,
      featureId,
      geometryType,
      vertexCount,
      reason,
      ...(sampleCoords ? { sampleCoords } : {}),
    });
  }
  return issues;
};

const clampTileIndex = (value: number, maxIndex: number): number => (
  Math.min(maxIndex, Math.max(0, value))
);

const toDeg = (radians: number): number => radians * 180 / Math.PI;

const tileToBBox = (z: number, x: number, y: number): { minX: number; minY: number; maxX: number; maxY: number } => {
  const n = 2 ** z;
  const lon1 = x / n * 360 - 180;
  const lon2 = (x + 1) / n * 360 - 180;
  const lat1 = toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))));
  const lat2 = toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))));
  return { minX: lon1, minY: lat2, maxX: lon2, maxY: lat1 };
};

const isPointInBBox = (x: number, y: number, bbox: { minX: number; minY: number; maxX: number; maxY: number }): boolean => (
  x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY
);

const isAnyPointInBBox = (geometry: Feature['geometry'], bbox: { minX: number; minY: number; maxX: number; maxY: number }): boolean => {
  if (!geometry) return false;
  if (geometry.type === 'Point') {
    const [x, y] = geometry.coordinates ?? [];
    if (typeof x !== 'number' || typeof y !== 'number') return false;
    return isPointInBBox(x, y, bbox);
  }
  if (geometry.type === 'MultiPoint') {
    for (const point of geometry.coordinates) {
      const [x, y] = point ?? [];
      if (typeof x !== 'number' || typeof y !== 'number') continue;
      if (isPointInBBox(x, y, bbox)) return true;
    }
    return false;
  }
  return false;
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

const isLineOrPolygonFeature = (
  feature: Feature<Geometry>,
): feature is Feature<LineString | MultiLineString | Polygon | MultiPolygon> => {
  const type = feature.geometry?.type;
  return type === 'LineString'
    || type === 'MultiLineString'
    || type === 'Polygon'
    || type === 'MultiPolygon';
};

const featureIntersectsTileBBox = (
  feature: Feature<Geometry>,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
  geometryOps: GeometryOps,
): boolean => {
  if (isAnyPointInBBox(feature.geometry ?? null, bbox)) return true;
  if (!isLineOrPolygonFeature(feature)) return false;
  return geometryOps.intersectsBBox(feature, bbox);
};

const collectTileIdsForCollection = (
  collection: FeatureCollection,
  zBase: number,
  geometryOps: GeometryOps,
): number[] => {
  if (!Number.isFinite(zBase) || zBase < 0) return [];
  const maxIndex = (1 << zBase) - 1;
  const tileIds = new Set<number>();
  for (const feature of collection.features) {
    if (!feature?.geometry) continue;
    const bbox = geometryOps.bbox(feature as Feature<Geometry>);
    if (!bbox) continue;
    const [minLon, minLat, maxLon, maxLat] = bbox;
    if (![minLon, minLat, maxLon, maxLat].every((value) => Number.isFinite(value))) continue;
    const x1Raw = lonToTileX(minLon, zBase);
    const x2Raw = lonToTileX(maxLon, zBase);
    const y1Raw = latToTileY(maxLat, zBase);
    const y2Raw = latToTileY(minLat, zBase);
    if (![x1Raw, x2Raw, y1Raw, y2Raw].every((value) => Number.isFinite(value))) continue;
    const x1 = clampTileIndex(x1Raw as number, maxIndex);
    const x2 = clampTileIndex(x2Raw as number, maxIndex);
    const y1 = clampTileIndex(y1Raw as number, maxIndex);
    const y2 = clampTileIndex(y2Raw as number, maxIndex);
    for (let x = x1; x <= x2; x += 1) {
      for (let y = y1; y <= y2; y += 1) {
        const tileBBox = tileToBBox(zBase, x, y);
        if (!featureIntersectsTileBBox(feature as Feature<Geometry>, tileBBox, geometryOps)) continue;
        tileIds.add(packTileId(x, y, zBase));
      }
    }
  }
  return [...tileIds];
};

type ErrorRingRole = 'outline' | 'hole';
type ErrorLineProperties = {
  ringRole: ErrorRingRole;
  polygonIndex: number;
  ringIndex: number;
  featureId?: string;
};

type TransformIssueLineFeatures = {
  type: 'FeatureCollection';
  features: Array<Feature<LineString, ErrorLineProperties>>;
};

type TransformIssueEntry = {
  featureIndex: number;
  featureId: string;
  issueStage: string;
  issueKind: string;
  message: string;
  geometryType?: string;
  polygonCount: number;
  ringCount: number;
  lineFeatures: TransformIssueLineFeatures;
};

const buildErrorLineFeatures = (
  geometry: Geometry,
  featureId?: string,
): { features: Array<Feature<LineString, ErrorLineProperties>>; polygonCount: number; ringCount: number; geometryType: string } | null => {
  const features: Array<Feature<LineString, ErrorLineProperties>> = [];
  let polygonCount = 0;
  let ringCount = 0;
  const pushRing = (ring: number[][], ringRole: ErrorRingRole, polygonIndex: number, ringIndex: number) => {
    if (!Array.isArray(ring) || ring.length < 2) return;
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: ring },
      properties: { ringRole, polygonIndex, ringIndex, featureId },
    });
    ringCount += 1;
  };
  if (geometry.type === 'Polygon') {
    const rings = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    polygonCount = rings.length > 0 ? 1 : 0;
    rings.forEach((ring, index) => {
      const ringRole: ErrorRingRole = index === 0 ? 'outline' : 'hole';
      pushRing(ring as number[][], ringRole, 0, index);
    });
  } else if (geometry.type === 'MultiPolygon') {
    const polygons = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    polygonCount = polygons.length;
    polygons.forEach((rings, polygonIndex) => {
      (rings ?? []).forEach((ring, ringIndex) => {
        const ringRole: ErrorRingRole = ringIndex === 0 ? 'outline' : 'hole';
        pushRing(ring as number[][], ringRole, polygonIndex, ringIndex);
      });
    });
  } else {
    return null;
  }
  return features.length ? { features, polygonCount, ringCount, geometryType: geometry.type } : null;
};

const toLineFeatureCollection = (
  lineFeaturesCandidate: ReturnType<typeof buildErrorLineFeatures> | null,
): TransformIssueLineFeatures => ({
  type: 'FeatureCollection',
  features: lineFeaturesCandidate?.features ?? [],
});

const resolveFeatureIdentifier = (
  feature: Feature | null | undefined,
  featureIndex: number,
  sourceKey?: string,
): string => {
  const properties = (feature?.properties ?? null) as Record<string, unknown> | null;
  const metadataFeatureId = properties?.__hdbFeatureId;
  const rawFeatureId = (typeof metadataFeatureId === 'string' && metadataFeatureId.trim().length > 0)
    ? metadataFeatureId
    : (feature?.id ?? (properties && 'id' in properties ? String(properties.id) : undefined));
  if (rawFeatureId != null) {
    return String(rawFeatureId);
  }
  return `${sourceKey ?? 'feature'}:${featureIndex}`;
};

type GeometryIssueSummary = {
  geometryType: string;
  polygonCount: number;
  ringCount: number;
  errorPolygonCount: number;
  errorRingCount: number;
  emptyRingCount: number;
  invalidRingCount: number;
  openRingCount: number;
  nonFiniteCoordCount: number;
  minRingVertices: number | null;
  maxRingVertices: number | null;
  avgRingVertices: number | null;
  degenerateRingCount: number;
  duplicateVertexCount: number;
  minRingArea: number | null;
  maxRingArea: number | null;
  selfIntersectionCount: number;
};

type PolygonRingSummary = {
  emptyRingCount: number;
  invalidRingCount: number;
  openRingCount: number;
  nonFiniteCoordCount: number;
  ringVertices: number;
  ringArea: number | null;
  degenerateRingCount: number;
  duplicateVertexCount: number;
  hasIssue: boolean;
};

const isSameCoord = (a?: number[], b?: number[]): boolean => {
  if (!a || !b) return false;
  return a[0] === b[0] && a[1] === b[1];
};

const countDuplicateVertices = (ring: number[][]): number => {
  let count = 0;
  for (let index = 1; index < ring.length; index += 1) {
    if (isSameCoord(ring[index], ring[index - 1])) {
      count += 1;
    }
  }
  return count;
};

const computeRingArea = (ring: number[][]): number | null => {
  if (ring.length < 3) return null;
  const isClosed = ring.length > 2 && isSameCoord(ring[0], ring[ring.length - 1]);
  const coords = isClosed ? ring.slice(0, -1) : ring;
  if (coords.length < 3) return null;
  let sum = 0;
  for (let index = 0; index < coords.length; index += 1) {
    const coord1 = coords[index];
    const coord2 = coords[(index + 1) % coords.length];
    if (!coord1 || !coord2) continue;
    if (coord1.length < 2 || coord2.length < 2) continue;
    const x1 = coord1[0];
    const y1 = coord1[1];
    const x2 = coord2[0];
    const y2 = coord2[1];
    if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) continue;
    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
      continue;
    }
    sum += (x1 * y2) - (x2 * y1);
  }
  return sum / 2;
};

const dedupeConsecutiveCoords = (coords: number[][], epsilon: number): number[][] => {
  if (coords.length === 0) return coords;
  if (epsilon <= 0) return coords;
  const deduped: number[][] = [coords[0] as number[]];
  for (let index = 1; index < coords.length; index += 1) {
    const current = coords[index];
    const previous = deduped[deduped.length - 1];
    if (!current || !previous) continue;
    const dx = Math.abs((current[0] ?? 0) - (previous[0] ?? 0));
    const dy = Math.abs((current[1] ?? 0) - (previous[1] ?? 0));
    if (dx <= epsilon && dy <= epsilon) continue;
    deduped.push(current);
  }
  return deduped;
};

const isNestedCoordinateEqual = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (!isNestedCoordinateEqual(left[index], right[index])) return false;
    }
    return true;
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return left === right;
  }
  return false;
};

const isGeometryEquivalent = (left: Geometry, right: Geometry): boolean => {
  if (left.type !== right.type) return false;
  if (left.type === 'GeometryCollection' && right.type === 'GeometryCollection') {
    const leftChildren = left.geometries ?? [];
    const rightChildren = right.geometries ?? [];
    if (leftChildren.length !== rightChildren.length) return false;
    for (let index = 0; index < leftChildren.length; index += 1) {
      const leftChild = leftChildren[index];
      const rightChild = rightChildren[index];
      if (!leftChild || !rightChild) return false;
      if (!isGeometryEquivalent(leftChild, rightChild)) return false;
    }
    return true;
  }
  const leftCoordinates = left as { coordinates?: unknown };
  const rightCoordinates = right as { coordinates?: unknown };
  return isNestedCoordinateEqual(leftCoordinates.coordinates, rightCoordinates.coordinates);
};

const ensureClosedRingCoords = (ring: number[][]): number[][] => {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (isSameCoord(first, last)) return ring;
  return [...ring, first as number[]];
};

const normalizeRingOrientation = (ring: number[][], clockwise: boolean): number[][] => {
  const area = computeRingArea(ring);
  if (area === null || Math.abs(area) < 1e-15) return ring;
  const isClockwise = area < 0;
  if (isClockwise === clockwise) return ring;
  return [...ring].reverse();
};

const sanitizePolygonRings = (params: {
  rings: number[][][];
  epsilon: number;
  minRingAreaThreshold: number;
  normalizeOrientation: boolean;
}): number[][][] => {
  const out: number[][][] = [];
  for (let index = 0; index < params.rings.length; index += 1) {
    const ring = params.rings[index];
    if (!Array.isArray(ring)) continue;
    let nextRing = dedupeConsecutiveCoords(ring as number[][], params.epsilon);
    nextRing = ensureClosedRingCoords(nextRing);
    if (nextRing.length < 4) continue;
    const area = computeRingArea(nextRing);
    if (area === null) continue;
    if (params.minRingAreaThreshold > 0 && Math.abs(area) < params.minRingAreaThreshold) {
      continue;
    }
    if (params.normalizeOrientation) {
      const isOuter = index === 0;
      nextRing = normalizeRingOrientation(nextRing, !isOuter);
    }
    out.push(nextRing);
  }
  return out;
};

const sanitizeGeometryForIntakeGuard = (params: {
  geometry: Geometry;
  epsilon: number;
  minRingAreaThreshold: number;
  normalizeRingOrientation: boolean;
}): Geometry | null => {
  const { geometry } = params;
  if (geometry.type === 'LineString') {
    const deduped = dedupeConsecutiveCoords(geometry.coordinates as number[][], params.epsilon);
    if (deduped.length < 2) return null;
    if (isNestedCoordinateEqual(deduped, geometry.coordinates)) {
      return geometry;
    }
    return { ...geometry, coordinates: deduped };
  }
  if (geometry.type === 'MultiLineString') {
    const lines = (geometry.coordinates ?? [])
      .map((line) => dedupeConsecutiveCoords(line as number[][], params.epsilon))
      .filter((line) => line.length >= 2);
    if (lines.length === 0) return null;
    if (isNestedCoordinateEqual(lines, geometry.coordinates)) {
      return geometry;
    }
    return { ...geometry, coordinates: lines };
  }
  if (geometry.type === 'Polygon') {
    const rings = sanitizePolygonRings({
      rings: geometry.coordinates as number[][][],
      epsilon: params.epsilon,
      minRingAreaThreshold: params.minRingAreaThreshold,
      normalizeOrientation: params.normalizeRingOrientation,
    });
    if (rings.length === 0) return null;
    if (isNestedCoordinateEqual(rings, geometry.coordinates)) {
      return geometry;
    }
    return { ...geometry, coordinates: rings };
  }
  if (geometry.type === 'MultiPolygon') {
    const polygons = (geometry.coordinates ?? [])
      .map((polygon) => sanitizePolygonRings({
        rings: polygon as number[][][],
        epsilon: params.epsilon,
        minRingAreaThreshold: params.minRingAreaThreshold,
        normalizeOrientation: params.normalizeRingOrientation,
      }))
      .filter((polygon) => polygon.length > 0);
    if (polygons.length === 0) return null;
    if (isNestedCoordinateEqual(polygons, geometry.coordinates)) {
      return geometry;
    }
    return { ...geometry, coordinates: polygons };
  }
  if (geometry.type === 'GeometryCollection') {
    const originalChildren = geometry.geometries ?? [];
    let changed = false;
    const geometries = (geometry.geometries ?? [])
      .map((child) => sanitizeGeometryForIntakeGuard({
        geometry: child,
        epsilon: params.epsilon,
        minRingAreaThreshold: params.minRingAreaThreshold,
        normalizeRingOrientation: params.normalizeRingOrientation,
      }))
      .filter((child): child is Geometry => {
        if (!child) {
          changed = true;
          return false;
        }
        return true;
      });
    if (geometries.length === 0) return null;
    if (!changed && geometries.length === originalChildren.length) {
      changed = geometries.some((child, index) => {
        const originalChild = originalChildren[index];
        if (!originalChild) return true;
        return !isGeometryEquivalent(child, originalChild);
      });
    }
    if (!changed) {
      return geometry;
    }
    return { ...geometry, geometries };
  }
  return geometry;
};

const applyGeometryIntakeGuard = (params: {
  collection: FeatureCollection;
  validationLevel: 'off' | 'basic' | 'strict';
  dedupeEpsilon: number;
  minRingAreaThreshold: number;
  normalizeRingOrientation: boolean;
  geometryOps: GeometryOps;
  sourceKey?: string;
  maxIssueRecords?: number;
}): {
  collection: FeatureCollection;
  modifiedFeatureCount: number;
  droppedFeatureCount: number;
  validCheckCount: number;
  issueCount: number;
  issues: TransformIssueEntry[];
} => {
  if (params.validationLevel === 'off') {
    return {
      collection: params.collection,
      modifiedFeatureCount: 0,
      droppedFeatureCount: 0,
      validCheckCount: 0,
      issueCount: 0,
      issues: [],
    };
  }
  let modifiedFeatureCount = 0;
  let droppedFeatureCount = 0;
  let validCheckCount = 0;
  let issueCount = 0;
  const maxIssueRecords = Math.max(0, params.maxIssueRecords ?? 120);
  const issues: TransformIssueEntry[] = [];
  const pushIssue = (entry: TransformIssueEntry) => {
    issueCount += 1;
    if (issues.length < maxIssueRecords) {
      issues.push(entry);
    }
  };
  const features: Feature[] = [];
  for (const [featureIndex, feature] of params.collection.features.entries()) {
    const featureId = resolveFeatureIdentifier(feature, featureIndex, params.sourceKey);
    if (!feature?.geometry) {
      if (params.validationLevel === 'strict') {
        droppedFeatureCount += 1;
        pushIssue({
          featureIndex,
          featureId,
          issueStage: 'intake-guard',
          issueKind: 'strict-missing-geometry',
          message: 'intake guard dropped feature without geometry',
          geometryType: 'unknown',
          polygonCount: 0,
          ringCount: 0,
          lineFeatures: { type: 'FeatureCollection', features: [] },
        });
        continue;
      }
      features.push(feature);
      continue;
    }
    const normalizedGeometry = sanitizeGeometryForIntakeGuard({
      geometry: feature.geometry,
      epsilon: Math.max(0, params.dedupeEpsilon),
      minRingAreaThreshold: Math.max(0, params.minRingAreaThreshold),
      normalizeRingOrientation: params.normalizeRingOrientation,
    });
    if (!normalizedGeometry) {
      droppedFeatureCount += 1;
      const lineFeaturesCandidate = buildErrorLineFeatures(feature.geometry, featureId);
      pushIssue({
        featureIndex,
        featureId,
        issueStage: 'intake-guard',
        issueKind: 'dropped-degenerate',
        message: 'intake guard dropped degenerate geometry',
        geometryType: lineFeaturesCandidate?.geometryType ?? feature.geometry.type,
        polygonCount: lineFeaturesCandidate?.polygonCount ?? countPolygonsFromGeometry(feature.geometry),
        ringCount: lineFeaturesCandidate?.ringCount ?? 0,
        lineFeatures: toLineFeatureCollection(lineFeaturesCandidate),
      });
      continue;
    }
    if (params.validationLevel === 'strict') {
      validCheckCount += 1;
      const valid = params.geometryOps.isValid(normalizedGeometry);
      if (!valid) {
        droppedFeatureCount += 1;
        const lineFeaturesCandidate = buildErrorLineFeatures(normalizedGeometry, featureId);
        pushIssue({
          featureIndex,
          featureId,
          issueStage: 'intake-guard',
          issueKind: 'strict-invalid',
          message: 'intake guard strict validation dropped invalid geometry',
          geometryType: lineFeaturesCandidate?.geometryType ?? normalizedGeometry.type,
          polygonCount: lineFeaturesCandidate?.polygonCount ?? countPolygonsFromGeometry(normalizedGeometry),
          ringCount: lineFeaturesCandidate?.ringCount ?? 0,
          lineFeatures: toLineFeatureCollection(lineFeaturesCandidate),
        });
        continue;
      }
    }
    if (normalizedGeometry !== feature.geometry) {
      modifiedFeatureCount += 1;
      const lineFeaturesCandidate = buildErrorLineFeatures(normalizedGeometry, featureId);
      pushIssue({
        featureIndex,
        featureId,
        issueStage: 'intake-guard',
        issueKind: 'normalized',
        message: 'intake guard normalized geometry',
        geometryType: lineFeaturesCandidate?.geometryType ?? normalizedGeometry.type,
        polygonCount: lineFeaturesCandidate?.polygonCount ?? countPolygonsFromGeometry(normalizedGeometry),
        ringCount: lineFeaturesCandidate?.ringCount ?? 0,
        lineFeatures: toLineFeatureCollection(lineFeaturesCandidate),
      });
    }
    features.push({
      ...feature,
      geometry: normalizedGeometry,
    });
  }
  return {
    collection: {
      ...params.collection,
      features,
    },
    modifiedFeatureCount,
    droppedFeatureCount,
    validCheckCount,
    issueCount,
    issues,
  };
};

export const __test_applyGeometryIntakeGuard = applyGeometryIntakeGuard;

const countSelfIntersections = (geometry: Geometry, geometryOps: GeometryOps): number => (
  geometryOps.countSelfIntersections(geometry)
);

const analyzePolygonRing = (ring: number[][]): PolygonRingSummary => {
  const ringVertices = ring.length;
  let nonFiniteCoordCount = 0;
  for (const point of ring) {
    if (!Array.isArray(point) || point.length < 2) {
      nonFiniteCoordCount += 1;
      continue;
    }
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
      nonFiniteCoordCount += 1;
    }
  }
  const emptyRingCount = ringVertices === 0 ? 1 : 0;
  const invalidRingCount = ringVertices > 0 && ringVertices < 4 ? 1 : 0;
  const openRingCount = (() => {
    if (ringVertices < 2) return 0;
    const first = ring[0];
    const last = ring[ringVertices - 1];
    if (!first || !last) return 0;
    return (first[0] !== last[0] || first[1] !== last[1]) ? 1 : 0;
  })();
  const ringArea = computeRingArea(ring);
  const degenerateRingCount = ringArea !== null && Math.abs(ringArea) < 1e-12 ? 1 : 0;
  const duplicateVertexCount = countDuplicateVertices(ring);
  const hasIssue = emptyRingCount > 0
    || invalidRingCount > 0
    || openRingCount > 0
    || nonFiniteCoordCount > 0
    || degenerateRingCount > 0
    || duplicateVertexCount > 0;
  return {
    emptyRingCount,
    invalidRingCount,
    openRingCount,
    nonFiniteCoordCount,
    ringVertices,
    ringArea,
    degenerateRingCount,
    duplicateVertexCount,
    hasIssue,
  };
};

const analyzePolygon = (rings: number[][][]): Omit<GeometryIssueSummary, 'geometryType'> => {
  let emptyRingCount = 0;
  let invalidRingCount = 0;
  let openRingCount = 0;
  let nonFiniteCoordCount = 0;
  let minRingVertices: number | null = null;
  let maxRingVertices: number | null = null;
  let ringVertexTotal = 0;
  let ringCount = 0;
  let errorRingCount = 0;
  let errorPolygonCount = 0;
  let polygonHasIssue = false;
  let degenerateRingCount = 0;
  let duplicateVertexCount = 0;
  let minRingArea: number | null = null;
  let maxRingArea: number | null = null;
  for (const ring of rings) {
    const result = analyzePolygonRing(ring ?? []);
    emptyRingCount += result.emptyRingCount;
    invalidRingCount += result.invalidRingCount;
    openRingCount += result.openRingCount;
    nonFiniteCoordCount += result.nonFiniteCoordCount;
    degenerateRingCount += result.degenerateRingCount;
    duplicateVertexCount += result.duplicateVertexCount;
    ringCount += 1;
    ringVertexTotal += result.ringVertices;
    if (minRingVertices === null || result.ringVertices < minRingVertices) {
      minRingVertices = result.ringVertices;
    }
    if (maxRingVertices === null || result.ringVertices > maxRingVertices) {
      maxRingVertices = result.ringVertices;
    }
    if (typeof result.ringArea === 'number') {
      minRingArea = minRingArea === null ? result.ringArea : Math.min(minRingArea, result.ringArea);
      maxRingArea = maxRingArea === null ? result.ringArea : Math.max(maxRingArea, result.ringArea);
    }
    if (result.hasIssue) {
      errorRingCount += 1;
      polygonHasIssue = true;
    }
  }
  errorPolygonCount = polygonHasIssue ? 1 : 0;
  return {
    polygonCount: 1,
    ringCount,
    errorPolygonCount,
    errorRingCount,
    emptyRingCount,
    invalidRingCount,
    openRingCount,
    nonFiniteCoordCount,
    minRingVertices,
    maxRingVertices,
    avgRingVertices: ringCount > 0 ? ringVertexTotal / ringCount : null,
    degenerateRingCount,
    duplicateVertexCount,
    minRingArea,
    maxRingArea,
    selfIntersectionCount: 0,
  };
};

const buildEmptyGeometrySummary = (geometryType: string): GeometryIssueSummary => ({
  geometryType,
  polygonCount: 0,
  ringCount: 0,
  errorPolygonCount: 0,
  errorRingCount: 0,
  emptyRingCount: 0,
  invalidRingCount: 0,
  openRingCount: 0,
  nonFiniteCoordCount: 0,
  minRingVertices: null,
  maxRingVertices: null,
  avgRingVertices: null,
  degenerateRingCount: 0,
  duplicateVertexCount: 0,
  minRingArea: null,
  maxRingArea: null,
  selfIntersectionCount: 0,
});

const analyzeGeometryIssues = (geometry: Geometry | null | undefined, geometryOps: GeometryOps): GeometryIssueSummary => {
  if (!geometry) return buildEmptyGeometrySummary('none');

  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    let ringVertexTotal = 0;
    let ringCount = 0;
    const summary = geometries.reduce<GeometryIssueSummary>((acc, child) => {
      const childSummary = analyzeGeometryIssues(child, geometryOps);
      acc.polygonCount += childSummary.polygonCount;
      acc.ringCount += childSummary.ringCount;
      acc.errorPolygonCount += childSummary.errorPolygonCount;
      acc.errorRingCount += childSummary.errorRingCount;
      acc.emptyRingCount += childSummary.emptyRingCount;
      acc.invalidRingCount += childSummary.invalidRingCount;
      acc.openRingCount += childSummary.openRingCount;
      acc.nonFiniteCoordCount += childSummary.nonFiniteCoordCount;
      acc.degenerateRingCount += childSummary.degenerateRingCount;
      acc.duplicateVertexCount += childSummary.duplicateVertexCount;
      acc.selfIntersectionCount += childSummary.selfIntersectionCount;
      if (childSummary.minRingVertices !== null) {
        acc.minRingVertices = acc.minRingVertices === null
          ? childSummary.minRingVertices
          : Math.min(acc.minRingVertices, childSummary.minRingVertices);
      }
      if (childSummary.maxRingVertices !== null) {
        acc.maxRingVertices = acc.maxRingVertices === null
          ? childSummary.maxRingVertices
          : Math.max(acc.maxRingVertices, childSummary.maxRingVertices);
      }
      if (childSummary.minRingArea !== null) {
        acc.minRingArea = acc.minRingArea === null
          ? childSummary.minRingArea
          : Math.min(acc.minRingArea, childSummary.minRingArea);
      }
      if (childSummary.maxRingArea !== null) {
        acc.maxRingArea = acc.maxRingArea === null
          ? childSummary.maxRingArea
          : Math.max(acc.maxRingArea, childSummary.maxRingArea);
      }
      if (childSummary.avgRingVertices !== null && childSummary.ringCount > 0) {
        ringVertexTotal += childSummary.avgRingVertices * childSummary.ringCount;
        ringCount += childSummary.ringCount;
      }
      acc.geometryType = `${acc.geometryType}+${childSummary.geometryType}`;
      return acc;
    }, buildEmptyGeometrySummary('GeometryCollection'));
    summary.avgRingVertices = ringCount > 0 ? ringVertexTotal / ringCount : null;
    return summary;
  }

    if (geometry.type === 'Polygon') {
      const rings = Array.isArray(geometry.coordinates)
        ? (geometry.coordinates as number[][][])
        : [];
      const summary = {
        geometryType: 'Polygon',
        ...analyzePolygon(rings),
        selfIntersectionCount: countSelfIntersections(geometry, geometryOps),
      };
      if (summary.selfIntersectionCount > 0 && summary.errorPolygonCount === 0 && summary.polygonCount > 0) {
        summary.errorPolygonCount = summary.polygonCount;
      }
      return summary;
    }

  if (geometry.type === 'MultiPolygon') {
    const polygons = Array.isArray(geometry.coordinates)
      ? (geometry.coordinates as number[][][][])
      : [];
    let ringVertexTotal = 0;
    let ringCount = 0;
    const summary = polygons.reduce<GeometryIssueSummary>((acc, polygon) => {
      const child = analyzePolygon(polygon ?? []);
      acc.polygonCount += child.polygonCount;
      acc.ringCount += child.ringCount;
      acc.errorPolygonCount += child.errorPolygonCount;
      acc.errorRingCount += child.errorRingCount;
      acc.emptyRingCount += child.emptyRingCount;
      acc.invalidRingCount += child.invalidRingCount;
      acc.openRingCount += child.openRingCount;
      acc.nonFiniteCoordCount += child.nonFiniteCoordCount;
      acc.degenerateRingCount += child.degenerateRingCount;
      acc.duplicateVertexCount += child.duplicateVertexCount;
      if (child.minRingVertices !== null) {
        acc.minRingVertices = acc.minRingVertices === null
          ? child.minRingVertices
          : Math.min(acc.minRingVertices, child.minRingVertices);
      }
      if (child.maxRingVertices !== null) {
        acc.maxRingVertices = acc.maxRingVertices === null
          ? child.maxRingVertices
          : Math.max(acc.maxRingVertices, child.maxRingVertices);
      }
      if (child.minRingArea !== null) {
        acc.minRingArea = acc.minRingArea === null
          ? child.minRingArea
          : Math.min(acc.minRingArea, child.minRingArea);
      }
      if (child.maxRingArea !== null) {
        acc.maxRingArea = acc.maxRingArea === null
          ? child.maxRingArea
          : Math.max(acc.maxRingArea, child.maxRingArea);
      }
      if (child.avgRingVertices !== null && child.ringCount > 0) {
        ringVertexTotal += child.avgRingVertices * child.ringCount;
        ringCount += child.ringCount;
      }
      return acc;
    }, buildEmptyGeometrySummary('MultiPolygon'));
    summary.selfIntersectionCount = countSelfIntersections(geometry, geometryOps);
    if (summary.selfIntersectionCount > 0 && summary.errorPolygonCount === 0 && summary.polygonCount > 0) {
      summary.errorPolygonCount = summary.polygonCount;
    }
    summary.avgRingVertices = ringCount > 0 ? ringVertexTotal / ringCount : null;
    return summary;
  }

  return buildEmptyGeometrySummary(geometry.type);
};


const isGeometryBooleanValid = (geometry: Geometry | null | undefined, geometryOps: GeometryOps): boolean => (
  geometryOps.isValid(geometry)
);

const filterFeaturesByAspectRatioAndArea = (
  features: Feature[],
  aspectRatioThreshold: number,
  areaThreshold: number,
  geometryOps: GeometryOps,
): Feature[] => {
  if (aspectRatioThreshold <= 0 && areaThreshold <= 0) return features;
  return features.filter((feature) => {
    if (!feature?.geometry) return false;
    if (areaThreshold > 0) {
      const areaSqKm = geometryOps.area(feature as Feature<Geometry>) / 1_000_000;
      if (areaSqKm < areaThreshold) return false;
    }
    if (aspectRatioThreshold > 0) {
      const bbox = geometryOps.bbox(feature as Feature<Geometry>);
      if (!bbox) return false;
      const [minX, minY, maxX, maxY] = bbox;
      const width = Math.abs(maxX - minX);
      const height = Math.abs(maxY - minY);
      const ratio = width === 0 || height === 0 ? Number.POSITIVE_INFINITY : Math.max(width / height, height / width);
      if (ratio > aspectRatioThreshold) return false;
    }
    return true;
  });
};

const assertNotAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new Error('task aborted');
  }
};

const formatArea = (value: number | null): string => (
  value === null || !Number.isFinite(value) ? '-' : value.toExponential(2)
);

const formatAverage = (value: number | null): string => (
  value === null || !Number.isFinite(value) ? '-' : value.toFixed(2)
);

const formatToleranceForDisplay = (value: number): number => (
  Number.isFinite(value) ? Number(value.toFixed(4)) : value
);

const runStageWithLabel = async <T>(label: string, fn: () => T | Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    throw new Error(`stage=${label} ${err}`);
  }
};

const runWithStallTimeout = async <T>(params: {
  promise: Promise<T>;
  stage: string;
  nodeId: string;
  taskId: string;
  timeoutMs: number;
  getLastProgressAt: () => number;
  heartbeatMs?: number;
}): Promise<T> => {
  const {
    promise,
    stage,
    nodeId,
    taskId,
    timeoutMs,
    getLastProgressAt,
    heartbeatMs = 30000,
  } = params;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let lastHeartbeatAt = Date.now();
  const stallPromise = new Promise<never>((_resolve, reject) => {
    intervalId = setInterval(() => {
      const now = Date.now();
      const lastProgressAt = getLastProgressAt();
      const idleMs = now - lastProgressAt;
      if (idleMs >= timeoutMs) {
        reject(new Error(`transform failed: ${stage} stalled (${idleMs}ms without progress)`));
        return;
      }
      if (now - lastHeartbeatAt >= heartbeatMs) {
        lastHeartbeatAt = now;
        console.warn('[transform] stage heartbeat', {
          nodeId,
          taskId,
          stage,
          idleMs,
        });
      }
    }, Math.min(heartbeatMs, 10000));
  });
  try {
    return await Promise.race([promise, stallPromise]);
  } finally {
    if (intervalId) {
      clearInterval(intervalId);
    }
  }
};

const buildCollectionDiagnostics = (
  collection: FeatureCollection | null,
  label: string,
  geometryOps: GeometryOps,
): string | null => {
  if (!collection) return null;
  const featureCount = collection.features.length;
  const missingGeometry = collection.features.filter((feature) => !feature?.geometry).length;
  const polygonCount = collection.features.reduce(
    (sum, feature) => sum + countPolygonsFromGeometry(feature?.geometry),
    0,
  );
  let invalidFeatureCount = 0;
  let invalidRingCount = 0;
  let openRingCount = 0;
  let emptyRingCount = 0;
  let nonFiniteCoordCount = 0;
  let minRingVertices: number | null = null;
  let maxRingVertices: number | null = null;
  let ringVertexTotal = 0;
  let ringCount = 0;
  let degenerateRingCount = 0;
  let duplicateVertexCount = 0;
  let selfIntersectionCount = 0;
  let minRingArea: number | null = null;
  let maxRingArea: number | null = null;
  const sampleDetails: string[] = [];
  for (const feature of collection.features) {
    if (!feature?.geometry) continue;
    const summary = analyzeGeometryIssues(feature.geometry, geometryOps);
    invalidRingCount += summary.invalidRingCount;
    openRingCount += summary.openRingCount;
    emptyRingCount += summary.emptyRingCount;
    nonFiniteCoordCount += summary.nonFiniteCoordCount;
    degenerateRingCount += summary.degenerateRingCount;
    duplicateVertexCount += summary.duplicateVertexCount;
    selfIntersectionCount += summary.selfIntersectionCount;
    const isValid = isGeometryBooleanValid(feature.geometry, geometryOps);
    if (!isValid) {
      invalidFeatureCount += 1;
    }
    if (summary.minRingVertices !== null) {
      minRingVertices = minRingVertices === null
        ? summary.minRingVertices
        : Math.min(minRingVertices, summary.minRingVertices);
    }
    if (summary.maxRingVertices !== null) {
      maxRingVertices = maxRingVertices === null
        ? summary.maxRingVertices
        : Math.max(maxRingVertices, summary.maxRingVertices);
    }
    if (summary.minRingArea !== null) {
      minRingArea = minRingArea === null
        ? summary.minRingArea
        : Math.min(minRingArea, summary.minRingArea);
    }
    if (summary.maxRingArea !== null) {
      maxRingArea = maxRingArea === null
        ? summary.maxRingArea
        : Math.max(maxRingArea, summary.maxRingArea);
    }
    if (summary.avgRingVertices !== null && summary.ringCount > 0) {
      ringVertexTotal += summary.avgRingVertices * summary.ringCount;
      ringCount += summary.ringCount;
    }
    if (sampleDetails.length < 3) {
      const featureId = feature.id
        ?? (feature.properties && 'id' in feature.properties ? String(feature.properties.id) : undefined)
        ?? `${label}:${sampleDetails.length}`;
      sampleDetails.push(
        `${featureId} type=${summary.geometryType} rings=${summary.ringCount} minRingVertices=${summary.minRingVertices ?? '-'} kinks=${summary.selfIntersectionCount} degenerateRings=${summary.degenerateRingCount} minRingArea=${formatArea(summary.minRingArea)} invalidRings=${summary.invalidRingCount} openRings=${summary.openRingCount} nonFinite=${summary.nonFiniteCoordCount} booleanValid=${isValid ? '1' : '0'}`,
      );
    }
  }
  const avgRingVertices = ringCount > 0 ? ringVertexTotal / ringCount : null;
  const summary = `${label} (features=${featureCount}, polygons=${polygonCount}, missingGeometry=${missingGeometry}, invalidFeatures=${invalidFeatureCount}) (invalidRings=${invalidRingCount}, openRings=${openRingCount}, emptyRings=${emptyRingCount}, nonFiniteCoords=${nonFiniteCoordCount}, minRingVertices=${minRingVertices ?? '-'}) (selfIntersections=${selfIntersectionCount}, degenerateRings=${degenerateRingCount}, duplicateVertices=${duplicateVertexCount}, minRingArea=${formatArea(minRingArea)}, maxRingArea=${formatArea(maxRingArea)}, maxRingVertices=${maxRingVertices ?? '-'}, avgRingVertices=${formatAverage(avgRingVertices)})`;
  return sampleDetails.length ? `${summary} (samples=${sampleDetails.join(' | ')})` : summary;
};

export const createTransformByBandHandler = (
  context: TransformByBandStageContext
): StageHandler<TransformByBandTaskInput> => {
  if (isTaskDebugLoggingEnabled()) {
    console.debug('[ShapeTransform][TaskDebug] handler created', {
      tag: TASKDEBUG_BUILD_TAG,
      bandCount: context.bands.length,
      geometryEngine: context.transformConfig.geometryEngine ?? 'turf',
    });
  }
  const {
    ephemeralDB,
    fetchConfig,
    transformConfig,
    vtConfig,
    bands,
    abortSignal,
    featureIdAllowlist,
  } = context;
  const taskQueue = new VtTaskQueueDb();
  const taskProgressRange = {
    transformStart: 0,
    fetchStart: 1,
    fetchEnd: 10,
    decodeStart: 11,
    decodeEnd: 20,
    prepareStart: 21,
    prepareEnd: 30,
    simplifyStart: 31,
    simplifyEnd: 80,
    outputBuildStart: 81,
    outputBuildEnd: 90,
    outputCountsStart: 91,
    outputCountsEnd: 95,
    encodeStart: 96,
    encodeEnd: 99,
    cachePutStart: 99,
  } as const;
  const normalizeDisplayToken = (value: string): string => (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  );
  const resolvePhaseDisplay = (phase: string): TaskDisplayPayload => {
    const separator = phase.lastIndexOf(':');
    const rawState = separator >= 0 ? phase.slice(separator + 1) : 'progress';
    const phaseState = rawState === 'start' || rawState === 'done' || rawState === 'progress'
      ? rawState
      : 'progress';
    const phaseCode = separator >= 0 ? phase.slice(0, separator) : phase;
    const normalizedPhaseCode = normalizeDisplayToken(phaseCode);
    return {
      kind: 'phase',
      phaseCode,
      phaseState,
      key: `stage.taskPhase.${normalizedPhaseCode}_${phaseState}`,
    };
  };
  const normalizePhaseProgress = (value: number): number => {
    if (!Number.isFinite(value)) return value;
    // Keep phase updates below 100 so completion message is finalized only by completed status updates.
    return Math.min(99, Math.max(0, Math.round(value)));
  };
  const updateTaskStrict = async (
    taskId: string,
    updates: Parameters<typeof updateTask>[2],
    operation: string,
  ): Promise<void> => {
    try {
      await withTimeout({
        taskId,
        operation,
        timeoutMs: TRANSFORM_TASK_UPDATE_TIMEOUT_MS,
        promise: updateTask(taskQueue, taskId, updates),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`task update failed: ${reason}`);
    }
  };
  const reportPolygonProgress = async (
    taskId: string,
    processedPolygons: number,
    totalPolygons: number,
    message?: string,
  ): Promise<void> => {
    const total = Math.max(0, Math.round(totalPolygons));
    const processed = Math.max(0, Math.round(processedPolygons));
    await updateTaskStrict(taskId, {
      ...(message ? { message } : {}),
      outputData: {
        processedPolygons: processed,
        totalPolygons: total,
      },
    }, 'progress:update');
  };
  const updateTaskPhase = async (
    taskId: string,
    phase: string,
    progress?: number,
    options?: {
      key?: string;
      params?: TaskDisplayPayload['params'];
    },
  ): Promise<void> => {
    const display = resolvePhaseDisplay(phase);
    if (options?.key) {
      display.key = options.key;
    }
    if (options?.params) {
      display.params = options.params;
    }
    await updateTaskStrict(taskId, {
      display,
      ...(progress !== undefined ? { progress: normalizePhaseProgress(progress) } : {}),
    }, `phase:update:${phase}`);
  };
  const updateSimplifyAttemptPhase = async (
    taskId: string,
    params: {
      attempt: number;
      tolerance: number;
      progress?: number;
      phaseState?: 'start' | 'progress' | 'done';
    },
  ): Promise<void> => {
    await updateTaskStrict(taskId, {
      display: {
        kind: 'phase',
        key: 'stage.taskPhase.simplifyAttempt',
        phaseCode: 'simplify-attempt',
        phaseState: params.phaseState ?? 'progress',
        params: {
          attempt: params.attempt,
          tolerance: formatToleranceForDisplay(params.tolerance),
        },
      },
      ...(params.progress !== undefined ? { progress: normalizePhaseProgress(params.progress) } : {}),
    }, 'phase:update:simplify-attempt');
  };
  const updateRetrySimplifyAttemptPhase = async (
    taskId: string,
    params: {
      featureIndex: number;
      featureTotal: number;
      attempt: number;
      attemptTotal: number;
      tolerance: number;
    },
  ): Promise<void> => {
    await updateTaskStrict(taskId, {
      display: {
        kind: 'phase',
        key: 'stage.taskPhase.retrySimplifyFeature',
        phaseCode: 'retry-simplify-feature',
        phaseState: 'progress',
        params: {
          featureIndex: params.featureIndex,
          featureTotal: params.featureTotal,
          attempt: params.attempt,
          attemptTotal: params.attemptTotal,
          tolerance: formatToleranceForDisplay(params.tolerance),
        },
      },
    }, 'phase:update:retry-simplify-feature');
  };
  const persistTransformIssues = async (
    issues: TransformIssueEntry[],
    params: {
      idPrefix: string;
      taskId: string;
      nodeId: NodeId;
      bandIndex?: number;
      sourceKey?: string;
      countryCode?: string;
      adminLevel?: number;
    },
  ): Promise<void> => {
    if (issues.length === 0) return;
    const createdAt = Date.now();
    const records: ShapeTransformErrorRecord[] = issues.map((issue) => ({
      id: `${params.idPrefix}:${issue.featureIndex}:${issue.issueKind}`,
      nodeId: params.nodeId,
      taskId: params.taskId,
      stage: 'transform',
      issueStage: issue.issueStage,
      issueKind: issue.issueKind,
      bandIndex: params.bandIndex,
      sourceKey: params.sourceKey,
      countryCode: params.countryCode,
      adminLevel: params.adminLevel,
      featureId: issue.featureId,
      featureIndex: issue.featureIndex,
      geometryType: issue.geometryType,
      polygonCount: issue.polygonCount,
      ringCount: issue.ringCount,
      polygonErrorCount: issue.polygonCount,
      ringErrorCount: issue.ringCount,
      message: issue.message,
      createdAt,
      lineFeatures: issue.lineFeatures,
    }));
    try {
      await ephemeralDB.transformErrors.bulkPut(records);
    } catch (error) {
      console.warn('[ShapeTransform] failed to persist transform issue records', {
        idPrefix: params.idPrefix,
        error,
      });
    }
  };
  const finalizeTaskWithCache = async (params: {
    taskId: string;
    cacheRecord: {
      id: string;
      nodeId: NodeId;
      bandIndex: number;
      domainType: 'shape' | 'route';
      sourceKey: string;
      countryCode?: string;
      adminLevel?: number;
      data: ArrayBuffer;
      featureCount: number;
      vertexCount: number;
      polygonCount: number;
      extractionRatio: number;
      tolerance: number;
    };
    metrics: {
      features: { input: number; output: number };
      polygons: { input: number; output: number };
      vertices: { input: number; output: number };
    };
    outputData: {
      processedPolygons: number;
      totalPolygons: number;
    };
  }): Promise<void> => {
    const completedAt = Date.now();
    if ((globalThis as { __HDB_VT_DEBUG_COLLECT?: boolean }).__HDB_VT_DEBUG_COLLECT === true && !structuredCloneLogged) {
      structuredCloneLogged = true;
      const cloneFn = globalThis.structuredClone;
      const cloneText = typeof cloneFn === 'function' ? String(cloneFn) : '';
      console.info('[ShapeTransform][TaskDebug] structuredClone probe', {
        tag: TASKDEBUG_BUILD_TAG,
        name: typeof cloneFn === 'function' ? cloneFn.name : null,
        type: typeof cloneFn,
        isNative: typeof cloneFn === 'function' ? cloneText.includes('[native code]') : null,
        preview: typeof cloneFn === 'function' ? cloneText.slice(0, 120) : null,
      });
    }
    const cacheStartedAt = Date.now();
    let cacheWaitLogged = false;
    const cacheWaitTimer = setTimeout(() => {
      cacheWaitLogged = true;
      logDebug('log', 'ShapeTransform', 'transform cache write waiting', {
        tag: TASKDEBUG_BUILD_TAG,
        taskId: params.taskId,
        elapsedMs: Date.now() - cacheStartedAt,
      });
      void updateTaskStrict(params.taskId, {
        display: {
          kind: 'info',
          key: 'stage.taskWarning.cachePutSlow',
          params: {
            elapsedSeconds: Math.max(1, Math.floor((Date.now() - cacheStartedAt) / 1000)),
          },
        },
      }, 'cache-put:slow-warning').catch((error) => {
        console.error('[ShapeTransform] failed to publish cache write warning', {
          taskId: params.taskId,
          error,
        });
      });
    }, 5000);
    try {
      const slowWriteLogId = setTimeout(() => {
        logDebug('log', 'ShapeTransform', 'transform cache write is still in progress', {
          tag: TASKDEBUG_BUILD_TAG,
          taskId: params.taskId,
          elapsedMs: Date.now() - cacheStartedAt,
          thresholdMs: TRANSFORM_CACHE_WRITE_SLOW_LOG_MS,
        });
      }, TRANSFORM_CACHE_WRITE_SLOW_LOG_MS);
      try {
        await withTimeout({
          taskId: params.taskId,
          operation: 'cache-write:transformCache.put',
          timeoutMs: TRANSFORM_DB_WRITE_TIMEOUT_MS,
          promise: ephemeralDB.transformCache.put({
            ...params.cacheRecord,
            timestamp: completedAt,
          }),
        });
      } finally {
        clearTimeout(slowWriteLogId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `transform failed: cache write failed (taskId=${params.taskId}, elapsedMs=${Date.now() - cacheStartedAt}, reason=${message})`
      );
    }
    clearTimeout(cacheWaitTimer);
    if (cacheWaitLogged) {
      logDebug('log', 'ShapeTransform', 'transform cache write done', {
        tag: TASKDEBUG_BUILD_TAG,
        taskId: params.taskId,
        elapsedMs: Date.now() - cacheStartedAt,
      });
    }

    const taskStartedAt = Date.now();
    let taskWaitLogged = false;
    const taskWaitTimer = setTimeout(() => {
      taskWaitLogged = true;
      logDebug('log', 'ShapeTransform', 'transform task update waiting', {
        tag: TASKDEBUG_BUILD_TAG,
        taskId: params.taskId,
        elapsedMs: Date.now() - taskStartedAt,
      });
    }, 5000);
    await updateTaskStrict(params.taskId, {
      status: 'completed',
      progress: 100,
      display: {
        kind: 'summary',
        key: 'stage.taskSummary.metrics',
        metrics: params.metrics,
      },
      outputData: params.outputData,
      completedAt,
    }, 'task:complete');
    clearTimeout(taskWaitTimer);
    if (taskWaitLogged) {
      logDebug('log', 'ShapeTransform', 'transform task update done', {
        tag: TASKDEBUG_BUILD_TAG,
        taskId: params.taskId,
        elapsedMs: Date.now() - taskStartedAt,
      });
    }
  };
  // Feature filtering is intentionally disabled during transform stage while investigating geometry distortion.
  const enableFeatureFiltering = false;
  const baseTolerance = transformConfig.tolerance;
  if (typeof baseTolerance !== 'number') {
    throw new Error('transform requires tolerance');
  }
  const configuredRetryToleranceStep = typeof transformConfig.retryToleranceStep === 'number'
    && Number.isFinite(transformConfig.retryToleranceStep)
    ? Math.min(2, Math.max(0, transformConfig.retryToleranceStep))
    : 0.01;
  const simplifyAlgorithm = resolveSimplifyAlgorithm(transformConfig.simplifyAlgorithm);
  const geometryEngine = transformConfig.geometryEngine ?? 'turf';
  const preserveTopology = transformConfig.preserveTopology ?? true;
  const traceLogLevel = normalizeTraceLogLevel(transformConfig.executionLogLevel);
  const anomalyDetectionConfig = {
    enabled: transformConfig.anomalyDetection?.enabled ?? false,
    scoreThreshold: transformConfig.anomalyDetection?.scoreThreshold ?? 2.2,
    maxEdgeLengthRatio: transformConfig.anomalyDetection?.maxEdgeLengthRatio ?? 12,
    maxAreaDriftPercent: transformConfig.anomalyDetection?.maxAreaDriftPercent ?? 35,
    maxSelfIntersectionCount: transformConfig.anomalyDetection?.maxSelfIntersectionCount ?? 0,
    maxLineLengthDriftPercent: transformConfig.anomalyDetection?.maxLineLengthDriftPercent ?? 45,
    maxVertexDriftPercent: transformConfig.anomalyDetection?.maxVertexDriftPercent ?? 40,
    geojson: {
      maxTriangleShareDriftPercent:
        transformConfig.anomalyDetection?.geojson?.maxTriangleShareDriftPercent ?? 2,
      maxTriangleEdgeToBBoxRatio:
        transformConfig.anomalyDetection?.geojson?.maxTriangleEdgeToBBoxRatio ?? 1.15,
    },
    topojson: {
      minSharedArcRatioPercent:
        transformConfig.anomalyDetection?.topojson?.minSharedArcRatioPercent ?? 12,
    },
  };
  const intakeGuardConfig = {
    validationLevel: fetchConfig.geometryIntakeGuard?.validationLevel ?? 'off',
    dedupeEpsilon: fetchConfig.geometryIntakeGuard?.dedupeEpsilon ?? 0,
    minRingAreaThreshold: fetchConfig.geometryIntakeGuard?.minRingAreaThreshold ?? 0,
    normalizeRingOrientation: fetchConfig.geometryIntakeGuard?.normalizeRingOrientation ?? false,
    keepBaselineSnapshot: fetchConfig.geometryIntakeGuard?.keepBaselineSnapshot ?? false,
  } as const;
  const vtOutputQualityGuard = vtConfig.outputQualityGuard;
  if (geometryEngine !== 'turf') {
    throw new Error(`transform failed: unknown geometryEngine (${String(geometryEngine)})`);
  }
  const geometryOps = createGeometryOps(geometryEngine, { preserveTopology });
  const bandMap = new Map(bands.map((band) => [band.bandIndex, band] as const));
  let debugTaskId: string | null = null;
  let debugTaskStartedAt: number | null = null;
  let debugNodeId: NodeId | null = null;
  let debugSelectionLogged = false;
  let firstTaskLogged = false;
  const debugResetAfterMs = 30000;
  const readHeapUsageRatio = (): number | null => {
    const performance = (globalThis as {
      performance?: {
        memory?: {
          usedJSHeapSize?: number;
          jsHeapSizeLimit?: number;
        };
      };
    }).performance;
    const memory = performance?.memory;
    const used = memory?.usedJSHeapSize;
    const limit = memory?.jsHeapSizeLimit;
    if (typeof used !== 'number' || typeof limit !== 'number' || limit <= 0) return null;
    if (!Number.isFinite(used) || !Number.isFinite(limit)) return null;
    return Math.round((used / limit) * 1000) / 1000;
  };

  return async (task): Promise<StageHandlerResult> => {
    const taskId = task.taskId;
    if (!firstTaskLogged && isTaskDebugLoggingEnabled()) {
      firstTaskLogged = true;
      console.debug('[ShapeTransform][TaskDebug] handler first task', {
        tag: TASKDEBUG_BUILD_TAG,
        nodeId: task.nodeId,
        taskId,
        stage: task.stage,
        inputKeys: Object.keys(task.inputData ?? {}),
      });
    }
    const input = task.inputData;
    if (!input) {
      return { status: 'failed', errorMessage: 'transform failed: task input is missing' };
    }
    const band = bandMap.get(input.bandIndex);
    if (!band) {
      return { status: 'failed', errorMessage: `transform failed: unknown bandIndex (${input.bandIndex})` };
    }
    const tolerance = resolveTransformTolerance(baseTolerance, band.zMax);
    if (tolerance !== baseTolerance) {
      console.info('[ShapeTransform][Tolerance]', JSON.stringify({
        nodeId: task.nodeId,
        taskId,
        sourceKey: input.sourceKey,
        adminLevel: input.adminLevel,
        bandIndex: input.bandIndex,
        zTarget: band.zMax,
        baseTolerance,
        appliedTolerance: tolerance,
      }));
    }
    emitTransformTrace(traceLogLevel, 'summary', 'task-config', {
      sessionId: String(task.nodeId),
      taskId,
      stage: 'transform',
      simplifyAlgorithm,
      preserveTopology,
      tolerance,
      fetchIntakeGuard: intakeGuardConfig,
      anomalyDetection: anomalyDetectionConfig,
      vtOutputQualityGuard: vtOutputQualityGuard ?? null,
    });

    let workingCollection: FeatureCollection | null = null;
    let simplified: FeatureCollection | null = null;
    let outputCollection: FeatureCollection | null = null;
    let baselineMetrics: CollectionAnomalyMetrics | null = null;
    let topoSharedArcDiagnostics: TopojsonSharedArcDiagnostics | null = null;
    let anomalyProfile: AnomalyProfile = input.domainType === 'route' ? 'line' : 'polygon';
    let stageLabel = 'start';
    let inputPolygonCount = 0;
    let inputVertexCount = 0;
    const now = Date.now();
    const debugTaskLoggingEnabled = isTaskDebugLoggingEnabled();
    if (
      debugTaskLoggingEnabled
      && (!debugTaskId || !debugTaskStartedAt || now - debugTaskStartedAt > debugResetAfterMs || debugNodeId !== task.nodeId)
    ) {
      debugTaskId = taskId;
      debugTaskStartedAt = now;
      debugNodeId = task.nodeId;
      debugSelectionLogged = false;
    }
    const isDebugTask = debugTaskLoggingEnabled && debugTaskId === taskId;
    const getElapsedMs = () => (debugTaskStartedAt ? Date.now() - debugTaskStartedAt : null);
    const logDebugPhase = (phase: string, details?: Record<string, unknown>) => {
      if (!isDebugTask) return;
      console.debug('[ShapeTransform][TaskDebug]', {
        nodeId: task.nodeId,
        taskId,
        phase,
        stageLabel,
        elapsedMs: getElapsedMs(),
        heapUsedRatio: readHeapUsageRatio(),
        ...details,
      });
    };
    let debugHeartbeat: ReturnType<typeof setInterval> | null = null;
    if (isDebugTask) {
      if (!debugSelectionLogged) {
        debugSelectionLogged = true;
        console.debug('[ShapeTransform][TaskDebug] selection', {
          nodeId: task.nodeId,
          taskId,
          bandIndex: input.bandIndex,
          sourceKey: input.sourceKey,
          adminLevel: input.adminLevel,
          zTarget: band.zMax,
        });
      }
      logDebugPhase('task-start', {
        bandIndex: input.bandIndex,
        zTarget: band.zMax,
        sourceKey: input.sourceKey,
        adminLevel: input.adminLevel,
        fetchCacheId: input.fetchCacheId,
        domainType: input.domainType,
        tolerance,
      });
      debugHeartbeat = setInterval(() => {
        logDebugPhase('task-heartbeat');
      }, 5000);
    }

    try {
      stageLabel = 'fetch:cache';
      logDebugPhase('fetch-cache:start', { fetchCacheId: input.fetchCacheId });
      await updateTaskPhase(taskId, 'transform:start', taskProgressRange.transformStart);
      await updateTaskPhase(taskId, 'fetch-cache:start', taskProgressRange.fetchStart);
      assertNotAborted(abortSignal);
      let fetchWaitTimer: ReturnType<typeof setInterval> | null = null;
      let fetchWaitStartedAt: number | null = null;
      if (isDebugTask) {
        fetchWaitStartedAt = Date.now();
        fetchWaitTimer = setInterval(() => {
          const elapsedMs = fetchWaitStartedAt ? Date.now() - fetchWaitStartedAt : null;
          console.debug('[ShapeTransform][TaskDebug] fetch-cache:waiting', {
            nodeId: task.nodeId,
            taskId,
            fetchCacheId: input.fetchCacheId,
            elapsedMs,
            db: {
              name: (ephemeralDB as { name?: string }).name ?? null,
              isOpen: typeof (ephemeralDB as { isOpen?: () => boolean }).isOpen === 'function'
                ? (ephemeralDB as { isOpen: () => boolean }).isOpen()
                : null,
            },
          });
        }, 5000);
      }
      const fetchCache = await ephemeralDB.fetchCache.get(input.fetchCacheId);
      if (fetchWaitTimer) {
        clearInterval(fetchWaitTimer);
      }
      if (!fetchCache) {
        return { status: 'failed', errorMessage: 'transform failed: fetch cache not found' };
      }
      logDebugPhase('fetch-cache:done', {
        format: fetchCache.format,
        compression: fetchCache.compression ?? null,
        byteLength: fetchCache.data.byteLength,
        elapsedMs: fetchWaitStartedAt ? Date.now() - fetchWaitStartedAt : null,
      });
      if (fetchCache.format === 'topojson' && anomalyDetectionConfig.enabled) {
        try {
          const decodedBuffer = fetchCache.compression === 'gzip'
            ? await decompressGzip(fetchCache.data)
            : fetchCache.data;
          const topology = decodeTopoJson(decodedBuffer);
          topoSharedArcDiagnostics = collectTopojsonSharedArcDiagnostics(topology);
          emitTransformTrace(traceLogLevel, 'summary', 'topology-arc-diagnostics', {
            sessionId: String(task.nodeId),
            taskId,
            stage: 'decode',
            diagnostics: topoSharedArcDiagnostics,
          });
        } catch (topologyError) {
          console.warn('[ShapeTransform] failed to collect topojson shared-arc diagnostics', {
            nodeId: task.nodeId,
            taskId,
            sourceKey: input.sourceKey,
            error: topologyError instanceof Error ? topologyError.message : String(topologyError),
          });
        }
      }
      const executionPath = resolveSimplifyExecutionPath({
        fetchFormat: fetchCache.format,
        simplifyAlgorithm,
      });
      emitTransformTrace(traceLogLevel, 'summary', 'execution-path', {
        sessionId: String(task.nodeId),
        taskId,
        stage: 'decode',
        algorithm: simplifyAlgorithm,
        executionPath,
        fetchFormat: fetchCache.format ?? 'unknown',
        compression: fetchCache.compression ?? null,
        preserveTopology,
      });
      await updateTaskPhase(taskId, 'fetch-cache:done', taskProgressRange.fetchEnd);

      stageLabel = 'decode';
      logDebugPhase('decode:start', {
        format: fetchCache.format,
        compression: fetchCache.compression ?? null,
      });
      await updateTaskPhase(taskId, 'decode:start', taskProgressRange.decodeStart);
      assertNotAborted(abortSignal);
      const decodeStartedAt = Date.now();
      let decodeProgressActive = true;
      const publishDecodeProgress = async (): Promise<void> => {
        if (!decodeProgressActive) return;
        const elapsedSeconds = Math.max(1, Math.floor((Date.now() - decodeStartedAt) / 1000));
        await updateTaskPhase(taskId, 'decode:progress', taskProgressRange.decodeStart, {
          key: 'stage.taskPhase.decodeProgress',
          params: { elapsedSeconds },
        });
      };
      const decodeProgressTimer = setInterval(() => {
        void publishDecodeProgress();
      }, TASK_PHASE_PROGRESS_UPDATE_INTERVAL_MS);
      let collection: FeatureCollection | null = null;
      try {
        collection = await runStageWithLabel('decode', () => decodeFetchCacheByFormat({
          buffer: fetchCache.data,
          format: fetchCache.format,
          compression: fetchCache.compression,
          zTarget: band.zMax,
          toleranceK: baseTolerance,
          quantize: transformConfig.quantize,
          simplifyAlgorithm,
        }));
      } finally {
        decodeProgressActive = false;
        clearInterval(decodeProgressTimer);
      }
      if (!collection || collection.features.length === 0) {
        return { status: 'failed', errorMessage: 'transform failed: empty fetch cache' };
      }
      logDebugPhase('decode:done', { featureCount: collection.features.length });
      emitTransformTrace(traceLogLevel, 'summary', 'decode-done', {
        sessionId: String(task.nodeId),
        taskId,
        stage: 'decode',
        outputFeatureCount: collection.features.length,
        outputVertexCount: collection.features.reduce(
          (sum, feature) => sum + countVerticesFromGeometry(feature?.geometry ?? null),
          0,
        ),
      });
      await updateTaskPhase(taskId, 'decode:done', taskProgressRange.decodeEnd);

      if (featureIdAllowlist && featureIdAllowlist.size > 0) {
        stageLabel = 'recycling-filter';
        await updateTaskPhase(taskId, 'recycling-filter:start', taskProgressRange.prepareStart);
        const hasFeatureIds = collection.features.some((feature) => {
          const props = feature?.properties as Record<string, unknown> | undefined;
          return typeof props?.__hdbFeatureId === 'string' && props.__hdbFeatureId.length > 0;
        });
        if (!hasFeatureIds) {
          console.warn('[ShapeTransform] recycling allowlist ignored (missing __hdbFeatureId)', {
            nodeId: task.nodeId,
            taskId,
            sourceKey: input.sourceKey,
          });
        } else {
          const filteredFeatures = collection.features.filter((feature) => {
            const props = feature?.properties as Record<string, unknown> | undefined;
            const featureId = typeof props?.__hdbFeatureId === 'string' ? props.__hdbFeatureId : null;
            return featureId ? featureIdAllowlist.has(featureId) : false;
          });
          if (filteredFeatures.length === 0) {
            await updateTaskPhase(taskId, 'recycling-filter:done', taskProgressRange.prepareStart);
            await reportPolygonProgress(taskId, 0, 0);
            return {
              status: 'completed',
              progress: 100,
              display: {
                kind: 'skip',
                key: 'stage.taskSkip.noRecyclingFeatures',
                params: {},
              },
              outputData: {
                processedPolygons: 0,
                totalPolygons: 0,
              },
            };
          }
          collection = { ...collection, features: filteredFeatures };
        }
        await updateTaskPhase(taskId, 'recycling-filter:done', taskProgressRange.prepareStart);
      }
      workingCollection = collection;
      if (intakeGuardConfig.validationLevel !== 'off') {
        stageLabel = 'intake-guard';
        await updateTaskPhase(taskId, 'intake-guard:start', taskProgressRange.prepareStart);
        const intakeGuardStartedAt = Date.now();
        const guarded = applyGeometryIntakeGuard({
          collection: workingCollection,
          validationLevel: intakeGuardConfig.validationLevel,
          dedupeEpsilon: intakeGuardConfig.dedupeEpsilon,
          minRingAreaThreshold: intakeGuardConfig.minRingAreaThreshold,
          normalizeRingOrientation: intakeGuardConfig.normalizeRingOrientation,
          geometryOps,
          sourceKey: input.sourceKey,
          maxIssueRecords: 200,
        });
        workingCollection = guarded.collection;
        await persistTransformIssues(guarded.issues, {
          idPrefix: `${task.taskId}:intake-guard`,
          taskId: task.taskId,
          nodeId: task.nodeId,
          bandIndex: input.bandIndex,
          sourceKey: input.sourceKey,
          countryCode: input.countryCode,
          adminLevel: input.adminLevel,
        });
        emitTransformTrace(traceLogLevel, 'summary', 'intake-guard', {
          sessionId: String(task.nodeId),
          taskId,
          stage: 'prepare',
          validationLevel: intakeGuardConfig.validationLevel,
          modifiedFeatureCount: guarded.modifiedFeatureCount,
          droppedFeatureCount: guarded.droppedFeatureCount,
          validCheckCount: guarded.validCheckCount,
          issueCount: guarded.issueCount,
          persistedIssueCount: guarded.issues.length,
          elapsedMs: Date.now() - intakeGuardStartedAt,
          outputFeatureCount: guarded.collection.features.length,
        });
        await updateTaskPhase(taskId, 'intake-guard:done', taskProgressRange.prepareEnd);
      }
      if (enableFeatureFiltering && transformConfig.enableFeatureFiltering) {
        stageLabel = 'filter:featureFiltering';
        await updateTaskPhase(taskId, 'filtering:start', taskProgressRange.decodeEnd);
        assertNotAborted(abortSignal);
        const filtered = await runStageWithLabel('filter:featureFiltering', () => applyFeatureFiltering(
          workingCollection,
          {
            minArea: transformConfig.featureAreaThreshold,
            featureFilterMethod: transformConfig.featureFilterMethod,
            minVertexCountForAreaFilter: transformConfig.minVertexCountForAreaFilter,
            hybridFilterConfig: transformConfig.hybridFilterConfig,
          },
          geometryEngine,
        ));
        if (filtered && typeof filtered === 'object' && (filtered as FeatureCollection).type === 'FeatureCollection') {
          workingCollection = filtered as FeatureCollection;
        }
        const filterTarget = workingCollection;
        if (!filterTarget) {
          return { status: 'failed', errorMessage: 'transform failed: empty working collection before filters' };
        }
        stageLabel = 'filter:aspectArea';
        const filteredFeatures = await runStageWithLabel('filter:aspectArea', () => filterFeaturesByAspectRatioAndArea(
          filterTarget.features,
          transformConfig.aspectRatioThreshold,
          transformConfig.areaThreshold,
          geometryOps,
        ));
        workingCollection = { ...filterTarget, features: filteredFeatures };
        await updateTaskPhase(taskId, 'filtering:done', taskProgressRange.decodeEnd);
      }

      assertNotAborted(abortSignal);
      const inputCollection = workingCollection;
      if (!inputCollection) {
        return { status: 'failed', errorMessage: 'transform failed: empty working collection' };
      }
      const inputFeatureCount = inputCollection.features.length;
      const inputMissingGeometry = inputCollection.features.filter((feature) => !feature?.geometry).length;
      const readNonNegativeCount = (value: unknown): number | null => {
        if (typeof value !== 'number' || !Number.isFinite(value)) return null;
        if (value < 0) return null;
        return Math.round(value);
      };
      const readFeaturePrecomputedCount = (
        feature: Feature | null | undefined,
        key: '__hdbFetchPolygonCount' | '__hdbFetchVertexCount',
      ): number => {
        const properties = feature?.properties as Record<string, unknown> | undefined;
        const raw = properties?.[key];
        return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : 0;
      };
      inputPolygonCount = readNonNegativeCount(input.inputPolygonCount)
        ?? readNonNegativeCount(fetchCache.polygonCount)
        ?? 0;
      inputVertexCount = readNonNegativeCount(input.inputVertexCount)
        ?? readNonNegativeCount(fetchCache.vertexCount)
        ?? 0;
      if (featureIdAllowlist && featureIdAllowlist.size > 0) {
        const allowlistPolygonCount = inputCollection.features.reduce(
          (sum, feature) => sum + readFeaturePrecomputedCount(feature, '__hdbFetchPolygonCount'),
          0,
        );
        const allowlistVertexCount = inputCollection.features.reduce(
          (sum, feature) => sum + readFeaturePrecomputedCount(feature, '__hdbFetchVertexCount'),
          0,
        );
        inputPolygonCount = allowlistPolygonCount > 0 ? allowlistPolygonCount : inputPolygonCount;
        inputVertexCount = allowlistVertexCount > 0 ? allowlistVertexCount : inputVertexCount;
      }
      await reportPolygonProgress(taskId, 0, inputPolygonCount);
      const shouldCollectBaselineMetrics = false;
      if (anomalyDetectionConfig.enabled || Boolean(vtOutputQualityGuard?.enabled)) {
        emitTransformTrace(traceLogLevel, 'summary', 'baseline-metrics-skipped', {
          sessionId: String(task.nodeId),
          taskId,
          stage: 'prepare',
          reason: 'moved-to-fetch-stage',
          anomalyDetectionEnabled: anomalyDetectionConfig.enabled,
          vtOutputQualityGuardEnabled: Boolean(vtOutputQualityGuard?.enabled),
        });
      }
      if (shouldCollectBaselineMetrics) {
        // Reserved for future: consume fetch-stage precomputed baseline metrics only.
      }
      if (input.adminLevel === 0 && band.zMax >= 6) {
        const samples = inputCollection.features.slice(0, 5).map((feature, index) => {
          const props = feature?.properties as Record<string, unknown> | undefined;
          const id = feature?.id
            ?? props?.id
            ?? props?.boundaryID
            ?? props?.boundaryISO
            ?? props?.ISO
            ?? props?.code
            ?? `${input.sourceKey}:${index}`;
          return {
            index,
            id,
            name: props?.boundaryName ?? props?.name ?? null,
            vertices: countVerticesFromGeometry(feature?.geometry ?? null),
            polygons: countPolygonsFromGeometry(feature?.geometry ?? null),
          };
        });
        console.info('[ShapeTransform][Admin0FeatureSample]', JSON.stringify({
          nodeId: task.nodeId,
          taskId,
          sourceKey: input.sourceKey,
          adminLevel: input.adminLevel,
          bandIndex: input.bandIndex,
          zTarget: band.zMax,
          featureCount: inputFeatureCount,
          samples,
        }));
      }
      const readHeapSnapshot = () => {
        const performance = (globalThis as {
          performance?: {
            memory?: {
              usedJSHeapSize?: number;
              totalJSHeapSize?: number;
              jsHeapSizeLimit?: number;
            };
          };
        }).performance;
        const memory = performance?.memory;
        if (!memory) return null;
        return {
          used: memory.usedJSHeapSize ?? null,
          total: memory.totalJSHeapSize ?? null,
          limit: memory.jsHeapSizeLimit ?? null,
        };
      };
      const retryVertexLimit = resolveRetryVertexLimit(input.countryCode);
      const formatTolerance = (value: number): string => Number.isFinite(value) ? value.toFixed(6) : '-';
      const summarizeVertexLimit = (collection: FeatureCollection | null): {
        featureCount: number;
        overLimitFeatureCount: number;
        maxVertexCount: number;
      } | null => {
        if (!collection) return null;
        let maxVertexCount = 0;
        let overLimitFeatureCount = 0;
        for (const feature of collection.features) {
          if (!feature?.geometry) continue;
          const vertexCount = countVerticesFromGeometry(feature.geometry);
          maxVertexCount = Math.max(maxVertexCount, vertexCount);
          if (vertexCount >= retryVertexLimit) {
            overLimitFeatureCount += 1;
          }
        }
        return {
          featureCount: collection.features.length,
          overLimitFeatureCount,
          maxVertexCount,
        };
      };
      let simplifyAttempt = 1;
      try {
        assertNotAborted(abortSignal);
        const simplifyStartAt = Date.now();
        stageLabel = 'simplify-only';
        logDebugPhase('simplify:start', {
          featureCount: inputFeatureCount,
          polygonCount: inputPolygonCount,
        });
        console.log('[ShapeTransform][SimplifyOnlyMetrics] start', {
          nodeId: task.nodeId,
          taskId,
          bandIndex: input.bandIndex,
          zTarget: band.zMax,
          featureCount: inputFeatureCount,
          polygonCount: inputPolygonCount,
          missingGeometry: inputMissingGeometry,
          algorithm: simplifyAlgorithm,
          fetchFormat: fetchCache.format,
          heap: readHeapSnapshot(),
        });
        let processedPolygonCount = 0;
        let lastReportAt = 0;
        const reportProgressMaybe = async (force: boolean) => {
          const now = Date.now();
          if (!force && now - lastReportAt < 2000) return;
          lastReportAt = now;
          await reportPolygonProgress(taskId, processedPolygonCount, inputPolygonCount);
        };
        await updateSimplifyAttemptPhase(taskId, {
          attempt: simplifyAttempt,
          tolerance,
          phaseState: 'start',
          progress: taskProgressRange.simplifyStart,
        });
        emitTransformTrace(traceLogLevel, 'summary', 'simplify-start', {
          sessionId: String(task.nodeId),
          taskId,
          stage: 'simplify',
          algorithm: simplifyAlgorithm,
          tolerance,
          preserveTopology,
          inputFeatureCount,
          inputPolygonCount,
          inputVertexCount,
        });
        const skipGeojsonSimplify = fetchCache.format === 'topojson' && simplifyAlgorithm === 'topojson';
        if (skipGeojsonSimplify) {
          simplified = inputCollection;
          processedPolygonCount = inputPolygonCount;
          logDebugPhase('simplify:skipped', {
            algorithm: simplifyAlgorithm,
            fetchFormat: fetchCache.format,
            featureCount: simplified.features.length,
          });
        } else {
          const simplifyPromise = runStageWithLabel('simplify-only', () => (
            simplifyOnlyCollection(inputCollection, band.zMax, tolerance, geometryOps)
          ));
          simplified = await runWithStallTimeout({
            promise: simplifyPromise,
            stage: 'simplify-only',
            nodeId: String(task.nodeId),
            taskId,
            timeoutMs: 300000,
            getLastProgressAt: () => Date.now(),
          });
          processedPolygonCount = inputPolygonCount;
        }
        if (simplified && baselineMetrics && anomalyDetectionConfig.enabled && intakeGuardConfig.keepBaselineSnapshot) {
          const outputMetrics = collectCollectionAnomalyMetrics(simplified, geometryOps);
          const outputAssessment = assessAnomalyRisk({
            profile: anomalyProfile,
            baseline: baselineMetrics as CollectionAnomalyMetrics,
            candidate: outputMetrics,
            thresholds: anomalyDetectionConfig,
            diagnostics: {
              topoSharedArcRatioPercent: simplifyAlgorithm === 'topojson'
                ? (topoSharedArcDiagnostics?.sharedArcRatioPercent ?? null)
                : null,
            },
          });
          emitTransformTrace(traceLogLevel, 'summary', 'anomaly-assessment', {
            sessionId: String(task.nodeId),
            taskId,
            stage: 'simplify',
            profile: anomalyProfile,
            tolerance,
            score: outputAssessment.score,
            scoreThreshold: outputAssessment.scoreThreshold,
            reasons: outputAssessment.reasons,
            isAnomalous: outputAssessment.isAnomalous,
          });
        } else if (anomalyDetectionConfig.enabled && !intakeGuardConfig.keepBaselineSnapshot) {
          emitTransformTrace(traceLogLevel, 'summary', 'anomaly-skipped', {
            sessionId: String(task.nodeId),
            taskId,
            stage: 'simplify',
            reason: 'baseline snapshot disabled',
          });
        }
        logDebugPhase('simplify:done', {
          featureCount: simplified?.features.length ?? 0,
          polygonCount: inputPolygonCount,
          algorithm: simplifyAlgorithm,
          skipped: skipGeojsonSimplify,
        });
        emitTransformTrace(traceLogLevel, 'summary', 'simplify-done', {
          sessionId: String(task.nodeId),
          taskId,
          stage: 'simplify',
          algorithm: simplifyAlgorithm,
          skipGeojsonSimplify,
          outputFeatureCount: simplified?.features.length ?? 0,
          outputVertexCount: simplified
            ? simplified.features.reduce((sum, feature) => sum + countVerticesFromGeometry(feature.geometry), 0)
            : 0,
        });
        console.log('[ShapeTransform][SimplifyOnlyMetrics] done', {
          nodeId: task.nodeId,
          taskId,
          bandIndex: input.bandIndex,
          zTarget: band.zMax,
          durationMs: Date.now() - simplifyStartAt,
          processedPolygons: processedPolygonCount,
          totalPolygons: inputPolygonCount,
          algorithm: simplifyAlgorithm,
          skipped: skipGeojsonSimplify,
          heap: readHeapSnapshot(),
        });
        await reportProgressMaybe(true);
        await updateTaskPhase(taskId, 'simplify-only:done', taskProgressRange.simplifyEnd);
        if (!simplified || simplified.features.length === 0) {
          const errorRecords: ShapeTransformErrorRecord[] = [];
          const recordLimit = 200;
          for (const [featureIndex, feature] of inputCollection.features.entries()) {
            if (errorRecords.length >= recordLimit) break;
            if (!feature?.geometry) continue;
            const rawFeatureId = feature.id
              ?? (feature.properties && 'id' in feature.properties ? String(feature.properties.id) : undefined);
            const featureId = rawFeatureId ? String(rawFeatureId) : `${input.sourceKey}:${featureIndex}`;
            const lineFeaturesCandidate = buildErrorLineFeatures(feature.geometry, featureId);
            const recordPolygonCount = lineFeaturesCandidate?.polygonCount
              ?? countPolygonsFromGeometry(feature.geometry);
            const recordRingCount = lineFeaturesCandidate?.ringCount ?? 0;
            errorRecords.push({
              id: `${task.taskId}:empty:${featureIndex}`,
              nodeId: task.nodeId,
              taskId: task.taskId,
              stage: 'transform',
              bandIndex: input.bandIndex,
              sourceKey: input.sourceKey,
              countryCode: input.countryCode,
              adminLevel: input.adminLevel,
              featureId,
              featureIndex,
              geometryType: lineFeaturesCandidate?.geometryType ?? feature.geometry.type,
              polygonCount: recordPolygonCount,
              ringCount: recordRingCount,
              polygonErrorCount: recordPolygonCount,
              ringErrorCount: recordRingCount,
              message: 'simplify produced empty collection',
              createdAt: Date.now(),
              lineFeatures: {
                type: 'FeatureCollection',
                features: lineFeaturesCandidate?.features ?? [],
              },
            });
          }
          if (errorRecords.length > 0) {
            try {
              await ephemeralDB.transformErrors.bulkPut(errorRecords);
              if (inputCollection.features.length > errorRecords.length) {
                console.warn('[ShapeTransform] empty simplify error records truncated', {
                  nodeId: task.nodeId,
                  taskId: task.taskId,
                  limit: recordLimit,
                  totalFeatures: inputCollection.features.length,
                });
              }
            } catch (storageError) {
              console.warn('[ShapeTransform] failed to persist empty simplify error records', storageError);
            }
          }
          await reportPolygonProgress(task.taskId, inputPolygonCount, inputPolygonCount);
          return {
            status: 'completed',
            progress: 100,
            display: {
              kind: 'skip',
              key: 'stage.taskSkip.emptyAfterSimplify',
              params: {
                inputFeatures: inputFeatureCount,
                inputPolygons: inputPolygonCount,
              },
            },
            outputData: {
              processedPolygons: inputPolygonCount,
              totalPolygons: inputPolygonCount,
            },
          };
        }
      } catch (error) {
        if (abortSignal?.aborted) {
          throw error;
        }
        const err = error instanceof Error ? error.message : String(error);
        let errorFeatureCount = 0;
        let errorPolygonCount = 0;
        let invalidRingCount = 0;
        let openRingCount = 0;
        let emptyRingCount = 0;
        let nonFiniteCoordCount = 0;
        let invalidFeatureCount = 0;
        let minRingVertices: number | null = null;
        let maxRingVertices: number | null = null;
        let ringVertexTotal = 0;
        let ringCount = 0;
        let degenerateRingCount = 0;
        let duplicateVertexCount = 0;
        let selfIntersectionCount = 0;
        let minRingArea: number | null = null;
        let maxRingArea: number | null = null;
        const sampleDetails: string[] = [];
        const analysisErrors: string[] = [];
        const errorRecords: ShapeTransformErrorRecord[] = [];
        for (const [featureIndex, feature] of inputCollection.features.entries()) {
          assertNotAborted(abortSignal);
          if (!feature?.geometry) continue;
          try {
            simplifyOnlyCollection(
              { type: 'FeatureCollection', features: [feature] },
              band.zMax,
              tolerance,
              geometryOps,
            );
          } catch (featureError) {
            errorFeatureCount += 1;
            const featureMessage = featureError instanceof Error ? featureError.message : String(featureError);
            const rawFeatureId = feature.id
              ?? (feature.properties && 'id' in feature.properties ? String(feature.properties.id) : undefined);
            const recordFeatureId = rawFeatureId != null
              ? String(rawFeatureId)
              : `${input.sourceKey}:${featureIndex}`;
            const lineFeaturesCandidate = buildErrorLineFeatures(feature.geometry, recordFeatureId);
            const recordId = `${task.taskId}:${recordFeatureId}`;
            const fallbackGeometryType = feature.geometry?.type ?? 'unknown';
            const summary = analyzeGeometryIssues(feature.geometry, geometryOps);
            const recordPolygonCount = summary.polygonCount;
            const recordRingCount = summary.ringCount;
            const recordPolygonErrorCount = summary.errorPolygonCount > 0
              ? summary.errorPolygonCount
              : recordPolygonCount;
            const recordRingErrorCount = summary.errorRingCount > 0
              ? summary.errorRingCount
              : recordRingCount;
            try {
              stageLabel = 'counts:error-polygons';
              errorPolygonCount += await runStageWithLabel('counts:error-polygons', () => countPolygonsFromGeometry(feature.geometry));
              stageLabel = 'analysis:geometry-issues';
              invalidRingCount += summary.invalidRingCount;
              openRingCount += summary.openRingCount;
              emptyRingCount += summary.emptyRingCount;
              nonFiniteCoordCount += summary.nonFiniteCoordCount;
              degenerateRingCount += summary.degenerateRingCount;
              duplicateVertexCount += summary.duplicateVertexCount;
              selfIntersectionCount += summary.selfIntersectionCount;
              const isValid = isGeometryBooleanValid(feature.geometry, geometryOps);
              if (!isValid) {
                invalidFeatureCount += 1;
              }
              if (sampleDetails.length < 3) {
                const featureId = feature.id
                  ?? (feature.properties && 'id' in feature.properties ? String(feature.properties.id) : undefined)
                  ?? `${input.sourceKey}:${sampleDetails.length}`;
                sampleDetails.push(
                  `${featureId} type=${summary.geometryType} rings=${summary.ringCount} minRingVertices=${summary.minRingVertices ?? '-'} kinks=${summary.selfIntersectionCount} degenerateRings=${summary.degenerateRingCount} minRingArea=${formatArea(summary.minRingArea)} invalidRings=${summary.invalidRingCount} openRings=${summary.openRingCount} nonFinite=${summary.nonFiniteCoordCount} booleanValid=${isValid ? '1' : '0'}`,
                );
              }
              if (summary.minRingVertices !== null) {
                minRingVertices = minRingVertices === null
                  ? summary.minRingVertices
                  : Math.min(minRingVertices, summary.minRingVertices);
              }
              if (summary.maxRingVertices !== null) {
                maxRingVertices = maxRingVertices === null
                  ? summary.maxRingVertices
                  : Math.max(maxRingVertices, summary.maxRingVertices);
              }
              if (summary.minRingArea !== null) {
                minRingArea = minRingArea === null
                  ? summary.minRingArea
                  : Math.min(minRingArea, summary.minRingArea);
              }
              if (summary.maxRingArea !== null) {
                maxRingArea = maxRingArea === null
                  ? summary.maxRingArea
                  : Math.max(maxRingArea, summary.maxRingArea);
              }
              if (summary.avgRingVertices !== null && summary.ringCount > 0) {
                ringVertexTotal += summary.avgRingVertices * summary.ringCount;
                ringCount += summary.ringCount;
              }
            } catch (analysisError) {
              const analysisMessage = analysisError instanceof Error ? analysisError.message : String(analysisError);
              if (analysisErrors.length < 3) {
                analysisErrors.push(`analysisFailed stage=${stageLabel} ${analysisMessage}`);
              }
            }
            errorRecords.push({
              id: recordId,
              nodeId: task.nodeId,
              taskId: task.taskId,
              stage: 'transform',
              bandIndex: input.bandIndex,
              sourceKey: input.sourceKey,
              countryCode: input.countryCode,
              adminLevel: input.adminLevel,
              featureId: recordFeatureId,
              featureIndex,
              geometryType: lineFeaturesCandidate?.geometryType ?? fallbackGeometryType,
              polygonCount: recordPolygonCount,
              ringCount: recordRingCount,
              polygonErrorCount: recordPolygonErrorCount,
              ringErrorCount: recordRingErrorCount,
              message: featureMessage,
              createdAt: Date.now(),
              lineFeatures: {
                type: 'FeatureCollection',
                features: lineFeaturesCandidate?.features ?? [],
              },
            });
          }
        }
        if (errorRecords.length > 0) {
          try {
            await ephemeralDB.transformErrors.bulkPut(errorRecords);
          } catch (storageError) {
            console.warn('[ShapeTransform] failed to persist transform error details', storageError);
          }
        }
        const avgRingVertices = ringCount > 0 ? ringVertexTotal / ringCount : null;
        const analysisNote = analysisErrors.length ? ` (analysisErrors=${analysisErrors.join(' | ')})` : '';
        const vertexLimitSnapshot = summarizeVertexLimit(simplified);
        const simplifySummary = vertexLimitSnapshot
          ? ` (finalVertexCount=${vertexLimitSnapshot.maxVertexCount}, overLimit=${vertexLimitSnapshot.overLimitFeatureCount}/${vertexLimitSnapshot.featureCount}, finalRetryAttempts=0, finalTolerance=${formatTolerance(tolerance)})`
          : ` (finalVertexCount=-, overLimit=-, finalRetryAttempts=0, finalTolerance=${formatTolerance(tolerance)})`;
        await reportPolygonProgress(task.taskId, 0, inputPolygonCount);
        return {
          status: 'failed',
          errorMessage: `transform failed: geometry simplify error (extract1/${band.zMax}) (${err}) (invalidFeatures=${errorFeatureCount}/${inputFeatureCount}, invalidPolygons=${errorPolygonCount}/${inputPolygonCount}, missingGeometry=${inputMissingGeometry}, invalidGeometries=${invalidFeatureCount}) (invalidRings=${invalidRingCount}, openRings=${openRingCount}, emptyRings=${emptyRingCount}, nonFiniteCoords=${nonFiniteCoordCount}, minRingVertices=${minRingVertices ?? '-'}) (selfIntersections=${selfIntersectionCount}, degenerateRings=${degenerateRingCount}, duplicateVertices=${duplicateVertexCount}, minRingArea=${formatArea(minRingArea)}, maxRingArea=${formatArea(maxRingArea)}, maxRingVertices=${maxRingVertices ?? '-'}, avgRingVertices=${formatAverage(avgRingVertices)}) (simplifyAttempt=${simplifyAttempt})${simplifySummary}${sampleDetails.length ? ` (samples=${sampleDetails.join(' | ')})` : ''}${analysisNote}`,
        };
      }
      await updateTaskPhase(taskId, 'vertex-limit-retry:start', taskProgressRange.simplifyEnd);
      const maxRetrySteps = 8;
      const resolveRetryToleranceStep = (): number => configuredRetryToleranceStep;
      const retryToleranceStep = resolveRetryToleranceStep();
      const countVertexLimitOverages = (collection: FeatureCollection) => {
        let maxVertexCount = 0;
        let overLimitFeatureCount = 0;
        for (const feature of collection.features) {
          if (!feature?.geometry) continue;
          const vertexCount = countVerticesFromGeometry(feature.geometry);
          if (vertexCount < retryVertexLimit) continue;
          overLimitFeatureCount += 1;
          maxVertexCount = Math.max(maxVertexCount, vertexCount);
        }
        return { maxVertexCount, overLimitFeatureCount };
      };

      const resolveRetryToleranceK = (baseToleranceK: number) => baseToleranceK;

      const simplifyFeatureWithTolerance = (feature: Feature, baseToleranceK: number): Feature => {
        const effectiveToleranceK = resolveRetryToleranceK(baseToleranceK);
        return geometryOps.simplifyFeature(feature, band.zMax, effectiveToleranceK);
      };

      const runRetrySimplifyFeature = async (feature: Feature, baseToleranceK: number): Promise<Feature | null> => {
        const retrySimplifyPromise = runStageWithLabel('simplify-only:retry', () => (
          simplifyFeatureWithTolerance(feature, baseToleranceK)
        ));
        return await runWithStallTimeout({
          promise: retrySimplifyPromise,
          stage: 'simplify-only:retry',
          nodeId: String(task.nodeId),
          taskId,
          timeoutMs: 300000,
          getLastProgressAt: () => Date.now(),
        });
      };

      const retrySimplifyFeatureIfNeeded = async (
        feature: Feature,
        params: {
          featureIndex: number;
          featureTotal: number;
        },
      ): Promise<{
        feature: Feature;
        vertexCount: number;
        overLimit: boolean;
        retryAttempts: number;
        finalTolerance: number;
      }> => {
        if (!feature.geometry) {
          return { feature, vertexCount: 0, overLimit: false, retryAttempts: 0, finalTolerance: tolerance };
        }
        const baseVertexCount = countVerticesFromGeometry(feature.geometry);
        if (baseVertexCount < retryVertexLimit) {
          return {
            feature,
            vertexCount: baseVertexCount,
            overLimit: false,
            retryAttempts: 0,
            finalTolerance: tolerance,
          };
        }

        let lastFailTolerance = tolerance;
        let successTolerance: number | null = null;
        let successIndex: number | null = null;
        let bestFeature: Feature | null = null;
        let bestTolerance = tolerance;
        let bestVertexCount = baseVertexCount;
        let lastAttemptFeature: Feature = feature;
        let lastAttemptVertexCount = baseVertexCount;
        let lastAttemptTolerance = tolerance;
        let retryAttempts = 0;

        if (retryToleranceStep <= 0) {
          return {
            feature,
            vertexCount: baseVertexCount,
            overLimit: true,
            retryAttempts: 0,
            finalTolerance: tolerance,
          };
        }
        for (let i = 0; i < maxRetrySteps; i += 1) {
          const nextToleranceValue = tolerance + retryToleranceStep * (i + 1);
          await updateRetrySimplifyAttemptPhase(taskId, {
            featureIndex: params.featureIndex,
            featureTotal: params.featureTotal,
            attempt: retryAttempts + 1,
            attemptTotal: maxRetrySteps,
            tolerance: nextToleranceValue,
          });
          const retryFeature = await runRetrySimplifyFeature(feature, nextToleranceValue);
          retryAttempts += 1;
          lastAttemptTolerance = nextToleranceValue;
          if (!retryFeature?.geometry) break;
          const retryVertexCount = countVerticesFromGeometry(retryFeature.geometry);
          lastAttemptFeature = retryFeature;
          lastAttemptVertexCount = retryVertexCount;
          if (retryVertexCount < retryVertexLimit) {
            successTolerance = nextToleranceValue;
            successIndex = i;
            bestFeature = retryFeature;
            bestTolerance = nextToleranceValue;
            bestVertexCount = retryVertexCount;
            break;
          }
          lastFailTolerance = nextToleranceValue;
        }

        if (bestFeature && successTolerance !== null && successIndex !== null) {
          const bisectionSteps = 5 - Math.ceil(successIndex / 2);
          const bisectionAttemptTotal = maxRetrySteps + bisectionSteps;
          let low = lastFailTolerance;
          let high = successTolerance;
          for (let stepIndex = 0; stepIndex < bisectionSteps; stepIndex += 1) {
            const mid = (low + high) / 2;
            await updateRetrySimplifyAttemptPhase(taskId, {
              featureIndex: params.featureIndex,
              featureTotal: params.featureTotal,
              attempt: retryAttempts + 1,
              attemptTotal: bisectionAttemptTotal,
              tolerance: mid,
            });
            const midFeature = await runRetrySimplifyFeature(feature, mid);
            retryAttempts += 1;
            lastAttemptTolerance = mid;
            if (!midFeature?.geometry) break;
            const midVertexCount = countVerticesFromGeometry(midFeature.geometry);
            if (midVertexCount < retryVertexLimit) {
              high = mid;
              bestFeature = midFeature;
              bestTolerance = mid;
              bestVertexCount = midVertexCount;
            } else {
              low = mid;
            }
          }
          if (bestFeature) {
            return {
              feature: bestFeature,
              vertexCount: bestVertexCount,
              overLimit: false,
              retryAttempts,
              finalTolerance: bestTolerance,
            };
          }
        }

        return {
          feature: lastAttemptFeature,
          vertexCount: lastAttemptVertexCount,
          overLimit: lastAttemptVertexCount >= retryVertexLimit,
          retryAttempts,
          finalTolerance: lastAttemptTolerance,
        };
      };

      let adjustedSimplified = simplified;
      let vertexLimitStats = countVertexLimitOverages(adjustedSimplified);
      const retryDiagnosticsByFeatureIndex = new Map<number, {
        retryAttempts: number;
        finalTolerance: number;
        finalVertexCount: number;
      }>();
      let retryAttemptsTotal = 0;
      let retryAttemptedFeatureCount = 0;
      let maxRetryAttemptsPerFeature = 0;
      let minFinalTolerance = Number.POSITIVE_INFINITY;
      let maxFinalTolerance = Number.NEGATIVE_INFINITY;
      if (vertexLimitStats.overLimitFeatureCount > 0) {
        const nextFeatures: Feature[] = [];
        let maxVertexCount = 0;
        let overLimitFeatureCount = 0;
        for (const [featureIndex, feature] of adjustedSimplified.features.entries()) {
          if (!feature?.geometry) {
            nextFeatures.push(feature);
            continue;
          }
          const result = await retrySimplifyFeatureIfNeeded(feature, {
            featureIndex: featureIndex + 1,
            featureTotal: adjustedSimplified.features.length,
          });
          retryDiagnosticsByFeatureIndex.set(featureIndex, {
            retryAttempts: result.retryAttempts,
            finalTolerance: result.finalTolerance,
            finalVertexCount: result.vertexCount,
          });
          nextFeatures.push(result.feature);
          maxVertexCount = Math.max(maxVertexCount, result.vertexCount);
          if (result.overLimit) {
            overLimitFeatureCount += 1;
          }
          retryAttemptsTotal += result.retryAttempts;
          if (result.retryAttempts > 0) {
            retryAttemptedFeatureCount += 1;
          }
          maxRetryAttemptsPerFeature = Math.max(maxRetryAttemptsPerFeature, result.retryAttempts);
          if (Number.isFinite(result.finalTolerance)) {
            minFinalTolerance = Math.min(minFinalTolerance, result.finalTolerance);
            maxFinalTolerance = Math.max(maxFinalTolerance, result.finalTolerance);
          }
        }
        adjustedSimplified = {
          ...adjustedSimplified,
          features: nextFeatures,
        };
        vertexLimitStats = { maxVertexCount, overLimitFeatureCount };
      }
      if (anomalyProfile === 'polygon') {
        const repairedSimplified = repairCollectionSelfIntersections(
          adjustedSimplified,
          geometryOps,
          geometryEngine,
          {
            sourceKey: input.sourceKey,
            maxIssueRecords: 200,
          },
        );
        if (repairedSimplified.repairedFeatureCount > 0) {
          console.info('[ShapeTransform][SimplifyOnlyMetrics] repaired self-intersections after simplify', {
            nodeId: task.nodeId,
            taskId,
            bandIndex: input.bandIndex,
            zTarget: band.zMax,
            repairedFeatures: repairedSimplified.repairedFeatureCount,
            repairIssueRows: repairedSimplified.repairedIssues.length,
          });
          await persistTransformIssues(repairedSimplified.repairedIssues, {
            idPrefix: `${task.taskId}:repair`,
            taskId: task.taskId,
            nodeId: task.nodeId,
            bandIndex: input.bandIndex,
            sourceKey: input.sourceKey,
            countryCode: input.countryCode,
            adminLevel: input.adminLevel,
          });
          emitTransformTrace(traceLogLevel, 'summary', 'polygon-repair-applied', {
            sessionId: String(task.nodeId),
            taskId,
            stage: 'simplify',
            repairedFeatureCount: repairedSimplified.repairedFeatureCount,
            persistedIssueCount: repairedSimplified.repairedIssues.length,
          });
        }
        simplified = repairedSimplified.collection;
      } else {
        simplified = adjustedSimplified;
        emitTransformTrace(traceLogLevel, 'summary', 'polygon-repair-skipped', {
          sessionId: String(task.nodeId),
          taskId,
          stage: 'simplify',
          profile: anomalyProfile,
        });
      }

      await updateTaskPhase(taskId, 'vertex-limit-validate:start', taskProgressRange.simplifyEnd);
      const simplifiedFeatureCount = simplified.features.length;
      stageLabel = 'validate:vertex-limit';
      let maxVertexCount = 0;
      let overLimitFeatureCount = 0;
      let finalVertexCountSummary = 0;
      let finalRetryAttemptsSummary = 0;
      let finalToleranceSummary = tolerance;
      const vertexLimitRecords: ShapeTransformErrorRecord[] = [];
      const vertexRecordLimit = 200;
      for (const [featureIndex, feature] of simplified.features.entries()) {
        if (!feature?.geometry) continue;
        const vertexCount = countVerticesFromGeometry(feature.geometry);
        if (vertexCount < retryVertexLimit) continue;
        overLimitFeatureCount += 1;
        maxVertexCount = Math.max(maxVertexCount, vertexCount);
        if (vertexLimitRecords.length >= vertexRecordLimit) continue;
        const featureId = resolveFeatureIdentifier(feature, featureIndex, input.sourceKey);
        const retryDiagnostics = retryDiagnosticsByFeatureIndex.get(featureIndex);
        const retryAttempts = retryDiagnostics?.retryAttempts ?? 0;
        const finalTolerance = retryDiagnostics?.finalTolerance ?? tolerance;
        const finalVertexCount = retryDiagnostics?.finalVertexCount ?? vertexCount;
        if (finalVertexCount > finalVertexCountSummary) {
          finalVertexCountSummary = finalVertexCount;
          finalRetryAttemptsSummary = retryAttempts;
          finalToleranceSummary = finalTolerance;
        }
        const lineFeaturesCandidate = buildErrorLineFeatures(feature.geometry, featureId);
        const summary = analyzeGeometryIssues(feature.geometry, geometryOps);
        vertexLimitRecords.push({
          id: `${task.taskId}:vertex-limit:${featureIndex}`,
          nodeId: task.nodeId,
          taskId: task.taskId,
          stage: 'transform',
          issueStage: 'simplify-only',
          issueKind: 'max-vertices',
          bandIndex: input.bandIndex,
          sourceKey: input.sourceKey,
          countryCode: input.countryCode,
          adminLevel: input.adminLevel,
          featureId,
          featureIndex,
          geometryType: lineFeaturesCandidate?.geometryType ?? feature.geometry.type,
          polygonCount: summary.polygonCount,
          ringCount: summary.ringCount,
          polygonErrorCount: summary.polygonCount,
          ringErrorCount: summary.ringCount,
          message: `max vertices per feature exceeded (vertexCount=${vertexCount} finalVertexCount=${finalVertexCount} limit=${retryVertexLimit} retryAttempts=${retryAttempts} finalTolerance=${formatTolerance(finalTolerance)})`,
          createdAt: Date.now(),
          lineFeatures: {
            type: 'FeatureCollection',
            features: lineFeaturesCandidate?.features ?? [],
          },
        });
      }
      if (overLimitFeatureCount > 0) {
        const finalToleranceMinValue = Number.isFinite(minFinalTolerance) ? minFinalTolerance : tolerance;
        const finalToleranceMaxValue = Number.isFinite(maxFinalTolerance) ? maxFinalTolerance : tolerance;
        const finalVertexCount = finalVertexCountSummary > 0 ? finalVertexCountSummary : maxVertexCount;
        const finalRetryAttempts = finalVertexCountSummary > 0 ? finalRetryAttemptsSummary : maxRetryAttemptsPerFeature;
        const finalTolerance = Number.isFinite(finalToleranceSummary) ? finalToleranceSummary : tolerance;
        const retrySummary = [
          `retryAttemptsTotal=${retryAttemptsTotal}`,
          `retriedFeatures=${retryAttemptedFeatureCount}/${simplifiedFeatureCount}`,
          `maxRetriesPerFeature=${maxRetryAttemptsPerFeature}`,
          `retryStep=${formatTolerance(retryToleranceStep)}`,
          `finalToleranceRange=${formatTolerance(finalToleranceMinValue)}..${formatTolerance(finalToleranceMaxValue)}`,
        ].join(', ');
        if (vertexLimitRecords.length > 0) {
          try {
            await ephemeralDB.transformErrors.bulkPut(vertexLimitRecords);
            if (overLimitFeatureCount > vertexLimitRecords.length) {
              console.warn('[ShapeTransform] vertex limit error records truncated', {
                nodeId: task.nodeId,
                taskId: task.taskId,
                limit: vertexRecordLimit,
                totalFeatures: overLimitFeatureCount,
              });
            }
          } catch (storageError) {
            console.warn('[ShapeTransform] failed to persist vertex limit error records', storageError);
          }
        }
        await reportPolygonProgress(task.taskId, 0, inputPolygonCount);
        return {
          status: 'failed',
          errorMessage: `transform failed: max vertices per feature exceeded (limit=${retryVertexLimit}, overLimit=${overLimitFeatureCount}/${simplifiedFeatureCount}, maxVertices=${maxVertexCount}, finalVertexCount=${finalVertexCount}, finalRetryAttempts=${finalRetryAttempts}, finalTolerance=${formatTolerance(finalTolerance)}, ${retrySummary})`,
        };
      }

      await updateTaskPhase(taskId, 'vertex-limit-validate:done', taskProgressRange.simplifyEnd);
      const adminLevel = input.adminLevel;
      const layerName = typeof adminLevel === 'number' ? `admin${adminLevel}` : 'admin0';
      const boundaryLayerName = typeof adminLevel === 'number'
        ? `admin${adminLevel}-boundary`
        : 'admin0-boundary';
      const boundaryDisableAtZoomOrAbove = transformConfig.boundaryDisableAtZoomOrAbove;
      const shouldBuildBoundary = typeof boundaryDisableAtZoomOrAbove === 'number'
        ? band.zMax < boundaryDisableAtZoomOrAbove
        : true;

      const simplifiedVertexCount = simplified.features.reduce(
        (sum, feature) => sum + countVerticesFromGeometry(feature.geometry),
        0,
      );
      const simplifiedPolygonCount = simplified.features.reduce(
        (sum, feature) => sum + countPolygonsFromGeometry(feature.geometry),
        0,
      );

      await updateTaskPhase(taskId, 'output:build:start', taskProgressRange.outputBuildStart);
      logDebugPhase('output-build:start', {
        featureCount: simplifiedFeatureCount,
        polygonCount: simplifiedPolygonCount,
      });
      const features: Feature[] = [];
      let outputVertexCount = 0;
      let outputPolygonCount = 0;
      for (let index = 0; index < simplified.features.length; index++) {
        assertNotAborted(abortSignal);
        const feature = simplified.features[index];
        if (!feature) continue;
        const properties = {
          ...(feature.properties ?? {}),
          layer: layerName,
          level: adminLevel,
        } as Record<string, unknown> & { id?: string };
        const id = properties.id ?? `${input.sourceKey}:${index}`;
        properties.id = id;
        const featureWithId = { ...feature, id, properties };
        features.push(featureWithId);
        outputVertexCount += countVerticesFromGeometry(featureWithId.geometry);
        outputPolygonCount += countPolygonsFromGeometry(featureWithId.geometry);
        if (shouldBuildBoundary) {
          stageLabel = 'boundary';
          const boundaryFeature = await runStageWithLabel(
            'boundary',
            () => buildBoundaryFeature(featureWithId, boundaryLayerName, adminLevel),
          );
          features.push(boundaryFeature);
          outputVertexCount += countVerticesFromGeometry(boundaryFeature.geometry);
          outputPolygonCount += countPolygonsFromGeometry(boundaryFeature.geometry);
        }
      }

      let outputCollectionValue: FeatureCollection = {
        type: 'FeatureCollection',
        features,
      };
      logDebugPhase('output-build:done', { featureCount: outputCollectionValue.features.length });
      if (outputCollectionValue.features.length === 0) {
        await reportPolygonProgress(taskId, inputPolygonCount, inputPolygonCount);
        return {
          status: 'completed',
          progress: 100,
          display: {
            kind: 'skip',
            key: 'stage.taskSkip.emptyOutputAfterSimplify',
            params: {
              inputFeatures: inputFeatureCount,
            },
          },
          outputData: {
            processedPolygons: inputPolygonCount,
            totalPolygons: inputPolygonCount,
          },
        };
      }
      if (vtOutputQualityGuard?.enabled && baselineMetrics) {
        const isWithinZoomRange = band.zMax >= vtOutputQualityGuard.minZoom
          && band.zMax <= vtOutputQualityGuard.maxZoom;
        if (isWithinZoomRange) {
          const outputMetrics = collectCollectionAnomalyMetrics(outputCollectionValue, geometryOps);
          const outputAssessment = assessAnomalyRisk({
            profile: anomalyProfile,
            baseline: baselineMetrics,
            candidate: outputMetrics,
            thresholds: anomalyDetectionConfig,
          });
          emitTransformTrace(traceLogLevel, 'summary', 'vt-quality-guard', {
            sessionId: String(task.nodeId),
            taskId,
            stage: 'output',
            profile: anomalyProfile,
            zTarget: band.zMax,
            actionOnAnomaly: vtOutputQualityGuard.actionOnAnomaly,
            assessment: outputAssessment,
          });
          if (outputAssessment.isAnomalous && vtOutputQualityGuard.actionOnAnomaly === 'drop_tile') {
            await reportPolygonProgress(taskId, inputPolygonCount, inputPolygonCount);
            return {
              status: 'completed',
              progress: 100,
              display: {
                kind: 'info',
                key: 'stage.taskWarning.vtQualityGuardDropped',
                params: {
                  score: outputAssessment.score.toFixed(3),
                  reasons: outputAssessment.reasons.join(','),
                },
              },
              outputData: {
                processedPolygons: inputPolygonCount,
                totalPolygons: inputPolygonCount,
              },
            };
          }
        }
      }

      const boundaryDiagnostics = buildBoundaryDiagnostics(outputCollectionValue);
      if (boundaryDiagnostics && isTaskDebugLoggingEnabled()) {
        console.debug('[ShapeTransform][BoundaryDiagnostics]', JSON.stringify({
          nodeId: task.nodeId,
          taskId,
          sourceKey: input.sourceKey,
          adminLevel: input.adminLevel,
          bandIndex: input.bandIndex,
          zTarget: band.zMax,
          boundary: boundaryDiagnostics,
        }));
      }

      stageLabel = 'validate:geojson';
      const issues = validateOutputForVt(outputCollectionValue);
      if (issues.length > 0) {
        const sample = issues.slice(0, 5);
        console.error('[ShapeTransform][GeojsonValidation]', JSON.stringify({
          nodeId: task.nodeId,
          taskId,
          sourceKey: input.sourceKey,
          adminLevel: input.adminLevel,
          bandIndex: input.bandIndex,
          zTarget: band.zMax,
          issueCount: issues.length,
          sample,
        }));
        throw new Error(`transform failed: invalid geojson for vt (issues=${issues.length})`);
      }

      const cacheId = `${task.nodeId}-b${input.bandIndex}-${input.domainType}-${input.sourceKey}`;
      const vertexCount = outputVertexCount;
      const polygonCount = outputPolygonCount;
      assertNotAborted(abortSignal);
      stageLabel = 'encode';
      await updateTaskPhase(taskId, 'output:build:done', taskProgressRange.outputBuildEnd);
      await updateTaskPhase(taskId, 'encode:start', taskProgressRange.encodeStart, {
        key: 'stage.taskPhase.transformCacheEncodeStart',
      });
      logDebugPhase('encode:start', { featureCount: outputCollectionValue.features.length });
      outputCollection = outputCollectionValue;
      const encoded = await runStageWithLabel('encode', () => encodeFlatGeobufFromFeatureCollection(outputCollectionValue));
      if (encoded.byteLength === 0) {
        throw new Error('transform failed: empty transform cache buffer');
      }
      if ((globalThis as { __HDB_VT_DEBUG_COLLECT?: boolean }).__HDB_VT_DEBUG_COLLECT === true) {
        const data = encoded;
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
        console.info('[ShapeTransform][TaskDebug] transform cache encode probe', {
          tag: TASKDEBUG_BUILD_TAG,
          nodeId: String(task.nodeId),
          cacheId: String(cacheId),
          dataType: typeof data,
          dataConstructorName,
          dataByteLength,
          dataSize,
          isArrayBuffer,
          isArrayBufferView,
          isUint8Array,
        });
      }
      stageLabel = 'encode:validate';
      await runStageWithLabel('encode:validate', () => validateEncodedFlatGeobuf(encoded));
      logDebugPhase('encode:done', { byteLength: encoded.byteLength });
      await updateTaskPhase(taskId, 'encode:done', taskProgressRange.encodeEnd, {
        key: 'stage.taskPhase.transformCacheEncodeDone',
      });
      const extractionRatio = inputFeatureCount > 0 ? simplified.features.length / inputFeatureCount : 0;
      stageLabel = 'cache:put';
      assertNotAborted(abortSignal);
      await updateTaskPhase(taskId, 'cache:put:start', taskProgressRange.cachePutStart);
      logDebugPhase('cache-put:start', { cacheId });

      await finalizeTaskWithCache({
        taskId,
        cacheRecord: {
          id: cacheId,
          nodeId: task.nodeId,
          bandIndex: input.bandIndex,
          domainType: input.domainType,
          sourceKey: input.sourceKey,
          countryCode: input.countryCode,
          adminLevel: input.adminLevel,
          data: encoded,
          featureCount: features.length,
          vertexCount,
          polygonCount,
          extractionRatio,
          tolerance: tolerance,
        },
        metrics: {
          features: { input: inputFeatureCount, output: simplifiedFeatureCount },
          polygons: { input: inputPolygonCount, output: simplifiedPolygonCount },
          vertices: { input: inputVertexCount, output: simplifiedVertexCount },
        },
        outputData: {
          processedPolygons: inputPolygonCount,
          totalPolygons: inputPolygonCount,
        },
      });
      if ((globalThis as { __HDB_VT_DEBUG_COLLECT?: boolean }).__HDB_VT_DEBUG_COLLECT === true) {
        const saved = await ephemeralDB.transformCache.get(cacheId);
        const data = saved?.data ?? null;
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
        console.info('[ShapeTransform][TaskDebug] transform cache readback probe', {
          tag: TASKDEBUG_BUILD_TAG,
          nodeId: String(task.nodeId),
          cacheId: String(cacheId),
          hasRecord: Boolean(saved),
          recordKeys: saved ? Object.keys(saved) : [],
          dataType: data === null ? 'null' : typeof data,
          dataConstructorName,
          dataByteLength,
          dataSize,
          isArrayBuffer,
          isArrayBufferView,
          isUint8Array,
          timestamp: saved?.timestamp ?? null,
        });
      }
      logDebugPhase('cache-put:done', { cacheId });

      const tileIds = collectTileIdsForCollection(outputCollectionValue, band.zBase, geometryOps);
      console.info('[ShapeTransform][TileIndex]', JSON.stringify({
        nodeId: String(task.nodeId),
        bandIndex: input.bandIndex,
        zBase: band.zBase,
        sourceKey: input.sourceKey,
        adminLevel: input.adminLevel,
        tileIdCount: tileIds.length,
        tileIdSample: tileIds.slice(0, 5),
      }));
      if (tileIds.length > 0) {
        const createdAt = Date.now();
        const relationFeatureCount = features.length;
        const cacheTimestamp = createdAt;
        const relations = tileIds.map((tileId) => ({
          id: `${task.nodeId}:${input.bandIndex}:${tileId}:${cacheId}`,
          nodeId: task.nodeId,
          bandIndex: input.bandIndex,
          tileId: String(tileId),
          bufferId: cacheId,
          featureCount: relationFeatureCount,
          cacheTimestamp,
          createdAt,
        }));
        try {
          await withTimeout({
            taskId,
            operation: 'tile-index:delete-old-relations',
            timeoutMs: TRANSFORM_DB_WRITE_TIMEOUT_MS,
            promise: ephemeralDB.tileIdToBufferRelations.where('bufferId').equals(cacheId).delete(),
          });
          await withTimeout({
            taskId,
            operation: 'tile-index:bulkPut-relations',
            timeoutMs: TRANSFORM_DB_WRITE_TIMEOUT_MS,
            promise: ephemeralDB.tileIdToBufferRelations.bulkPut(relations),
          });
        } catch (storageError) {
          const reason = storageError instanceof Error ? storageError.message : String(storageError);
          throw new Error(`transform failed: tile index relation write failed (taskId=${taskId}, reason=${reason})`);
        }
      }

      return {
        status: 'completed',
        progress: 100,
        display: {
          kind: 'summary',
          key: 'stage.taskSummary.metrics',
          metrics: {
            features: { input: inputFeatureCount, output: simplifiedFeatureCount },
            polygons: { input: inputPolygonCount, output: simplifiedPolygonCount },
            vertices: { input: inputVertexCount, output: simplifiedVertexCount },
          },
        },
        outputData: {
          processedPolygons: inputPolygonCount,
          totalPolygons: inputPolygonCount,
        },
        taskUpdated: true,
      };
    } catch (error) {
      if (abortSignal?.aborted) {
        throw error;
      }
      const err = error instanceof Error ? error.message : String(error);
      const stagedError = err.startsWith('stage=') ? err : `stage=${stageLabel} ${err}`;
      logDebugPhase('task-error', { error: stagedError });
      const diagnostics = [
        buildCollectionDiagnostics(workingCollection, 'input', geometryOps),
        buildCollectionDiagnostics(simplified, 'simplified', geometryOps),
        buildCollectionDiagnostics(outputCollection, 'output', geometryOps),
      ].filter((value): value is string => Boolean(value)).join(' ');
      let progressUpdateError: string | null = null;
      try {
        await reportPolygonProgress(task.taskId, 0, inputPolygonCount);
      } catch (progressError) {
        progressUpdateError = progressError instanceof Error ? progressError.message : String(progressError);
        console.error('[ShapeTransform] failed to update progress during error handling', {
          taskId: task.taskId,
          progressUpdateError,
        });
      }
      return {
        status: 'failed',
        errorMessage: `transform failed: ${stagedError}${diagnostics ? ` | diagnostics: ${diagnostics}` : ''}${progressUpdateError ? ` | progressUpdateError: ${progressUpdateError}` : ''}`,
      };
    } finally {
      if (debugHeartbeat) {
        clearInterval(debugHeartbeat);
      }
      logDebugPhase('task-end');
    }
  };
};
