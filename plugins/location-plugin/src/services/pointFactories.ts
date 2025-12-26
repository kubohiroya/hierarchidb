import type { Timestamp } from '@hierarchidb/common-types';
import type {
  LocationPointProperties,
  LocationPointSource,
  LocationPointMetadata,
} from '../common/entities/LocationPoint.js';
import type { LocationPointKind } from '../common/entities/LocationPoint.js';
import type { RawNominatimResult, RawOverpassElement } from './download/rawTypes.js';
import { sanitizeTags } from './download/mappers.js';

interface BasePointParams {
  pid: string;
  name: string;
  kind: LocationPointKind;
  latitude: number;
  longitude: number;
  countryCode: string;
  countryName?: string;
  admin1?: string;
  admin2?: string;
  metadata?: LocationPointMetadata;
  source: LocationPointSource;
}

const normalizeMetadataValue = (value: unknown): string | number | null => {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value) || typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const toMetadata = (value: Record<string, unknown> | undefined): LocationPointMetadata | undefined => {
  if (!value) return undefined;
  const entries = Object.entries(value).map(([key, val]) => [key, normalizeMetadataValue(val)]);
  return Object.fromEntries(entries);
};

export const createLocationPointProperties = (params: BasePointParams): LocationPointProperties => ({
  schemaVersion: 2,
  pid: params.pid,
  name: params.name,
  latitude: params.latitude,
  longitude: params.longitude,
  kind: params.kind,
  countryCode: params.countryCode,
  countryName: params.countryName,
  admin1: params.admin1,
  admin2: params.admin2,
  metadata: params.metadata,
  source: params.source,
});

const toSource = (
  provider: LocationPointSource['provider'],
  fetchedAt: Timestamp,
  originalId?: string,
): LocationPointSource => ({ provider, fetchedAt, originalId });

const toPid = (prefix: string, rawId: string | number): string => `${prefix}:${String(rawId)}`;

export const buildOsmPointProperties = (
  raw: RawNominatimResult,
  kind: LocationPointKind,
  latitude: number,
  longitude: number,
  timestamp: Timestamp,
): LocationPointProperties => {
  const metadata = toMetadata({
    osmId: raw.osm_id,
    osmType: raw.osm_type,
    class: raw.class,
    type: raw.type,
    importance: raw.importance,
    tags: sanitizeTags(raw.extratags) ?? undefined,
    lastSeenAt: timestamp,
    addressCountry: raw.address?.country,
    addressState: raw.address?.state,
    addressCity: raw.address?.city || raw.address?.town || raw.address?.village,
  });

  const source = toSource('openstreetmap', timestamp, String(raw.osm_id));
  const countryCode = raw.address?.country_code?.toUpperCase() ?? '';
  const countryName = raw.address?.country;
  const admin1 = raw.address?.state;
  const admin2 = raw.address?.city || raw.address?.town || raw.address?.village;

  return createLocationPointProperties({
    pid: toPid('osm', raw.osm_id),
    name: raw.display_name ?? 'Unknown',
    kind,
    latitude,
    longitude,
    countryCode,
    countryName,
    admin1: admin1 ?? undefined,
    admin2: admin2 ?? undefined,
    metadata,
    source,
  });
};

export const buildOverpassPointProperties = (
  raw: RawOverpassElement,
  kind: LocationPointKind,
  latitude: number,
  longitude: number,
  timestamp: Timestamp,
): LocationPointProperties => {
  const metadata = toMetadata({
    osmId: raw.id,
    osmType: raw.type,
    tags: sanitizeTags(raw.tags) ?? undefined,
    amenity: raw.tags?.amenity,
    lastSeenAt: timestamp,
    overpassQuery: raw.tags?.overpassQuery,
  });

  const source = toSource('overpass', timestamp, String(raw.id));
  const countryCode = raw.tags?.['addr:country']?.toUpperCase() ?? '';
  const admin1 = raw.tags?.['addr:state'] ?? raw.tags?.['addr:region'];
  const admin2 = raw.tags?.['addr:city'] ?? raw.tags?.['addr:district'];

  return createLocationPointProperties({
    pid: toPid('overpass', raw.id),
    name: raw.tags?.name ?? 'Unknown',
    kind,
    latitude,
    longitude,
    countryCode,
    admin1: admin1 ?? undefined,
    admin2: admin2 ?? undefined,
    metadata,
    source,
  });
};

export const buildGeoNamesPointProperties = (
  raw: { geonameId: number; name: string; countryCode?: string; adminCode1?: string; adminCode2?: string; lat: number; lng: number; featureClass?: string; featureCode?: string; population?: number; elevation?: number; timezone?: string; alternateNames?: string[]; },
  kind: LocationPointKind,
  timestamp: Timestamp,
): LocationPointProperties => {
  const metadata = toMetadata({
    geonameId: raw.geonameId,
    featureClass: raw.featureClass ?? 'unknown',
    featureCode: raw.featureCode ?? 'unknown',
    population: raw.population,
    elevation: raw.elevation,
    timezone: raw.timezone,
    adminCode1: raw.adminCode1,
    adminCode2: raw.adminCode2,
    alternateNames: raw.alternateNames?.join(','),
  });

  const source = toSource('geonames', timestamp, String(raw.geonameId));

  return createLocationPointProperties({
    pid: toPid('geonames', raw.geonameId),
    name: raw.name,
    kind,
    latitude: raw.lat,
    longitude: raw.lng,
    countryCode: raw.countryCode ?? '',
    admin1: raw.adminCode1,
    admin2: raw.adminCode2,
    metadata,
    source,
  });
};

export const buildWikidataPointProperties = (
  raw: { entityId: string; label: string; coordinates: { lat: number; lon: number }; countryCode?: string; admin1?: string; admin2?: string; descriptions?: Record<string, string>; wikipediaTitle?: string; instanceOf?: string[]; properties?: Record<string, unknown>; },
  kind: LocationPointKind,
  timestamp: Timestamp,
): LocationPointProperties => {
  const metadata = toMetadata({
    entityId: raw.entityId,
    label: raw.label,
    wikipediaTitle: raw.wikipediaTitle,
    instanceOf: raw.instanceOf?.join(','),
    descriptions: raw.descriptions,
    properties: raw.properties,
  });

  const source = toSource('wikidata', timestamp, raw.entityId);

  return createLocationPointProperties({
    pid: toPid('wikidata', raw.entityId),
    name: raw.label,
    kind,
    latitude: raw.coordinates.lat,
    longitude: raw.coordinates.lon,
    countryCode: raw.countryCode ?? '',
    admin1: raw.admin1,
    admin2: raw.admin2,
    metadata,
    source,
  });
};

export const buildCustomPointProperties = (
  raw: { id: string; name: string; latitude: number; longitude: number; countryCode?: string; admin1?: string; admin2?: string; attributes?: Record<string, unknown>; },
  kind: LocationPointKind,
  timestamp: Timestamp,
): LocationPointProperties => {
  const metadata = toMetadata({
    schemaVersion: 1,
    attributes: raw.attributes ?? {},
  });

  const source = toSource('custom', timestamp, raw.id);

  return createLocationPointProperties({
    pid: toPid('custom', raw.id),
    name: raw.name,
    kind,
    latitude: raw.latitude,
    longitude: raw.longitude,
    countryCode: raw.countryCode ?? '',
    admin1: raw.admin1,
    admin2: raw.admin2,
    metadata,
    source,
  });
};
