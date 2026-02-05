import type { Feature, FeatureCollection, Geometry, LineString, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import {
  area as turfArea,
  bbox as turfBbox,
  bboxClip as turfBboxClip,
  booleanValid as turfBooleanValid,
  kinks as turfKinks,
  simplify as turfSimplify,
} from '@turf/turf';
import type { Topology } from 'topojson-specification';
import { feature as topojsonFeature } from 'topojson-client';
import { presimplify as topojsonPresimplify, simplify as topojsonSimplify } from 'topojson-simplify';
import { geojson as geojsonApi } from 'flatgeobuf';
import { applyFeatureFiltering, encodeFlatGeobufFromFeatureCollection, latToTileY, lonToTileX } from '@hierarchidb/gis-sdk';
import type { AreaBasedToleranceConfig } from '@hierarchidb/gis-sdk';
import type { ShapeTransformErrorRecord } from '@hierarchidb/shape-api';
import {
  buildBoundaryFeature,
  resolveLargeAreaToleranceForCollection,
} from './geometry.js';
import { quantizeTopoJsonToGrid } from './topojsonGrid.js';
import type { TransformByBandStageContext } from '../contexts.js';
import type { StageHandler, StageHandlerResult, TransformByBandTaskInput } from '../types/types.js';
import { VtTaskQueueDb, updateTask } from '../task/taskQueue.js';
import { packTileId } from '../tiles/tileId.js';

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

const normalizeTopoJsonCollection = (topology: Topology): FeatureCollection => {
  const object = resolveTopoJsonObject(topology);
  if (!object) return { type: 'FeatureCollection', features: [] };
  const geojson = topojsonFeature(topology, object);
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
  areaBasedToleranceConfig: AreaBasedToleranceConfig;
  quantize?: number;
}): Promise<FeatureCollection | null> => {
  const decompressed = params.compression === 'gzip'
    ? await decompressGzip(params.buffer)
    : params.buffer;
  const topology = decodeTopoJson(decompressed);
  const snappedTopology = quantizeTopoJsonToGrid(topology, {
    zTarget: params.zTarget,
    quantize: params.quantize,
  });
  let { collection, appliedToleranceK } = simplifyTopoJsonByZoom({
    topology: snappedTopology,
    zTarget: params.zTarget,
    toleranceK: params.toleranceK,
    areaBasedToleranceConfig: params.areaBasedToleranceConfig,
  });
  let maxVertices = maxVerticesInCollection(collection);
  if (maxVertices > MAX_VERTICES_PER_FEATURE) {
    const retryToleranceK = appliedToleranceK * 1.5;
    const retry = simplifyTopoJsonByZoom({
      topology,
      zTarget: params.zTarget,
      toleranceK: retryToleranceK,
      areaBasedToleranceConfig: params.areaBasedToleranceConfig,
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

const metersPerPixel = (z: number): number => {
  return (2 * Math.PI * EARTH_RADIUS_METERS) / (MVT_EXTENT * Math.pow(2, z));
};

const resolveSimplifyToleranceDegrees = (zTarget: number, toleranceK: number): number => {
  if (!Number.isFinite(zTarget) || !Number.isFinite(toleranceK)) return 0;
  const toleranceMeters = toleranceK * metersPerPixel(zTarget);
  if (!Number.isFinite(toleranceMeters) || toleranceMeters <= 0) return 0;
  return (toleranceMeters / (2 * Math.PI * EARTH_RADIUS_METERS)) * 360;
};

const resolveTransformTolerance = (
  baseTolerance: number,
  zTarget: number,
): number => {
  if (!Number.isFinite(baseTolerance)) return baseTolerance;
  if (zTarget <= 2) return 10.0;
  return 10.0;
};

const simplifyTopoJsonByZoom = (params: {
  topology: Topology;
  zTarget: number;
  toleranceK: number;
  areaBasedToleranceConfig: AreaBasedToleranceConfig;
}): { topology: Topology; collection: FeatureCollection; appliedToleranceK: number } => {
  const baseCollection = normalizeTopoJsonCollection(params.topology);
  const appliedToleranceK = resolveLargeAreaToleranceForCollection(
    baseCollection,
    params.zTarget,
    params.areaBasedToleranceConfig,
    params.toleranceK,
  );
  const tolerance = resolveSimplifyToleranceDegrees(params.zTarget, appliedToleranceK);
  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    return { topology: params.topology, collection: baseCollection, appliedToleranceK };
  }
  const presimplified = topojsonPresimplify(params.topology);
  const simplified = topojsonSimplify(presimplified, tolerance);
  const simplifiedCollection = normalizeTopoJsonCollection(simplified);
  return { topology: simplified, collection: simplifiedCollection, appliedToleranceK };
};

const simplifyOnlyCollection = (
  collection: FeatureCollection,
  zTarget: number,
  toleranceK: number,
  areaBasedToleranceConfig: AreaBasedToleranceConfig,
  options?: { skipLargeArea?: boolean },
): FeatureCollection => {
  if (typeof turfSimplify !== 'function') return collection;
  const effectiveToleranceK = options?.skipLargeArea
    ? toleranceK
    : resolveLargeAreaToleranceForCollection(
      collection,
      zTarget,
      areaBasedToleranceConfig,
      toleranceK,
    );
  const tolerance = resolveSimplifyToleranceDegrees(zTarget, effectiveToleranceK);
  if (!Number.isFinite(tolerance) || tolerance <= 0) return collection;
  return turfSimplify(collection, {
    tolerance,
    highQuality: false,
    mutate: false,
  }) as FeatureCollection;
};

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

const isLineOrPolygonFeature = (
  feature: Feature<Geometry>,
): feature is Feature<LineString | MultiLineString | Polygon | MultiPolygon> => {
  const type = feature.geometry?.type;
  return type === 'LineString'
    || type === 'MultiLineString'
    || type === 'Polygon'
    || type === 'MultiPolygon';
};

const featureIntersectsTileBBox = (feature: Feature<Geometry>, bbox: { minX: number; minY: number; maxX: number; maxY: number }): boolean => {
  if (isAnyPointInBBox(feature.geometry ?? null, bbox)) return true;
  if (!isLineOrPolygonFeature(feature)) return false;
  const clipped = turfBboxClip(
    feature as Feature<LineString | MultiLineString | Polygon | MultiPolygon>,
    [bbox.minX, bbox.minY, bbox.maxX, bbox.maxY],
  );
  return Boolean(clipped?.geometry && hasCoordinates(clipped.geometry.coordinates));
};

const collectTileIdsForCollection = (collection: FeatureCollection, zBase: number): number[] => {
  if (!Number.isFinite(zBase) || zBase < 0) return [];
  const maxIndex = (1 << zBase) - 1;
  const tileIds = new Set<number>();
  for (const feature of collection.features) {
    if (!feature?.geometry) continue;
    const [minLon, minLat, maxLon, maxLat] = turfBbox(feature as Feature<Geometry>);
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
        if (!featureIntersectsTileBBox(feature as Feature<Geometry>, tileBBox)) continue;
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

const countSelfIntersections = (geometry: Geometry): number => {
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return 0;
  try {
    const polygonGeometry = geometry as Polygon | MultiPolygon;
    const feature: Feature<Polygon | MultiPolygon> = { type: 'Feature', geometry: polygonGeometry, properties: {} };
    const result = turfKinks(feature);
    return Array.isArray(result?.features) ? result.features.length : 0;
  } catch {
    return 0;
  }
};

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

const analyzeGeometryIssues = (geometry?: Geometry | null): GeometryIssueSummary => {
  if (!geometry) return buildEmptyGeometrySummary('none');

  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    let ringVertexTotal = 0;
    let ringCount = 0;
    const summary = geometries.reduce<GeometryIssueSummary>((acc, child) => {
      const childSummary = analyzeGeometryIssues(child);
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
      selfIntersectionCount: countSelfIntersections(geometry),
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
    summary.selfIntersectionCount = countSelfIntersections(geometry);
    if (summary.selfIntersectionCount > 0 && summary.errorPolygonCount === 0 && summary.polygonCount > 0) {
      summary.errorPolygonCount = summary.polygonCount;
    }
    summary.avgRingVertices = ringCount > 0 ? ringVertexTotal / ringCount : null;
    return summary;
  }

  return buildEmptyGeometrySummary(geometry.type);
};


const isGeometryBooleanValid = (geometry?: Geometry | null): boolean => {
  if (!geometry) return true;
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return true;
  try {
    const feature: Feature<Polygon | MultiPolygon> = { type: 'Feature', geometry, properties: {} };
    return turfBooleanValid(feature);
  } catch {
    return false;
  }
};

const filterFeaturesByAspectRatioAndArea = (
  features: Feature[],
  aspectRatioThreshold: number,
  areaThreshold: number,
): Feature[] => {
  if (aspectRatioThreshold <= 0 && areaThreshold <= 0) return features;
  return features.filter((feature) => {
    if (!feature?.geometry) return false;
    if (areaThreshold > 0) {
      const areaSqKm = turfArea(feature as Feature<Geometry>) / 1_000_000;
      if (areaSqKm < areaThreshold) return false;
    }
    if (aspectRatioThreshold > 0) {
      const [minX, minY, maxX, maxY] = turfBbox(feature as Feature<Geometry>);
      const width = Math.abs(maxX - minX);
      const height = Math.abs(maxY - minY);
      const ratio = width == 0 || height == 0 ? Number.POSITIVE_INFINITY : Math.max(width / height, height / width);
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

const buildCollectionDiagnostics = (collection: FeatureCollection | null, label: string): string | null => {
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
    const summary = analyzeGeometryIssues(feature.geometry);
    invalidRingCount += summary.invalidRingCount;
    openRingCount += summary.openRingCount;
    emptyRingCount += summary.emptyRingCount;
    nonFiniteCoordCount += summary.nonFiniteCoordCount;
    degenerateRingCount += summary.degenerateRingCount;
    duplicateVertexCount += summary.duplicateVertexCount;
    selfIntersectionCount += summary.selfIntersectionCount;
    const isValid = isGeometryBooleanValid(feature.geometry);
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
  const { ephemeralDB, transformConfig, bands, abortSignal, featureIdAllowlist } = context;
  const taskQueue = new VtTaskQueueDb();
  const taskProgressRange = {
    decodeEnd: 10,
    prepareEnd: 20,
    simplifyStart: 20,
    simplifyEnd: 85,
    outputEnd: 95,
    encodeEnd: 100,
  } as const;
  const reportPolygonProgress = async (
    taskId: string,
    processedPolygons: number,
    totalPolygons: number,
    message?: string,
  ): Promise<void> => {
    const total = Math.max(0, Math.round(totalPolygons));
    const processed = Math.max(0, Math.round(processedPolygons));
    try {
      await updateTask(taskQueue, taskId, {
        ...(message ? { message } : {}),
        outputData: {
          processedPolygons: processed,
          totalPolygons: total,
        },
      });
    } catch (error) {
      console.warn('[transform] failed to report polygon progress', error);
    }
  };
  const updateTaskPhase = async (taskId: string, phase: string, progress?: number): Promise<void> => {
    try {
      await updateTask(taskQueue, taskId, {
        message: `phase=${phase}`,
        ...(progress !== undefined ? { progress } : {}),
      });
    } catch (error) {
      console.warn('[transform] failed to update task phase', { phase, error });
    }
  };
  // Feature filtering is intentionally disabled during transform stage while investigating geometry distortion.
  const enableFeatureFiltering = false;
  const baseTolerance = transformConfig.tolerance;
  if (typeof baseTolerance !== 'number') {
    throw new Error('transform requires tolerance');
  }
  const bandMap = new Map(bands.map((band) => [band.bandIndex, band] as const));

  return async (task): Promise<StageHandlerResult> => {
    const taskId = task.taskId;
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

    let workingCollection: FeatureCollection | null = null;
    let simplified: FeatureCollection | null = null;
    let outputCollection: FeatureCollection | null = null;
    let stageLabel = 'start';
    let inputPolygonCount = 0;
    let inputVertexCount = 0;

    try {
      stageLabel = 'fetch:cache';
      await updateTaskPhase(taskId, 'fetch-cache:start', 0);
      assertNotAborted(abortSignal);
      const fetchCache = await ephemeralDB.fetchCache.get(input.fetchCacheId);
      if (!fetchCache) {
        return { status: 'failed', errorMessage: 'transform failed: fetch cache not found' };
      }
      await updateTaskPhase(taskId, 'fetch-cache:done', 0);

      stageLabel = 'decode';
      await updateTaskPhase(taskId, 'decode:start', 5);
      assertNotAborted(abortSignal);
      let collection = await runStageWithLabel('decode', () => {
        if (fetchCache.format === 'topojson') {
          return decodeTopoJsonFetchCache({
            buffer: fetchCache.data,
            compression: fetchCache.compression,
            zTarget: band.zMax,
            toleranceK: baseTolerance,
            areaBasedToleranceConfig: transformConfig.areaBasedTolerance,
            quantize: transformConfig.quantize,
          });
        }
        return decodeFetchCache(fetchCache.data);
      });
      if (!collection || collection.features.length === 0) {
        return { status: 'failed', errorMessage: 'transform failed: empty fetch cache' };
      }
      await updateTaskPhase(taskId, 'decode:done', taskProgressRange.decodeEnd);

      if (featureIdAllowlist && featureIdAllowlist.size > 0) {
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
            await reportPolygonProgress(taskId, 0, 0);
            return {
              status: 'completed',
              progress: 100,
              message: 'skipped: no recycling features in cache',
              outputData: {
                processedPolygons: 0,
                totalPolygons: 0,
              },
            };
          }
          collection = { ...collection, features: filteredFeatures };
        }
      }
      workingCollection = collection;
      if (enableFeatureFiltering && transformConfig.enableFeatureFiltering) {
        stageLabel = 'filter:featureFiltering';
        await updateTaskPhase(taskId, 'filtering:start', taskProgressRange.decodeEnd);
        assertNotAborted(abortSignal);
        const filtered = await runStageWithLabel('filter:featureFiltering', () => applyFeatureFiltering(workingCollection, {
          minArea: transformConfig.featureAreaThreshold,
          featureFilterMethod: transformConfig.featureFilterMethod,
          minVertexCountForAreaFilter: transformConfig.minVertexCountForAreaFilter,
          hybridFilterConfig: transformConfig.hybridFilterConfig,
        }));
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
      stageLabel = 'counts:input';
      await updateTaskPhase(taskId, 'prepare:counts:start', taskProgressRange.decodeEnd);
      const inputStats = await runStageWithLabel('counts:input', () => {
        const polygonCounts = inputCollection.features.map((feature) => countPolygonsFromGeometry(feature?.geometry));
        const vertexCount = inputCollection.features.reduce(
          (sum, feature) => sum + countVerticesFromGeometry(feature?.geometry ?? null),
          0,
        );
        return { polygonCounts, vertexCount };
      });
      const inputPolygonCounts = inputStats.polygonCounts;
      inputPolygonCount = inputPolygonCounts.reduce((sum, value) => sum + value, 0);
      inputVertexCount = inputStats.vertexCount;
      await updateTaskPhase(taskId, 'prepare:counts:done', taskProgressRange.prepareEnd);
      await reportPolygonProgress(taskId, 0, inputPolygonCount);
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
      try {
        assertNotAborted(abortSignal);
        const simplifyStartAt = Date.now();
        stageLabel = 'simplify-only';
        console.log('[ShapeTransform][SimplifyOnlyMetrics] start', {
          nodeId: task.nodeId,
          taskId,
          bandIndex: input.bandIndex,
          zTarget: band.zMax,
          featureCount: inputFeatureCount,
          polygonCount: inputPolygonCount,
          missingGeometry: inputMissingGeometry,
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
        await updateTaskPhase(taskId, 'simplify-only:start', taskProgressRange.simplifyStart);
        const simplifyPromise = runStageWithLabel('simplify-only', () => (
          simplifyOnlyCollection(inputCollection, band.zMax, tolerance, transformConfig.areaBasedTolerance)
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
        console.log('[ShapeTransform][SimplifyOnlyMetrics] done', {
          nodeId: task.nodeId,
          taskId,
          bandIndex: input.bandIndex,
          zTarget: band.zMax,
          durationMs: Date.now() - simplifyStartAt,
          processedPolygons: processedPolygonCount,
          totalPolygons: inputPolygonCount,
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
            message: `skipped: simplify produced empty collection (features=0/${inputFeatureCount}, polygons=0/${inputPolygonCount})`,
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
              transformConfig.areaBasedTolerance,
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
            const summary = analyzeGeometryIssues(feature.geometry);
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
              const isValid = isGeometryBooleanValid(feature.geometry);
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
        await reportPolygonProgress(task.taskId, 0, inputPolygonCount);
        return {
          status: 'failed',
          errorMessage: `transform failed: geometry simplify error (extract1/${band.zMax}) (${err}) (invalidFeatures=${errorFeatureCount}/${inputFeatureCount}, invalidPolygons=${errorPolygonCount}/${inputPolygonCount}, missingGeometry=${inputMissingGeometry}, invalidGeometries=${invalidFeatureCount}) (invalidRings=${invalidRingCount}, openRings=${openRingCount}, emptyRings=${emptyRingCount}, nonFiniteCoords=${nonFiniteCoordCount}, minRingVertices=${minRingVertices ?? '-'}) (selfIntersections=${selfIntersectionCount}, degenerateRings=${degenerateRingCount}, duplicateVertices=${duplicateVertexCount}, minRingArea=${formatArea(minRingArea)}, maxRingArea=${formatArea(maxRingArea)}, maxRingVertices=${maxRingVertices ?? '-'}, avgRingVertices=${formatAverage(avgRingVertices)})${sampleDetails.length ? ` (samples=${sampleDetails.join(' | ')})` : ''}${analysisNote}`,
        };
      }
      const retryToleranceStep = 5.0;
      const maxRetrySteps = 5;
      const retryVertexLimit = Math.floor(65536 * 0.1);
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

      const resolveRetryToleranceK = (baseToleranceK: number) => (
        resolveLargeAreaToleranceForCollection(
          inputCollection,
          band.zMax,
          transformConfig.areaBasedTolerance,
          baseToleranceK,
        )
      );

      const simplifyFeatureWithTolerance = (feature: Feature, baseToleranceK: number): Feature => {
        const effectiveToleranceK = resolveRetryToleranceK(baseToleranceK);
        const toleranceDegrees = resolveSimplifyToleranceDegrees(band.zMax, effectiveToleranceK);
        if (!Number.isFinite(toleranceDegrees) || toleranceDegrees <= 0) return feature;
        return turfSimplify(feature, {
          tolerance: toleranceDegrees,
          highQuality: false,
          mutate: false,
        }) as Feature;
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

      const retrySimplifyFeatureIfNeeded = async (feature: Feature): Promise<{
        feature: Feature;
        vertexCount: number;
        overLimit: boolean;
      }> => {
        if (!feature.geometry) return { feature, vertexCount: 0, overLimit: false };
        const baseVertexCount = countVerticesFromGeometry(feature.geometry);
        if (baseVertexCount < retryVertexLimit) {
          return { feature, vertexCount: baseVertexCount, overLimit: false };
        }

        let lastFailTolerance = tolerance;
        let successTolerance: number | null = null;
        let successIndex: number | null = null;
        let bestFeature: Feature | null = null;
        let bestVertexCount = baseVertexCount;
        let lastAttemptFeature: Feature = feature;
        let lastAttemptVertexCount = baseVertexCount;

        for (let i = 0; i < maxRetrySteps; i += 1) {
          const nextToleranceValue = tolerance + retryToleranceStep * (i + 1);
          const retryFeature = await runRetrySimplifyFeature(feature, nextToleranceValue);
          if (!retryFeature?.geometry) break;
          const retryVertexCount = countVerticesFromGeometry(retryFeature.geometry);
          lastAttemptFeature = retryFeature;
          lastAttemptVertexCount = retryVertexCount;
          if (retryVertexCount < retryVertexLimit) {
            successTolerance = nextToleranceValue;
            successIndex = i;
            bestFeature = retryFeature;
            bestVertexCount = retryVertexCount;
            break;
          }
          lastFailTolerance = nextToleranceValue;
        }

        if (bestFeature && successTolerance !== null && successIndex !== null) {
          const bisectionSteps = 5 - Math.ceil(successIndex / 2);
          let low = lastFailTolerance;
          let high = successTolerance;
          for (let stepIndex = 0; stepIndex < bisectionSteps; stepIndex += 1) {
            const mid = (low + high) / 2;
            const midFeature = await runRetrySimplifyFeature(feature, mid);
            if (!midFeature?.geometry) break;
            const midVertexCount = countVerticesFromGeometry(midFeature.geometry);
            if (midVertexCount < retryVertexLimit) {
              high = mid;
              bestFeature = midFeature;
              bestVertexCount = midVertexCount;
            } else {
              low = mid;
            }
          }
          if (bestFeature) {
            return { feature: bestFeature, vertexCount: bestVertexCount, overLimit: false };
          }
        }

        return {
          feature: lastAttemptFeature,
          vertexCount: lastAttemptVertexCount,
          overLimit: lastAttemptVertexCount >= retryVertexLimit,
        };
      };

      let adjustedSimplified = simplified;
      let vertexLimitStats = countVertexLimitOverages(adjustedSimplified);
      if (vertexLimitStats.overLimitFeatureCount > 0) {
        const nextFeatures: Feature[] = [];
        let maxVertexCount = 0;
        let overLimitFeatureCount = 0;
        for (const feature of adjustedSimplified.features) {
          if (!feature?.geometry) {
            nextFeatures.push(feature);
            continue;
          }
          const result = await retrySimplifyFeatureIfNeeded(feature);
          nextFeatures.push(result.feature);
          maxVertexCount = Math.max(maxVertexCount, result.vertexCount);
          if (result.overLimit) {
            overLimitFeatureCount += 1;
          }
        }
        adjustedSimplified = {
          ...adjustedSimplified,
          features: nextFeatures,
        };
        vertexLimitStats = { maxVertexCount, overLimitFeatureCount };
      }
      simplified = adjustedSimplified;

      const simplifiedFeatureCount = simplified.features.length;
      stageLabel = 'validate:vertex-limit';
      let maxVertexCount = 0;
      let overLimitFeatureCount = 0;
      const vertexLimitRecords: ShapeTransformErrorRecord[] = [];
      const vertexRecordLimit = 200;
      for (const [featureIndex, feature] of simplified.features.entries()) {
        if (!feature?.geometry) continue;
        const vertexCount = countVerticesFromGeometry(feature.geometry);
        if (vertexCount < retryVertexLimit) continue;
        overLimitFeatureCount += 1;
        maxVertexCount = Math.max(maxVertexCount, vertexCount);
        if (vertexLimitRecords.length >= vertexRecordLimit) continue;
        const rawFeatureId = feature.id
          ?? (feature.properties && 'id' in feature.properties ? String(feature.properties.id) : undefined);
        const featureId = rawFeatureId ? String(rawFeatureId) : `${input.sourceKey}:${featureIndex}`;
        const lineFeaturesCandidate = buildErrorLineFeatures(feature.geometry, featureId);
        const summary = analyzeGeometryIssues(feature.geometry);
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
          message: `max vertices per feature exceeded (vertexCount=${vertexCount} limit=${retryVertexLimit})`,
          createdAt: Date.now(),
          lineFeatures: {
            type: 'FeatureCollection',
            features: lineFeaturesCandidate?.features ?? [],
          },
        });
      }
      if (overLimitFeatureCount > 0) {
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
          errorMessage: `transform failed: max vertices per feature exceeded (limit=${retryVertexLimit}, overLimit=${overLimitFeatureCount}/${simplifiedFeatureCount}, maxVertices=${maxVertexCount})`,
        };
      }

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

      await updateTaskPhase(taskId, 'output:build:start', taskProgressRange.simplifyEnd);
      const features: Feature[] = [];
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
        if (shouldBuildBoundary) {
          stageLabel = 'boundary';
          features.push(await runStageWithLabel('boundary', () => buildBoundaryFeature(featureWithId, boundaryLayerName, adminLevel)));
        }
      }

      const outputCollectionValue: FeatureCollection = {
        type: 'FeatureCollection',
        features,
      };
      if (outputCollectionValue.features.length === 0) {
        await reportPolygonProgress(taskId, inputPolygonCount, inputPolygonCount);
        return {
          status: 'completed',
          progress: 100,
          message: `skipped: empty output collection after simplify (features=0) inputFeatures=${inputFeatureCount}`,
          outputData: {
            processedPolygons: inputPolygonCount,
            totalPolygons: inputPolygonCount,
          },
        };
      }

      const boundaryDiagnostics = buildBoundaryDiagnostics(outputCollectionValue);
      if (boundaryDiagnostics) {
        console.warn('[ShapeTransform][BoundaryDiagnostics]', JSON.stringify({
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

      stageLabel = 'counts:output-vertices';
      await updateTaskPhase(taskId, 'output:counts:start', taskProgressRange.outputEnd - 5);
      const vertexCount = await runStageWithLabel('counts:output-vertices', () => features.reduce((sum, feature) => sum + countVerticesFromGeometry(feature.geometry), 0));
      stageLabel = 'counts:output-polygons';
      const polygonCount = await runStageWithLabel('counts:output-polygons', () => features.reduce((sum, feature) => sum + countPolygonsFromGeometry(feature.geometry), 0));
      assertNotAborted(abortSignal);
      stageLabel = 'encode';
      await updateTaskPhase(taskId, 'output:build:done', taskProgressRange.outputEnd);
      await updateTaskPhase(taskId, 'encode:start', taskProgressRange.outputEnd);
      outputCollection = outputCollectionValue;
      const encoded = await runStageWithLabel('encode', () => encodeFlatGeobufFromFeatureCollection(outputCollectionValue));
      if (encoded.byteLength === 0) {
        throw new Error('transform failed: empty transform cache buffer');
      }
      stageLabel = 'encode:validate';
      await runStageWithLabel('encode:validate', () => validateEncodedFlatGeobuf(encoded));
      await updateTaskPhase(taskId, 'encode:done', taskProgressRange.encodeEnd);
      const extractionRatio = inputFeatureCount > 0 ? simplified.features.length / inputFeatureCount : 0;
      const cacheId = `${task.nodeId}-b${input.bandIndex}-${input.domainType}-${input.sourceKey}`;

      stageLabel = 'cache:put';
      assertNotAborted(abortSignal);
      await updateTaskPhase(taskId, 'cache:put:start', taskProgressRange.encodeEnd);
      await ephemeralDB.transaction('rw', ephemeralDB.transformCache, async () => {
        await ephemeralDB.transformCache.put({
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
          timestamp: 0,
        });
        await ephemeralDB.transformCache.update(cacheId, { timestamp: Date.now() });
      });
      await updateTaskPhase(taskId, 'cache:put:done', taskProgressRange.encodeEnd);

      const tileIds = collectTileIdsForCollection(outputCollectionValue, band.zBase);
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
        const relations = tileIds.map((tileId) => ({
          id: `${task.nodeId}:${input.bandIndex}:${tileId}:${cacheId}`,
          nodeId: task.nodeId,
          bandIndex: input.bandIndex,
          tileId: String(tileId),
          bufferId: cacheId,
          createdAt,
        }));
        try {
          await ephemeralDB.tileIdToBufferRelations.where('bufferId').equals(cacheId).delete();
          await ephemeralDB.tileIdToBufferRelations.bulkPut(relations);
        } catch (storageError) {
          console.warn('[ShapeTransform] failed to persist tile index relations', storageError);
        }
      }

      const formatCount = (value: number): string => (
        Number.isFinite(value) ? new Intl.NumberFormat('en-US').format(value) : '-'
      );
      const formatSignedPercent = (output: number, input: number): string => {
        if (!Number.isFinite(input) || input <= 0) return '-0.0%';
        const percent = ((output - input) / input) * 100;
        const prefix = percent <= 0 ? '-' : '+';
        return `${prefix}${Math.abs(percent).toFixed(1)}%`;
      };
      const formatChangeSummary = (label: string, input: number, output: number): string => {
        const safeInput = Number.isFinite(input) ? input : output;
        const safeOutput = Number.isFinite(output) ? output : 0;
        return `${label}: ${formatCount(safeInput)} -> ${formatCount(safeOutput)} (${formatSignedPercent(safeOutput, safeInput)})`;
      };
      const completedMessage = [
        formatChangeSummary('features', inputFeatureCount, simplifiedFeatureCount),
        formatChangeSummary('polygons', inputPolygonCount, simplifiedPolygonCount),
        formatChangeSummary('vertices', inputVertexCount, simplifiedVertexCount),
      ].join(', ');
      return {
        status: 'completed',
        progress: 100,
        message: completedMessage,
        outputData: {
          processedPolygons: inputPolygonCount,
          totalPolygons: inputPolygonCount,
        },
      };
    } catch (error) {
      if (abortSignal?.aborted) {
        throw error;
      }
      const err = error instanceof Error ? error.message : String(error);
      const stagedError = err.startsWith('stage=') ? err : `stage=${stageLabel} ${err}`;
      const diagnostics = [
        buildCollectionDiagnostics(workingCollection, 'input'),
        buildCollectionDiagnostics(simplified, 'simplified'),
        buildCollectionDiagnostics(outputCollection, 'output'),
      ].filter((value): value is string => Boolean(value)).join(' ');
      await reportPolygonProgress(task.taskId, 0, inputPolygonCount);
      return {
        status: 'failed',
        errorMessage: `transform failed: ${stagedError}${diagnostics ? ` ${diagnostics}` : ''}`,
      };
    }
  };
};
