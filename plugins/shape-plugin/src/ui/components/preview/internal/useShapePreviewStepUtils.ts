import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import { toNodeId } from '@hierarchidb/core-types';
import { shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import type { ShapeDataSourceMetadata, ShapeFeatureMetadata } from '@hierarchidb/shape-api';
import type { MapWithVectorTilesProps } from '@hierarchidb/ui-map';
import { isShapePreviewMetadataEnabled } from '~/common/config/previewFlags';
import type { DataSourceName, ShapePreviewMapView } from '~/common/types/index';
import type { ShapeEntity } from '~/common/types/index';

export type ShapePreviewDraft = Partial<ShapeEntity> & {
  tilesUrl?: string;
  tilesEndpoint?: string;
  tilesLayer?: string;
};

export const DEFAULT_VIEW: MapWithVectorTilesProps['initialViewState'] = {
  longitude: 0,
  latitude: 20,
  zoom: 1.5,
};

export const DEFAULT_BOUNDS_MARGIN = 0.1;
export const MIN_BOUNDS_MARGIN = 0.25;

export const DEFAULT_VIEW_DB_NAME = 'shape';

export const normalizeText = (value?: string): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const normalizeCountryCodeValue = (value?: string): string | undefined => {
  const trimmed = normalizeText(value);
  if (!trimmed) return undefined;
  const upper = trimmed.toUpperCase();
  const dashIndex = upper.indexOf('-');
  if (dashIndex > 0) return upper.slice(0, dashIndex);
  return upper;
};

export const toPropString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return normalizeText(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

export const pickFromProps = (
  properties: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined => {
  if (!properties) return undefined;
  for (const key of keys) {
    const value = toPropString(properties[key]);
    if (value) return value;
  }
  return undefined;
};

export const resolveAdminLevelFromProps = (
  properties: Record<string, unknown> | undefined,
  fallback?: number,
): number | undefined => {
  if (properties) {
    const candidates = [
      properties.adminLevel,
      properties.admin_level,
      properties.ADM_LEVEL,
      properties.level,
      properties.admin_lvl,
    ];
    for (const value of candidates) {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
  }
  return fallback;
};

export const pickCountryNameFromProps = (properties: Record<string, unknown> | undefined): string | undefined =>
  pickFromProps(properties, ['countryName', 'country', 'COUNTRY', 'COUNTRY_NAME', 'NAME_0', 'ADMIN', 'SOVEREIGNTY']);

export const pickCountryCodeFromProps = (properties: Record<string, unknown> | undefined): string | undefined =>
  pickFromProps(properties, ['countryCode', 'ISO_A2', 'ISO2', 'ISO_2', 'ISO_A3', 'ADM0_A3', 'ISO3', 'shapeISO']);

export const buildFlagEmoji = (countryCode?: string): string | null => {
  if (!countryCode || countryCode.length !== 2) return null;
  const normalized = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;
  const base = 0x1f1e6;
  const first = normalized.charCodeAt(0) - 65;
  const second = normalized.charCodeAt(1) - 65;
  return String.fromCodePoint(base + first, base + second);
};

export const pickAdminNameByLevel = (
  properties: Record<string, unknown> | undefined,
  level: number,
): string | undefined => {
  if (level === 2) {
    return pickFromProps(properties, ['admin2Name', 'NAME_2', 'name_2', 'ADM2_NAME', 'admin2', 'name', 'NAME']);
  }
  if (level === 1) {
    return pickFromProps(properties, ['admin1Name', 'NAME_1', 'name_1', 'ADM1_NAME', 'admin1', 'name', 'NAME']);
  }
  return pickFromProps(properties, ['adminName', 'name', 'NAME', 'shapeName']);
};

export const buildHoverLabel = (
  row: ShapeDataSourceMetadata,
  properties?: Record<string, unknown>,
): string => {
  const resolvedLevel = resolveAdminLevelFromProps(properties, row.adminLevel);
  const adminLevel = typeof resolvedLevel === 'number' ? resolvedLevel : 0;
  const countryName =
    pickCountryNameFromProps(properties)
    ?? row.countryName
    ?? row.countryCode
    ?? 'Unknown';
  const countryCode = normalizeCountryCodeValue(
    pickCountryCodeFromProps(properties) ?? row.countryCode,
  );
  const normalizedCountryName = normalizeText(countryName);
  const hasCountryName = Boolean(normalizedCountryName) && normalizedCountryName !== 'unknown';
  const flagEmoji = hasCountryName ? buildFlagEmoji(countryCode) : null;
  const countryLabel = flagEmoji ? `${flagEmoji} ${countryName}` : countryName;
  const countrySuffix = countryCode ? ` (${countryCode})` : '';
  if (adminLevel <= 0) {
    return `ADM0: ${countryLabel}${countrySuffix}`;
  }
  if (adminLevel === 1) {
    const admin1 = pickAdminNameByLevel(properties, 1) ?? countryName;
    return `ADM1: ${admin1} / ${countryLabel}${countrySuffix}`;
  }
  if (adminLevel === 2) {
    const admin2 = pickAdminNameByLevel(properties, 2) ?? pickAdminNameByLevel(properties, 1);
    const admin1 = pickAdminNameByLevel(properties, 1);
    const parts = [admin2, admin1, countryLabel].filter((part, index, arr) => {
      if (!part) return false;
      return arr.indexOf(part) === index;
    });
    return `ADM2: ${parts.join(' / ')}${countrySuffix}`;
  }
  const adminName = pickAdminNameByLevel(properties, adminLevel) ?? countryName;
  return `ADM${adminLevel}: ${adminName} / ${countryLabel}${countrySuffix}`;
};

export const parseSourceKey = (sourceKey?: string): { countryCode?: string; adminLevel?: number } => {
  const trimmed = normalizeText(sourceKey);
  if (!trimmed) return {};
  const [countryCodeRaw, adminLevelRaw] = trimmed.split(':');
  const adminLevel = adminLevelRaw != null ? Number(adminLevelRaw) : undefined;
  return {
    countryCode: normalizeCountryCodeValue(countryCodeRaw),
    adminLevel: Number.isFinite(adminLevel) ? adminLevel : undefined,
  };
};

export const buildLookupKey = (countryCode?: string, adminLevel?: number): string | null => {
  if (!countryCode || adminLevel == null) return null;
  return `${countryCode}:${adminLevel}`;
};

export const buildCountryGroupKey = (countryCode?: string): string | null => {
  const normalized = normalizeCountryCodeValue(countryCode);
  if (!normalized) return null;
  return `country:${normalized}`;
};

/**
 * Determines if an issue kind represents a repair (successfully fixed) vs an error (needs attention).
 * Issues without a specific kind are typically self-intersection repairs that were automatically fixed.
 * Issues with specific kinds like 'max-vertices' are hard errors that couldn't be automatically resolved.
 */
export const isRepairIssueKind = (issueKind?: string): boolean => {
  return issueKind === undefined || issueKind === null;
};

export const resolveAdminNameFromMetadata = (
  row: ShapeFeatureMetadata,
  adminLevel: number | undefined,
  context: { countryName?: string },
): string | undefined => {
  if (adminLevel === 2) {
    return normalizeText(row.admin2Name)
      ?? normalizeText(row.admin1Name)
      ?? normalizeText(row.admin0Name)
      ?? normalizeText(row.countryName)
      ?? normalizeText(context.countryName);
  }
  if (adminLevel === 1) {
    return normalizeText(row.admin1Name)
      ?? normalizeText(row.admin0Name)
      ?? normalizeText(row.countryName)
      ?? normalizeText(context.countryName);
  }
  return normalizeText(row.admin0Name)
    ?? normalizeText(row.countryName)
    ?? normalizeText(context.countryName);
};

export const resolveAdminCodeFromMetadata = (
  row: ShapeFeatureMetadata,
  adminLevel: number | undefined,
  context: { countryCode?: string },
): string | undefined => {
  if (adminLevel === 2) {
    return normalizeText(row.admin2Code)
      ?? normalizeText(row.admin1Code)
      ?? normalizeCountryCodeValue(row.admin0Code)
      ?? normalizeCountryCodeValue(row.countryCode)
      ?? normalizeCountryCodeValue(context.countryCode);
  }
  if (adminLevel === 1) {
    return normalizeText(row.admin1Code)
      ?? normalizeCountryCodeValue(row.admin0Code)
      ?? normalizeCountryCodeValue(row.countryCode)
      ?? normalizeCountryCodeValue(context.countryCode);
  }
  return normalizeCountryCodeValue(row.admin0Code)
    ?? normalizeCountryCodeValue(row.countryCode)
    ?? normalizeCountryCodeValue(context.countryCode);
};

export const isNumericId = (value?: string): boolean => {
  if (!value) return false;
  return /^[0-9]+$/.test(value);
};

export const parseVectorTileLayerNames = (data: ArrayBuffer): string[] => {
  if (!data || data.byteLength === 0) return [];
  try {
    const tile = new VectorTile(new Pbf(new Uint8Array(data)));
    return Object.keys(tile.layers ?? {});
  } catch {
    return [];
  }
};

export const fetchTile = async (
  nodeId: string,
  z: number,
  x: number,
  y: number,
): Promise<ArrayBuffer | null> => {
  const data = await shapeQueryAPIImpl.getVectorTile(toNodeId(nodeId), z, x, y);
  if (!data) return null;
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
};

export const resolvePersistedViewState = (
  view?: ShapePreviewMapView,
): MapWithVectorTilesProps['initialViewState'] | null => {
  if (!view) return null;
  const { longitude, latitude, zoom } = view;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || !Number.isFinite(zoom)) {
    return null;
  }
  return {
    longitude,
    latitude,
    zoom,
    bearing: 0,
    pitch: 0,
  };
};

export const createShapePreviewDraft = (data: Partial<ShapeEntity>): ShapePreviewDraft => data;

export const getPreviewMetadataEnabled = (): boolean => isShapePreviewMetadataEnabled();

export const getPreviewDataSource = (
  buildConfigDataSource?: string,
): DataSourceName | undefined => buildConfigDataSource as DataSourceName | undefined;
