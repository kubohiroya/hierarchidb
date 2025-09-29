import type { DataSourceLogics } from './utils/types.js';
/**
 * Available data source fetchers
 */
export declare const dataSourceLogics: DataSourceLogics;
/**
 * Fetch metadata from a specific data source
 */
export declare function fetchMetadata(dataSource: string, outputDirName: string, outputFileName: string): Promise<void>;
/**
 * Get list of available data sources
 */
export declare function getAvailableDataSources(): string[];
export type { RegionMetadata, DataSourceFetcher, DataSourceLogics, } from './utils/types.js';
export type { CountryMetadata, DataSourceName, } from './types.js';
//# sourceMappingURL=index.d.ts.map