import type { CountryCode } from '@hierarchidb/common-types';

export type LocationPointKind = string;

export type LocationPointMetadata = Record<string, string | number | null>;

export type LocationPointId = string & { readonly __brand: 'LocationPointId' };

export interface LocationPointProperties {
  schemaVersion: 2;
  pointId: LocationPointId;
  name: string;
  latitude: number;
  longitude: number;
  kind: LocationPointKind;
  countryName?: string;
  countryCode: CountryCode;
  admin1?: string;
  admin2?: string;
  admin1Code?: string;
  admin2Code?: string;
  metadata?: LocationPointMetadata;
}

export interface LocationGroupItemData extends LocationPointProperties {}

export interface LocationRelationMeta {
  schemaVersion: 1;
  relationKind?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}
