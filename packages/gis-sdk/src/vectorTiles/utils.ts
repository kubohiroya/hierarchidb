// ============================================================
// Internal utility functions for vector tile generation.
// ============================================================

import type { Feature, GeoJsonProperties, Geometry } from 'geojson';
import type { GeometryEngine } from '../configTypes.js';
import { geometryArea } from '../geometryEngineUtils.js';
import {
  buildShapeSourceLayerName,
  type LayerNameBoundaryMode,
  parseShapeSourceLayerName,
} from '../shapeLayerNames';
import {
  latToTileY,
  lonToTileX,
  pickAdminCode,
  pickAdminLevel,
  pickCountryCode,
} from '../vectorTileUtils.js';
import type { FeatureCollectionLike, GeojsonVtModule, VTMetadataContext } from './types.js';

type FeatureGeometry = Geometry | null;
type FeatureLike = Feature<Geometry, GeoJsonProperties>;

// ---------------------------------------------------------------------------
// Canonical boundary mode
// ---------------------------------------------------------------------------

export const toCanonicalBoundaryMode = (value: unknown): LayerNameBoundaryMode => {
  if (typeof value === 'string' && value.trim().toLowerCase() === 'boundary') {
    return 'boundary';
  }
  return 'fill';
};

// ---------------------------------------------------------------------------
// Feature ID generation
// ---------------------------------------------------------------------------

export function buildUniqueFeatureId(
  feature: FeatureLike,
  index: number,
  metadataContext?: VTMetadataContext
): string {
  const normalizeFeatureId = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return String(value ?? '');
  };

  const properties: Record<string, unknown> = feature.properties ?? {};
  const rawBaseId = properties.id ?? feature.id ?? index;
  const baseId = normalizeFeatureId(rawBaseId).trim();
  const adminCode = pickAdminCode(properties);
  const fallbackBaseId = baseId.length > 0 ? baseId : (adminCode ?? `feature-${index}`);
  const countryCode = metadataContext?.countryCode ?? pickCountryCode(properties);
  const adminLevel = metadataContext?.adminLevel ?? pickAdminLevel(properties);
  const prefixParts = [
    countryCode,
    adminLevel != null ? `ADM${adminLevel}` : undefined,
    adminCode,
  ].filter(Boolean);
  const prefix = prefixParts.join('-');
  const composed = prefix ? `${prefix}:${fallbackBaseId}` : fallbackBaseId;
  return `${composed}:${index}`;
}

// ---------------------------------------------------------------------------
// Property normalization
// ---------------------------------------------------------------------------

export const normalizePropertyValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : undefined;
  }
  return undefined;
};

export const resolveNumericLevel = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
  }
  return undefined;
};

// ---------------------------------------------------------------------------
// Tile layer name resolution
// ---------------------------------------------------------------------------

export const resolveTileLayerName = (feature: FeatureLike, fallbackAdminLevel?: number): string => {
  const properties = feature.properties ?? {};
  const explicitLayerName = [
    properties.layer,
    properties.LAYER,
    properties.sourceLayer,
    properties['source-layer'],
    properties.source_layer,
    properties.vectorLayer,
  ]
    .map((name) => parseShapeSourceLayerName(name))
    .find(
      (parsed): parsed is NonNullable<ReturnType<typeof parseShapeSourceLayerName>> =>
        parsed != null
    );
  if (explicitLayerName) {
    return buildShapeSourceLayerName(
      explicitLayerName.adminLevel,
      explicitLayerName.boundary === 'b' ? 'boundary' : 'fill'
    );
  }

  const candidates = [
    fallbackAdminLevel,
    properties.adminLevel,
    properties.admin_level,
    properties.ADM_LEVEL,
    properties.level,
    properties.admin_lvl,
    properties.layerLevel,
    properties.layer_level,
  ];
  const adminLevel = candidates
    .map(resolveNumericLevel)
    .find((value): value is number => value !== undefined);
  if (adminLevel === undefined) return 'layer0';
  const boundary = toCanonicalBoundaryMode(properties.boundary);
  return String(buildShapeSourceLayerName(adminLevel, boundary));
};

// ---------------------------------------------------------------------------
// Metadata property enrichment
// ---------------------------------------------------------------------------

export const ensureMetadataProperties = (
  properties: Record<string, unknown>,
  metadataContext?: VTMetadataContext
): void => {
  const rawCountryCode = metadataContext?.countryCode ?? pickCountryCode(properties);
  const normalizedCountryCode = normalizePropertyValue(rawCountryCode)?.toUpperCase();
  if (normalizedCountryCode && properties.countryCode === undefined) {
    properties.countryCode = normalizedCountryCode;
  }
  const adminCode = normalizePropertyValue(pickAdminCode(properties));
  if (adminCode && properties.adminCode === undefined) {
    properties.adminCode = adminCode;
  }
  const adminLevel = metadataContext?.adminLevel ?? pickAdminLevel(properties);
  if (adminLevel != null && properties.adminLevel === undefined) {
    properties.adminLevel = adminLevel;
  }
};

// ---------------------------------------------------------------------------
// Tile coordinate helpers
// ---------------------------------------------------------------------------

export const long2tile = (lon: number, z: number) => lonToTileX(lon, z);
export const lat2tile = (lat: number, z: number) => latToTileY(lat, z);

// ---------------------------------------------------------------------------
// Bounding box
// ---------------------------------------------------------------------------

export const updateBbox = (bbox: [number, number, number, number], coord: number[]) => {
  if (coord.length < 2) return;
  const lon = coord[0];
  const lat = coord[1];
  if (typeof lon !== 'number' || typeof lat !== 'number') return;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
  if (lon < bbox[0]) bbox[0] = lon;
  if (lat < bbox[1]) bbox[1] = lat;
  if (lon > bbox[2]) bbox[2] = lon;
  if (lat > bbox[3]) bbox[3] = lat;
};

// ---------------------------------------------------------------------------
// Geometry statistics
// ---------------------------------------------------------------------------

export const extractGeometryStats = (
  geometry: FeatureGeometry | undefined,
  engine: GeometryEngine
): {
  vertexCount: number;
  polygonCount: number;
  bbox?: [number, number, number, number];
  area: number;
} => {
  if (!geometry) {
    return { vertexCount: 0, polygonCount: 0, bbox: undefined, area: 0 };
  }
  if (geometry.type === 'GeometryCollection') {
    return { vertexCount: 0, polygonCount: 0, bbox: undefined, area: 0 };
  }

  const { type, coordinates } = geometry;

  let vertexCount = 0;
  let polygonCount = 0;
  const bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];

  const updateFromCoord = (coord: number[]) => {
    if (Array.isArray(coord)) {
      vertexCount += 1;
      updateBbox(bbox, coord);
    }
  };

  const updateFromRing = (ring: number[][]) => {
    if (!Array.isArray(ring)) return;
    for (const coord of ring) {
      updateFromCoord(coord);
    }
  };

  switch (type) {
    case 'Point': {
      const coord = coordinates as number[];
      updateFromCoord(coord);
      break;
    }
    case 'MultiPoint':
    case 'LineString': {
      const coords = coordinates as number[][];
      if (Array.isArray(coords)) {
        for (const coord of coords) {
          updateFromCoord(coord);
        }
      }
      break;
    }
    case 'MultiLineString': {
      const lines = coordinates as number[][][];
      if (Array.isArray(lines)) {
        for (const line of lines) {
          updateFromRing(line);
        }
      }
      break;
    }
    case 'Polygon': {
      polygonCount = 1;
      const rings = coordinates as number[][][];
      if (Array.isArray(rings)) {
        for (const ring of rings) {
          updateFromRing(ring);
        }
      }
      break;
    }
    case 'MultiPolygon': {
      const polygons = coordinates as number[][][][];
      if (Array.isArray(polygons)) {
        polygonCount = polygons.length;
        for (const poly of polygons) {
          if (!Array.isArray(poly)) continue;
          for (const ring of poly) {
            updateFromRing(ring);
          }
        }
      }
      break;
    }
    default:
      break;
  }

  let areaValue = 0;
  try {
    areaValue = Math.max(0, geometryArea(geometry, engine));
  } catch {
    areaValue = 0;
  }
  const finalBbox = bbox.every((value) => Number.isFinite(value)) ? bbox : undefined;

  return { vertexCount, polygonCount, bbox: finalBbox, area: areaValue };
};

// ---------------------------------------------------------------------------
// Feature collection decoding
// ---------------------------------------------------------------------------

export const normalizeFeatureCollection = async (
  decoded: unknown
): Promise<FeatureCollectionLike | null> => {
  if (!decoded || typeof decoded !== 'object') return null;
  const collection = decoded as FeatureCollectionLike;
  if (collection.type === 'FeatureCollection') {
    const features = Array.isArray(collection.features) ? collection.features : [];
    return { ...collection, features };
  }
  if (typeof (decoded as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    const features: FeatureLike[] = [];
    for await (const feature of decoded as AsyncIterable<FeatureLike>) {
      features.push(feature);
    }
    return { type: 'FeatureCollection', features };
  }
  return null;
};

export const decodeFeatureCollectionFromJsonBuffer = async (
  buffer: ArrayBuffer
): Promise<FeatureCollectionLike | null> => {
  try {
    const text = new TextDecoder().decode(new Uint8Array(buffer));
    const parsed = JSON.parse(text);
    return await normalizeFeatureCollection(parsed);
  } catch {
    return null;
  }
};

export const loadFlatGeobufGeojson = async () => {
  const mod = await import('flatgeobuf');
  return mod.geojson;
};

export const decodeFeatureCollectionFromFlatGeobufBuffer = async (
  buffer: ArrayBuffer
): Promise<FeatureCollectionLike | null> => {
  try {
    const geojsonApi = await loadFlatGeobufGeojson();
    const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
    return await normalizeFeatureCollection(decoded);
  } catch {
    return null;
  }
};

export const loadGeojsonVt = async (): Promise<GeojsonVtModule> => {
  const mod = await import('geojson-vt');
  const candidate = mod as { default?: GeojsonVtModule } & GeojsonVtModule;
  return candidate.default ?? candidate;
};

export const throwIfAborted = (signal?: AbortSignal): void => {
  if (!signal?.aborted) return;
  if (typeof DOMException === 'function') {
    throw new DOMException('Vector tile generation aborted', 'AbortError');
  }
  const error = new Error('Vector tile generation aborted');
  (error as Error & { name: string }).name = 'AbortError';
  throw error;
};
