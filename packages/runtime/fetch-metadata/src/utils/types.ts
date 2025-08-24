/**
 * Metadata structure for geographical regions
 */
export interface RegionMetadata {
  id: string;
  name: string;
  countryName: string;
  countryCode: string;
  iso2: string;
  iso3: string;
  continent: string;
  region: string;
  subregion: string;
  adminLevels: number[];
  numAdminLevels: number;
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
}

/**
 * Data source fetcher function type
 */
export type DataSourceFetcher = (
  outputDirName: string,
  outputFileName: string
) => Promise<void>;

/**
 * Collection of data source fetchers
 */
export type DataSourceLogics = Record<string, DataSourceFetcher>;