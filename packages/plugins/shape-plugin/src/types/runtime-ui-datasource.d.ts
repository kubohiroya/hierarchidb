declare module '@hierarchidb/runtime-ui-datasource' {
  export type DataSourceName =
    | 'naturalearth'
    | 'gadm'
    | 'geoboundaries'
    | 'openstreetmap'
    | string;

  export interface DataSourceInfo {
    id: DataSourceName | string;
    name: string;
    description?: string;
    category?: string;
    dataTypes?: string[];
    coverageLevel?: string;
    updateFrequency?: string;
    license?: string;
    attribution?: string;
    supported?: boolean;
  }

  export interface CountryMetadata {
    countryCode: string;
    countryName: string;
    continent: string;
    adminLevels: number[];
    population?: number;
    area?: number;
    dataQuality?: 'high' | 'medium' | 'low';
    [key: string]: unknown;
  }

  export interface ValidationResult {
    isValid: boolean;
    errors?: string[];
    warnings?: string[];
  }

  export type BoundingBox = [number, number, number, number];

  export interface AdminLevelInfo {
    level: number;
    name?: string;
  }

  export class DataSourceManager {
    constructor(options?: { cacheTTL?: number });

    getCountryMetadata(dataSource: DataSourceName, countryCode: string): Promise<CountryMetadata>;
    getAvailableDataSources(): Promise<DataSourceInfo[]>;
    clearCache(dataSource?: DataSourceName): Promise<void>;
  }
}
