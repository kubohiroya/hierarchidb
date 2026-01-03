import type { CountryMetadata, DataSourceName } from '../../common/types/index.js';
import { normalizeDataSourceName } from '../utils/utils.js';
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
  private metadataCache: Map<DataSourceName, CountryMetadata[]> = new Map();

  private readonly loaders: Record<DataSourceName, () => Promise<CountryMetadata[]>> = {
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
  async loadMetadata(dataSource: string): Promise<CountryMetadata[]> {
    const normalized = normalizeDataSourceName(dataSource);
    if (!normalized) {
      console.warn(`No metadata file mapping for data source: ${dataSource}`);
      return [];
    }

    if (this.metadataCache.has(normalized)) {
      return this.metadataCache.get(normalized)!;
    }

    try {
      const loader = this.loaders[normalized];
      if (!loader) {
        console.warn(`Unknown data source: ${normalized}`);
        return [];
      }
      const metadata = await loader();

      // Cache the result
      this.metadataCache.set(normalized, metadata);

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
  ): Promise<CountryMetadata | undefined> {
    const allMetadata = await this.loadMetadata(dataSource);
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
  ): Promise<CountryMetadata[]> {
    const allMetadata = await this.loadMetadata(dataSource);
    const lowerCodes = countryCodes.map((code) => code.toLowerCase());

    return allMetadata.filter((country) => lowerCodes.includes(country.countryCode.toLowerCase()));
  }

  /**
   * Clear cache for a specific data source or all
   */
  clearCache(dataSource?: string): void {
    if (dataSource) {
      const normalized = normalizeDataSourceName(dataSource);
      if (normalized) {
        this.metadataCache.delete(normalized);
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
