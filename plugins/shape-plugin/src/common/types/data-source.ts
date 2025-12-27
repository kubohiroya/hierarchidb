export type DataSourceName = 'naturalearth' | 'geoboundaries' | 'gadm' | 'openstreetmap';
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
  countryCode: string;
  countryName: string;
  continent: string;
  availableAdminLevels: number[];
  iso2?: string;
  iso3?: string;
  bbox?: [number, number, number, number];
  population?: number;
  area?: number;
  dataQuality?: 'high' | 'medium' | 'low';
}

export interface UrlMetadata {
  url: string;
  countryCode: string;
  countryName?: string;
  adminLevel: number;
  continent: string;
  dataSource?: DataSourceName;
  country?: string;
  lastUpdated?: string;
}
