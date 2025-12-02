import { toNodeId, type Timestamp } from '@hierarchidb/common-types';
import type {
  LocationCategory,
  LocationEntity,
  LocationType,
  LocationAttributes,
  LocationDataSource,
} from '../../common/entities/LocationEntity.js';

const CATEGORY_MAP: Record<string, LocationCategory> = {
  amenity: 'infrastructure',
  aeroway: 'transportation',
  railway: 'transportation',
  highway: 'transportation',
  place: 'administrative',
  shop: 'commercial',
  tourism: 'leisure',
  historic: 'cultural',
  leisure: 'leisure',
  natural: 'natural',
  office: 'administrative',
  government: 'administrative',
  healthcare: 'healthcare',
  education: 'education',
};

const TYPE_MAP: Record<string, LocationType> = {
  aerodrome: 'airport',
  airport: 'airport',
  railway_station: 'railway_station',
  railway: 'railway_station',
  bus_station: 'bus_stop',
  bus_stop: 'bus_stop',
  harbour: 'port',
  port: 'port',
  parking: 'parking',
  hospital: 'hospital',
  clinic: 'clinic',
  pharmacy: 'pharmacy',
  school: 'school',
  university: 'university',
  library: 'library',
  mall: 'shopping_mall',
  shopping_mall: 'shopping_mall',
  supermarket: 'supermarket',
  restaurant: 'restaurant',
  hotel: 'hotel',
  bank: 'bank',
  museum: 'museum',
  theatre: 'theater',
  theater: 'theater',
  monument: 'monument',
  park: 'park',
  stadium: 'stadium',
  beach: 'beach',
  peak: 'mountain',
  mountain: 'mountain',
  water: 'lake',
  lake: 'lake',
  river: 'river',
};

export const mapCategory = (value?: string): LocationCategory =>
  CATEGORY_MAP[value ?? ''] ?? 'infrastructure';

export const mapType = (value?: string): LocationType =>
  TYPE_MAP[value ?? ''] ?? 'park';

export const sanitizeTags = (tags: unknown): Record<string, string> | undefined => {
  if (!tags || typeof tags !== 'object') return undefined;
  const entries = Object.entries(tags as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

export interface BaseEntityParams {
  prefix: string;
  rawId: string | number;
  name: string;
  category: LocationCategory;
  type: LocationType;
  dataSource: LocationDataSource;
  attributes?: LocationAttributes;
  boundingBox?: [number, number, number, number];
  address?: LocationEntity['address'];
  importance?: number;
  metadata?: Record<string, unknown>;
}

export const buildLocationEntity = ({
  prefix,
  rawId,
  name,
  category,
  type,
  dataSource,
  attributes,
  boundingBox,
  address,
  importance,
  metadata,
}: BaseEntityParams): LocationEntity => {
  const now = Date.now() as Timestamp;
  const idSegment = String(rawId);
  return {
    id: toNodeId(`${prefix}-${idSegment}`),
    nodeId: toNodeId(`${prefix}-node-${idSegment}`),
    name,
    category,
    type,
    dataSource,
    boundingBox,
    address,
    attributes,
    metadata,
    description: undefined,
    licenseAgreement: true,
    licenseAgreedAt: now,
    processingStatus: 'completed',
    processedAt: now,
    importance,
    selectionMatrix: [],
    concurrentDownloads: 1,
    batchSessionId: undefined,
    lastProcessedAt: undefined,
  };
};

export const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

export const normalizeOsmType = (
  value: unknown,
): LocationAttributes['osmType'] => (
  value === 'node' || value === 'way' || value === 'relation'
    ? value
    : undefined
);

export const parseBoundingBox = (value: unknown): [number, number, number, number] | undefined => {
  if (!Array.isArray(value) || value.length !== 4) return undefined;
  const parsed = value.map(parseNumber);
  if (parsed.some((n) => typeof n !== 'number')) return undefined;
  return parsed as [number, number, number, number];
};

export const normalizeImportance = (value: unknown, fallback = 0.5): number => {
  const parsed = parseNumber(value);
  return typeof parsed === 'number' ? parsed : fallback;
};
