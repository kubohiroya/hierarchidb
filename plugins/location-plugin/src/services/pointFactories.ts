import type { Timestamp } from '@hierarchidb/common-types';
import type {
  LocationPointProperties,
  LocationPointSource,
} from '../common/entities/LocationPoint.js';
import type {
  LocationPointPayloadBySource,
  OsmPointPayload,
  OverpassPointPayload,
  GeoNamesPointPayload,
  WikidataPointPayload,
  CustomPointPayload,
} from '../common/types/payloads.js';
import type { LocationPointKind } from '../common/entities/LocationPoint.js';
import type { RawNominatimResult, RawOverpassElement } from './download/rawTypes.js';
import { sanitizeTags } from './download/mappers.js';

interface BasePointParams<TPayload extends Record<string, unknown>> {
  pid: string;
  name: string;
  kind: LocationPointKind;
  latitude: number;
  longitude: number;
  gid0: string;
  gid1?: string;
  gid2?: string;
  payload: TPayload;
  source: LocationPointSource;
}

export const createLocationPointProperties = <
  TPayload extends Record<string, unknown>,
>(params: BasePointParams<TPayload>): LocationPointProperties<TPayload> => ({
  schemaVersion: 1,
  pid: params.pid,
  name: params.name,
  latitude: params.latitude,
  longitude: params.longitude,
  kind: params.kind,
  gid0: params.gid0,
  gid1: params.gid1,
  gid2: params.gid2,
  payload: params.payload,
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
): LocationPointProperties<LocationPointPayloadBySource['openstreetmap']> => {
  const payload: OsmPointPayload = {
    osmId: String(raw.osm_id),
    osmType: (raw.osm_type === 'node' || raw.osm_type === 'way' || raw.osm_type === 'relation') ? raw.osm_type : 'node',
    tags: sanitizeTags(raw.extratags) ?? {},
    categories: raw.class ? [raw.class] : undefined,
    lastSeenAt: timestamp,
  };

  const source = toSource('openstreetmap', timestamp, String(raw.osm_id));
  const gid0 = raw.address?.country_code?.toUpperCase() ?? '';
  const gid1 = raw.address?.state;
  const gid2 = raw.address?.city || raw.address?.town || raw.address?.village;

  return createLocationPointProperties({
    pid: toPid('osm', raw.osm_id),
    name: raw.display_name ?? 'Unknown',
    kind,
    latitude,
    longitude,
    gid0,
    gid1: gid1 ?? undefined,
    gid2: gid2 ?? undefined,
    payload,
    source,
  });
};

export const buildOverpassPointProperties = (
  raw: RawOverpassElement,
  kind: LocationPointKind,
  latitude: number,
  longitude: number,
  timestamp: Timestamp,
): LocationPointProperties<LocationPointPayloadBySource['overpass']> => {
  const basePayload: OsmPointPayload = {
    osmId: String(raw.id),
    osmType: (raw.type === 'node' || raw.type === 'way' || raw.type === 'relation') ? raw.type : 'node',
    tags: sanitizeTags(raw.tags) ?? {},
    categories: raw.tags?.amenity ? [raw.tags.amenity] : undefined,
    lastSeenAt: timestamp,
  };
  const payload: OverpassPointPayload = {
    ...basePayload,
    overpassQuery: raw.tags?.overpassQuery,
  };

  const source = toSource('overpass', timestamp, String(raw.id));
  const gid0 = raw.tags?.['addr:country']?.toUpperCase() ?? '';
  const gid1 = raw.tags?.['addr:state'] ?? raw.tags?.['addr:region'];
  const gid2 = raw.tags?.['addr:city'] ?? raw.tags?.['addr:district'];

  return createLocationPointProperties({
    pid: toPid('overpass', raw.id),
    name: raw.tags?.name ?? 'Unknown',
    kind,
    latitude,
    longitude,
    gid0,
    gid1: gid1 ?? undefined,
    gid2: gid2 ?? undefined,
    payload,
    source,
  });
};

export const buildGeoNamesPointProperties = (
  raw: { geonameId: number; name: string; countryCode?: string; adminCode1?: string; adminCode2?: string; lat: number; lng: number; featureClass?: string; featureCode?: string; population?: number; elevation?: number; timezone?: string; alternateNames?: string[]; },
  kind: LocationPointKind,
  timestamp: Timestamp,
): LocationPointProperties<GeoNamesPointPayload> => {
  const payload: GeoNamesPointPayload = {
    geonameId: raw.geonameId,
    featureClass: raw.featureClass ?? 'unknown',
    featureCode: raw.featureCode ?? 'unknown',
    population: raw.population,
    elevation: raw.elevation,
    timezone: raw.timezone,
    adminCodes: {
      level1: raw.adminCode1,
      level2: raw.adminCode2,
    },
    alternateNames: raw.alternateNames,
  };

  const source = toSource('geonames', timestamp, String(raw.geonameId));

  return createLocationPointProperties({
    pid: toPid('geonames', raw.geonameId),
    name: raw.name,
    kind,
    latitude: raw.lat,
    longitude: raw.lng,
    gid0: raw.countryCode ?? '',
    gid1: raw.adminCode1,
    gid2: raw.adminCode2,
    payload,
    source,
  });
};

export const buildWikidataPointProperties = (
  raw: { entityId: string; label: string; coordinates: { lat: number; lon: number }; countryCode?: string; admin1?: string; admin2?: string; descriptions?: Record<string, string>; wikipediaTitle?: string; instanceOf?: string[]; properties?: Record<string, unknown>; },
  kind: LocationPointKind,
  timestamp: Timestamp,
): LocationPointProperties<WikidataPointPayload> => {
  const payload: WikidataPointPayload = {
    entityId: raw.entityId,
    labels: { default: raw.label },
    descriptions: raw.descriptions,
    wikipediaTitle: raw.wikipediaTitle,
    instanceOf: raw.instanceOf,
    properties: raw.properties,
  };

  const source = toSource('wikidata', timestamp, raw.entityId);

  return createLocationPointProperties({
    pid: toPid('wikidata', raw.entityId),
    name: raw.label,
    kind,
    latitude: raw.coordinates.lat,
    longitude: raw.coordinates.lon,
    gid0: raw.countryCode ?? '',
    gid1: raw.admin1,
    gid2: raw.admin2,
    payload,
    source,
  });
};

export const buildCustomPointProperties = (
  raw: { id: string; name: string; latitude: number; longitude: number; countryCode?: string; admin1?: string; admin2?: string; attributes?: Record<string, unknown>; },
  kind: LocationPointKind,
  timestamp: Timestamp,
): LocationPointProperties<CustomPointPayload> => {
  const payload: CustomPointPayload = {
    schemaVersion: 1,
    attributes: raw.attributes ?? {},
  };

  const source = toSource('custom', timestamp, raw.id);

  return createLocationPointProperties({
    pid: toPid('custom', raw.id),
    name: raw.name,
    kind,
    latitude: raw.latitude,
    longitude: raw.longitude,
    gid0: raw.countryCode ?? '',
    gid1: raw.admin1,
    gid2: raw.admin2,
    payload,
    source,
  });
};
