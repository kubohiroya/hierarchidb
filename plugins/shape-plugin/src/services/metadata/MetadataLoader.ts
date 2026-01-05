import type { CountryMetadata, DataSourceName } from '../../common/types/index.js';
import { normalizeDataSourceName } from '../utils/utils.js';
import type { NodeId } from '@hierarchidb/common-types';
import {
  assertDataSourceSupported,
  fetchGeoBoundariesMetadata,
  fetchGadmMetadata,
  fetchNaturalEarthMetadata,
} from './metadataSources.js';

/**
 * MetadataLoader service
 * Loads country metadata via @hierarchidb/chunk-store with source-specific parsing
 */
export class MetadataLoader {
  private static instance: MetadataLoader | null = null;
  private metadataCache: Map<string, CountryMetadata[]> = new Map();

  private readonly loaders: Record<DataSourceName, (nodeId: NodeId) => Promise<CountryMetadata[]>> = {
    gadm: fetchGadmMetadata,
    geoboundaries: fetchGeoBoundariesMetadata,
    naturalearth: fetchNaturalEarthMetadata,
    openstreetmap: async () => {
      assertDataSourceSupported('openstreetmap');
      return [];
    },
  };

  private constructor() {
  }

  static getInstance(): MetadataLoader {
    if (!MetadataLoader.instance) {
      MetadataLoader.instance = new MetadataLoader();
    }
    return MetadataLoader.instance;
  }

  /**
   * Load metadata for a specific data source
   */
  async loadMetadata(dataSource: string, nodeId: NodeId): Promise<CountryMetadata[]> {
    const normalized = normalizeDataSourceName(dataSource);
    if (!normalized) {
      console.warn(`No metadata file mapping for data source: ${dataSource}`);
      return [];
    }

    const cacheKey = `${normalized}:${nodeId}`;
    if (this.metadataCache.has(cacheKey)) {
      return this.metadataCache.get(cacheKey)!;
    }

    try {
      const loader = this.loaders[normalized];
      if (!loader) {
        console.warn(`Unknown data source: ${normalized}`);
        return [];
      }
      const metadata = await loader(nodeId);

      // Cache the result
      this.metadataCache.set(cacheKey, metadata);

      return metadata;
    } catch (error) {
      console.error(`Error loading metadata for ${normalized}:`, error);
      if (error instanceof Error && /openstreetmap/i.test(error.message)) {
        throw error;
      }
      return [];
    }
  }

  /**
   * Get metadata for a specific country
   */
  async getCountryMetadata(
    dataSource: string,
    countryCode: string,
    nodeId: NodeId,
  ): Promise<CountryMetadata | undefined> {
    const allMetadata = await this.loadMetadata(dataSource, nodeId);
    return allMetadata.find(
      (country) =>
        country.countryCode === countryCode ||
        country.countryCode.toLowerCase() === countryCode.toLowerCase(),
    );
  }

  /**
   * Get metadata for multiple countries
   */
  async getCountriesMetadata(
    dataSource: string,
    countryCodes: string[],
    nodeId: NodeId,
  ): Promise<CountryMetadata[]> {
    const allMetadata = await this.loadMetadata(dataSource, nodeId);
    const lowerCodes = countryCodes.map((code) => code.toLowerCase());

    return allMetadata.filter((country) => lowerCodes.includes(country.countryCode.toLowerCase()));
  }

  /**
   * Clear cache for a specific data source or all
   */
  clearCache(dataSource?: string): void {
    if (dataSource) {
      const normalized = normalizeDataSourceName(dataSource);
      if (!normalized) return;
      for (const key of this.metadataCache.keys()) {
        if (key.startsWith(`${normalized}:`)) {
          this.metadataCache.delete(key);
        }
      }
    } else {
      this.metadataCache.clear();
    }
  }

  /**
   * Get all available data sources
   */
  getAvailableDataSources(): string[] {
    return Object.keys(this.loaders);
  }
}

export const metadataLoader = MetadataLoader.getInstance();
