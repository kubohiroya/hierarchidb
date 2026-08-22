import { type GeometryEngine, geometryArea, geometryBbox } from '@hierarchidb/gis-sdk';
import type { Feature, Geometry } from 'geojson';

const geojsonTextEncoder = new TextEncoder();

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
    return geometries.reduce((sum, child) => sum + countVerticesFromGeometry(child), 0);
  }
  return countVertices(geometry.coordinates);
};

const countPolygonsFromGeometry = (geometry?: Geometry | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum, child) => sum + countPolygonsFromGeometry(child), 0);
  }
  if (geometry.type === 'Polygon') {
    return 1;
  }
  if (geometry.type === 'MultiPolygon') {
    return Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0;
  }
  return 0;
};

const safeBbox = (
  feature: Feature<Geometry>,
  geometryEngine: GeometryEngine
): [number, number, number, number] | null => {
  try {
    const result = geometryBbox(feature, geometryEngine);
    if (!Array.isArray(result) || result.length !== 4) return null;
    const [minLon, minLat, maxLon, maxLat] = result;
    if (
      minLon === undefined ||
      minLat === undefined ||
      maxLon === undefined ||
      maxLat === undefined
    ) {
      return null;
    }
    if (![minLon, minLat, maxLon, maxLat].every((value) => Number.isFinite(value))) return null;
    return [minLon, minLat, maxLon, maxLat];
  } catch {
    return null;
  }
};

const safeArea = (feature: Feature<Geometry>, geometryEngine: GeometryEngine): number => {
  try {
    const value = geometryArea(feature, geometryEngine);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

const toPropString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

const pickFromProps = (properties: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = toPropString(properties[key]);
    if (value) return value;
  }
  return undefined;
};

const parseAdminLevel = (
  properties: Record<string, unknown>,
  fallback?: number
): number | undefined => {
  const candidates = [
    properties.adminLevel,
    properties.admin_level,
    properties.ADM_LEVEL,
    properties.level,
    properties.admin_lvl,
    fallback,
  ];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const normalizeCountryCode = (value?: string): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const dashIndex = trimmed.indexOf('-');
  const normalized = dashIndex > 0 ? trimmed.slice(0, dashIndex) : trimmed;
  return normalized.toUpperCase();
};

export type AdminHierarchyFields = {
  admin0Code?: string;
  admin1Name?: string;
  admin1Code?: string;
  admin2Name?: string;
  admin2Code?: string;
  resolvedAdminLevel?: number;
};

export const resolveAdminHierarchyFields = (params: {
  properties: Record<string, unknown>;
  countryCode?: string;
  adminLevel?: number;
}): AdminHierarchyFields => {
  const resolvedAdminLevel = parseAdminLevel(params.properties, params.adminLevel);
  const genericAdminName = pickFromProps(params.properties, [
    'adminName',
    'name',
    'NAME',
    'shapeName',
  ]);
  const genericAdminCode = pickFromProps(params.properties, ['adminCode', 'code', 'shapeID']);

  let admin0Code = pickFromProps(params.properties, [
    'admin0Code',
    'ADM0_CODE',
    'GID_0',
    'ISO_A2',
    'ISO2',
    'ISO_2',
    'ISO_A3',
    'ISO3',
    'ADM0_A3',
    'shapeISO',
    'countryCode',
  ]);
  let admin1Name = pickFromProps(params.properties, [
    'admin1Name',
    'NAME_1',
    'name_1',
    'ADM1_NAME',
    'admin1',
  ]);
  let admin1Code = pickFromProps(params.properties, ['admin1Code', 'GID_1', 'ADM1_CODE', 'HASC_1']);
  let admin2Name = pickFromProps(params.properties, [
    'admin2Name',
    'NAME_2',
    'name_2',
    'ADM2_NAME',
    'admin2',
  ]);
  let admin2Code = pickFromProps(params.properties, ['admin2Code', 'GID_2', 'ADM2_CODE', 'HASC_2']);

  if (!admin0Code) {
    admin0Code = normalizeCountryCode(params.countryCode);
  }
  if (resolvedAdminLevel === 1) {
    if (!admin1Name) admin1Name = genericAdminName;
    if (!admin1Code) admin1Code = genericAdminCode;
  }
  if (resolvedAdminLevel === 2) {
    if (!admin2Name) admin2Name = genericAdminName;
    if (!admin2Code) admin2Code = genericAdminCode;
  }

  return {
    admin0Code,
    admin1Name,
    admin1Code,
    admin2Name,
    admin2Code,
    resolvedAdminLevel,
  };
};

export const measureFeatureGeoJsonByteSize = (feature: Feature): number => {
  try {
    const text = JSON.stringify(feature, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
    return geojsonTextEncoder.encode(text).byteLength;
  } catch {
    return 0;
  }
};

export const buildFeatureId = (
  feature: Feature,
  index: number,
  metadata: { countryCode?: string; adminLevel?: number; adminCode?: string }
): string => {
  const normalizeFeatureId = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return String(value ?? '');
  };
  const properties = (feature.properties ?? {}) as Record<string, unknown>;
  const persistedFeatureId = normalizeFeatureId(properties.__hdbFeatureId).trim();
  if (persistedFeatureId.length > 0) {
    return persistedFeatureId;
  }
  const rawBaseId = properties.id ?? feature.id ?? index;
  const baseId = normalizeFeatureId(rawBaseId).trim();
  const fallbackBaseId = baseId.length > 0 ? baseId : (metadata.adminCode ?? `feature-${index}`);
  const prefixParts = [
    metadata.countryCode,
    metadata.adminLevel != null ? `ADM${metadata.adminLevel}` : undefined,
    metadata.adminCode,
  ].filter(Boolean);
  const prefix = prefixParts.join('-');
  const composed = prefix ? `${prefix}:${fallbackBaseId}` : fallbackBaseId;
  return `${composed}:${index}`;
};

export const extractGeometryStats = (
  feature: Feature,
  geometryEngine: GeometryEngine
): {
  vertexCount: number;
  polygonCount: number;
  bbox?: [number, number, number, number];
  area: number;
} => {
  const geometry = feature.geometry ?? null;
  const vertexCount = countVerticesFromGeometry(geometry);
  const polygonCount = countPolygonsFromGeometry(geometry);
  let bbox: [number, number, number, number] | undefined;
  const resolvedBbox = safeBbox(feature as Feature<Geometry>, geometryEngine);
  if (resolvedBbox) {
    bbox = resolvedBbox;
  }
  const area = safeArea(feature as Feature<Geometry>, geometryEngine);
  return { vertexCount, polygonCount, bbox, area };
};
