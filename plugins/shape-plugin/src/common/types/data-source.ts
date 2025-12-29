import type { ISO2, ISO3 } from '@hierarchidb/common-types';

export type DataSourceName = 'naturalearth' | 'geoboundaries' | 'gadm' | 'openstreetmap';
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

export interface DownloadTaskPayload {
  url: string;
  countryCode: CountryCode;
  countryName?: string;
  adminLevel: number;
  continent: string;
  dataSource?: DataSourceName;
  country?: CountryCode;
}
