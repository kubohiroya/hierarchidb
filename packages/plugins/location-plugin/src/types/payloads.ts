/**
 * Location plugin payload definitions by data source.
 */

export interface OsmPointPayload extends Record<string, unknown> {
  osmId: string;
  osmType: 'node' | 'way' | 'relation';
  tags: Record<string, string>;
  categories?: string[];
  lastSeenAt?: number;
}

export interface OverpassPointPayload extends OsmPointPayload {
  overpassQuery?: string;
}

export interface GeoNamesPointPayload extends Record<string, unknown> {
  geonameId: number;
  featureClass: string;
  featureCode: string;
  population?: number;
  elevation?: number;
  timezone?: string;
  adminCodes?: {
    level1?: string;
    level2?: string;
  };
  alternateNames?: string[];
}

export interface WikidataPointPayload extends Record<string, unknown> {
  entityId: string;
  labels: Record<string, string>;
  descriptions?: Record<string, string>;
  wikipediaTitle?: string;
  instanceOf?: string[];
  properties?: Record<string, unknown>;
}

export interface CustomPointPayload extends Record<string, unknown> {
  schemaVersion: number;
  attributes: Record<string, unknown>;
}

export type LocationPointPayloadBySource = {
  openstreetmap: OsmPointPayload;
  overpass: OverpassPointPayload;
  geonames: GeoNamesPointPayload;
  wikidata: WikidataPointPayload;
  custom: CustomPointPayload;
  manual: CustomPointPayload;
};

export type LocationPointPayloadUnion =
  LocationPointPayloadBySource[keyof LocationPointPayloadBySource];
