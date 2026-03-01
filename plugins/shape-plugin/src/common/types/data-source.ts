import type { ISO2, ISO3 } from '@hierarchidb/core-types';

export type DataSourceName = 'naturalearth' | 'geoboundaries' | 'geoboundaries-topojson' | 'gadm';
export type CountryCode = ISO2 | ISO3;
export type CountryCodeFormat = 'iso2' | 'iso3';

export interface DataSourceConfig {
  name: DataSourceName;
  displayName: string;
  description: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  color: string;
  icon: string;
  maxAdminLevel: number;
  countryCodeFormat?: CountryCodeFormat;
  supportedCountries?: string[];
}

export interface CountryMetadata {
  countryCode: ISO2;
  countryName: string;
  continent: string;
  availableAdminLevels: number[];
  iso2?: ISO2;
  iso3?: ISO3;
  bbox?: [number, number, number, number];
  population?: number;
  area?: number;
  dataQuality?: 'high' | 'medium' | 'low';
}

export interface SourceTaskPayload {
  url: string;
  upstreamRevision?: string;
  countryCode: CountryCode;
  countryName?: string;
  adminLevel: number;
  dataSource: DataSourceName;
}

export function isDataSourceName(value: unknown): value is DataSourceName {
  if (typeof value !== 'string') return false;
  return value === 'naturalearth'
    || value === 'geoboundaries'
    || value === 'geoboundaries-topojson'
    || value === 'gadm';
}

export function requireDataSourceName(value: unknown, context: string): DataSourceName {
  if (typeof value !== 'string') {
    throw new Error(`[shape-plugin] ${context} requires a data source name.`);
  }
  if (isDataSourceName(value)) return value;
  throw new Error(`[shape-plugin] ${context} received invalid data source: ${value}`);
}
