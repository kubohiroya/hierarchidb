import type { Timestamp } from '@hierarchidb/common-types';
import { generateId } from '@hierarchidb/util';
import type {
  LocationPointProperties,
  LocationPointId,
  LocationPointMetadata,
} from '../common/entities/LocationPoint.js';
import type { LocationPointKind } from '../common/entities/LocationPoint.js';
import type { RawNominatimResult, RawOverpassElement } from './download/rawTypes.js';
import { sanitizeTags } from './download/mappers.js';

interface BasePointParams {
  pointId: LocationPointId;
  name: string;
  kind: LocationPointKind;
  latitude: number;
  longitude: number;
  countryCode: string;
  countryName?: string;
  admin1?: string;
  admin2?: string;
  metadata?: LocationPointMetadata;
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
  pointId: params.pointId,
  name: params.name,
  latitude: params.latitude,
  longitude: params.longitude,
  kind: params.kind,
  countryCode: params.countryCode,
  countryName: params.countryName,
  admin1: params.admin1,
  admin2: params.admin2,
  metadata: params.metadata,
});

const toPointId = (): LocationPointId => generateId() as LocationPointId;

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
  const countryCode = raw.address?.country_code?.toUpperCase() ?? '';
  const countryName = raw.address?.country;
  const admin1 = raw.address?.state;
  const admin2 = raw.address?.city || raw.address?.town || raw.address?.village;

  return createLocationPointProperties({
    pointId: toPointId(),
    name: raw.display_name ?? 'Unknown',
    kind,
    latitude,
    longitude,
    countryCode,
    countryName,
    admin1: admin1 ?? undefined,
    admin2: admin2 ?? undefined,
    metadata,
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
    overpassRawId: raw.id,
    osmType: raw.type,
    tags: sanitizeTags(raw.tags) ?? undefined,
    amenity: raw.tags?.amenity,
    lastSeenAt: timestamp,
    overpassQuery: raw.tags?.overpassQuery,
  });
  const countryCode = raw.tags?.['addr:country']?.toUpperCase() ?? '';
  const admin1 = raw.tags?.['addr:state'] ?? raw.tags?.['addr:region'];
  const admin2 = raw.tags?.['addr:city'] ?? raw.tags?.['addr:district'];

  return createLocationPointProperties({
    pointId: toPointId(),
    name: raw.tags?.name ?? 'Unknown',
    kind,
    latitude,
    longitude,
    countryCode,
    admin1: admin1 ?? undefined,
    admin2: admin2 ?? undefined,
    metadata,
  });
};

export const buildGeoNamesPointProperties = (
  raw: { geonameId: number; name: string; countryCode?: string; adminCode1?: string; adminCode2?: string; lat: number; lng: number; featureClass?: string; featureCode?: string; population?: number; elevation?: number; timezone?: string; alternateNames?: string[]; },
  kind: LocationPointKind,
  timestamp: Timestamp,
): LocationPointProperties => {
  const metadata = toMetadata({
    geoNameId: raw.geonameId,
    featureClass: raw.featureClass ?? 'unknown',
    featureCode: raw.featureCode ?? 'unknown',
    population: raw.population,
    elevation: raw.elevation,
    timezone: raw.timezone,
    adminCode1: raw.adminCode1,
    adminCode2: raw.adminCode2,
    alternateNames: raw.alternateNames?.join(','),
    lastSeenAt: timestamp,
  });

  return createLocationPointProperties({
    pointId: toPointId(),
    name: raw.name,
    kind,
    latitude: raw.lat,
    longitude: raw.lng,
    countryCode: raw.countryCode ?? '',
    admin1: raw.adminCode1,
    admin2: raw.adminCode2,
    metadata,
  });
};

export const buildWikidataPointProperties = (
  raw: { entityId: string; label: string; coordinates: { lat: number; lon: number }; countryCode?: string; admin1?: string; admin2?: string; descriptions?: Record<string, string>; wikipediaTitle?: string; instanceOf?: string[]; properties?: Record<string, unknown>; },
  kind: LocationPointKind,
  timestamp: Timestamp,
): LocationPointProperties => {
  const metadata = toMetadata({
    wikidataEntityId: raw.entityId,
    label: raw.label,
    wikipediaTitle: raw.wikipediaTitle,
    instanceOf: raw.instanceOf?.join(','),
    descriptions: raw.descriptions,
    properties: raw.properties,
    lastSeenAt: timestamp,
  });

  return createLocationPointProperties({
    pointId: toPointId(),
    name: raw.label,
    kind,
    latitude: raw.coordinates.lat,
    longitude: raw.coordinates.lon,
    countryCode: raw.countryCode ?? '',
    admin1: raw.admin1,
    admin2: raw.admin2,
    metadata,
  });
};

export const buildCustomPointProperties = (
  raw: { id: string; name: string; latitude: number; longitude: number; countryCode?: string; admin1?: string; admin2?: string; attributes?: Record<string, unknown>; },
  kind: LocationPointKind,
  timestamp: Timestamp,
): LocationPointProperties => {
  const metadata = toMetadata({
    customId: raw.id,
    attributes: raw.attributes ?? {},
    lastSeenAt: timestamp,
  });

  return createLocationPointProperties({
    pointId: toPointId(),
    name: raw.name,
    kind,
    latitude: raw.latitude,
    longitude: raw.longitude,
    countryCode: raw.countryCode ?? '',
    admin1: raw.admin1,
    admin2: raw.admin2,
    metadata,
  });
};

export const buildOurAirportsPointProperties = (
  raw: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    ident?: string;
    type?: string;
    iataCode?: string;
    icaoCode?: string;
    localCode?: string;
    municipality?: string;
    isoCountry?: string;
    countryName?: string;
    isoRegion?: string;
    scheduledService?: string;
    elevationFt?: number;
    continent?: string;
    homeLink?: string;
    wikipediaLink?: string;
    keywords?: string;
  },
  timestamp: Timestamp,
): LocationPointProperties => {
  const primaryCode = raw.iataCode || raw.icaoCode || raw.localCode || raw.ident;
  const metadata = toMetadata({
    ourAirportsId: raw.id,
    airportCode: primaryCode,
    ident: raw.ident,
    airportType: raw.type,
    iataCode: raw.iataCode,
    icaoCode: raw.icaoCode,
    localCode: raw.localCode,
    municipality: raw.municipality,
    isoRegion: raw.isoRegion,
    scheduledService: raw.scheduledService,
    elevationFt: raw.elevationFt,
    continent: raw.continent,
    homeLink: raw.homeLink,
    wikipediaLink: raw.wikipediaLink,
    keywords: raw.keywords,
    lastSeenAt: timestamp,
  });

  return createLocationPointProperties({
    pointId: toPointId(),
    name: raw.name,
    kind: 'airport',
    latitude: raw.latitude,
    longitude: raw.longitude,
    countryCode: raw.isoCountry?.toUpperCase() ?? '',
    countryName: raw.countryName,
    admin1: raw.isoRegion,
    admin2: raw.municipality,
    metadata,
  });
};

export const buildOpenFlightsPointProperties = (
  raw: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
    iata?: string;
    icao?: string;
    altitude?: number;
    timezone?: number;
    dst?: string;
    tz?: string;
    type?: string;
    source?: string;
  },
  timestamp: Timestamp,
): LocationPointProperties => {
  const primaryCode = raw.iata || raw.icao;
  const metadata = toMetadata({
    openFlightsId: raw.id,
    airportCode: primaryCode,
    city: raw.city,
    country: raw.country,
    iataCode: raw.iata,
    icaoCode: raw.icao,
    altitude: raw.altitude,
    timezone: raw.timezone,
    dst: raw.dst,
    timezoneName: raw.tz,
    source: raw.source,
    lastSeenAt: timestamp,
  });

  return createLocationPointProperties({
    pointId: toPointId(),
    name: raw.name,
    kind: 'airport',
    latitude: raw.latitude,
    longitude: raw.longitude,
    countryCode: '',
    countryName: raw.country,
    admin1: undefined,
    admin2: raw.city,
    metadata,
  });
};

export const buildWorldPortIndexPointProperties = (
  raw: {
    id?: string;
    name: string;
    latitude: number;
    longitude: number;
    countryCode?: string;
    countryName?: string;
    regionName?: string;
    unlocode?: string;
    harborSize?: string;
    harborType?: string;
    shelter?: string;
    tideRange?: string;
  },
  timestamp: Timestamp,
): LocationPointProperties => {
  const metadata = toMetadata({
    worldPortIndexId: raw.id,
    portCode: raw.unlocode,
    harborSize: raw.harborSize,
    harborType: raw.harborType,
    shelter: raw.shelter,
    tideRange: raw.tideRange,
    lastSeenAt: timestamp,
  });

  return createLocationPointProperties({
    pointId: toPointId(),
    name: raw.name,
    kind: 'port',
    latitude: raw.latitude,
    longitude: raw.longitude,
    countryCode: raw.countryCode?.toUpperCase() ?? '',
    countryName: raw.countryName,
    admin1: raw.regionName,
    metadata,
  });
};
