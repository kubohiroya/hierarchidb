import type { DataSourceLogics } from './utils/types.js';
import { fetchGADM } from './metadata-fetchers/gadm.js';
import { fetchNaturalEarth } from './metadata-fetchers/naturalearth.js';
import { fetchOSM } from './metadata-fetchers/osm.js';
import { fetchGeoBoundaries } from './metadata-fetchers/geoboundaries.js';

/**
 * Available data source metadata-fetchers
 */
export const dataSourceLogics: DataSourceLogics = {
  gadm: fetchGADM,
  naturalearth: fetchNaturalEarth,
  osm: fetchOSM,
  geoboundaries: fetchGeoBoundaries,
};

/**
 * Fetch metadata from a specific data source
 */
export async function fetchMetadata(
  dataSource: string,
  outputDirName: string,
  outputFileName: string,
): Promise<void> {
  const fetcher = dataSourceLogics[dataSource];

  if (!fetcher) {
    throw new Error(
      `Unknown data source: ${dataSource}. Available sources: ${Object.keys(dataSourceLogics).join(', ')}`,
    );
  }

  await fetcher(outputDirName, outputFileName);
}

/**
 * Get list of available data sources
 */
export function getAvailableDataSources(): string[] {
  return Object.keys(dataSourceLogics);
}

// Re-export types
export type {
  RegionMetadata,
  DataSourceFetcher,
  DataSourceLogics,
} from './utils/types.js';

export type {
  CountryMetadata,
  DataSourceName,
} from './types.js';
