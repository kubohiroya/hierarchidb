import type { CountryMetadata } from '~/types';
import type { CountryMetadata as FetchedCountryMetadata } from '@hierarchidb/02-fetch-metadata';

/**
 * MetadataLoader service
 * Loads country metadata from @hierarchidb/02-fetch-metadata output files
 */
export class MetadataLoader {
  private static instance: MetadataLoader | null = null;
  private metadataCache: Map<string, CountryMetadata[]> = new Map();
  
  // Mapping of data source names to metadata file names
  private readonly dataSourceFileMap: Record<string, string> = {
    'GADM': 'gadm.json',
    'GeoBoundaries': 'geoboundaries.json',
    'NaturalEarth': 'naturalearth.json',
    'OpenStreetMap': 'osm.json',
  };

  private constructor() {}

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
    // Check cache first
    if (this.metadataCache.has(dataSource)) {
      return this.metadataCache.get(dataSource)!;
    }

    const fileName = this.dataSourceFileMap[dataSource];
    if (!fileName) {
      console.warn(`No metadata file mapping for data source: ${dataSource}`);
      return [];
    }

    try {
      // Import metadata from 02-fetch-metadata package
      let rawData: any[];
      
      switch (dataSource) {
        case 'GADM':
          rawData = await import('@hierarchidb/02-fetch-metadata/output/gadm.json').then(m => m.default);
          break;
        case 'GeoBoundaries':
          rawData = await import('@hierarchidb/02-fetch-metadata/output/geoboundaries.json').then(m => m.default);
          break;
        case 'NaturalEarth':
          rawData = await import('@hierarchidb/02-fetch-metadata/output/naturalearth.json').then(m => m.default);
          break;
        case 'OpenStreetMap':
          rawData = await import('@hierarchidb/02-fetch-metadata/output/osm.json').then(m => m.default);
          break;
        default:
          console.warn(`Unknown data source: ${dataSource}`);
          return [];
      }
      
      const metadata = this.transformMetadata(rawData, dataSource);
      
      // Cache the result
      this.metadataCache.set(dataSource, metadata);
      
      return metadata;
    } catch (error) {
      console.error(`Error loading metadata for ${dataSource}:`, error);
      return [];
    }
  }

  /**
   * Transform raw metadata to CountryMetadata format
   */
  private transformMetadata(rawData: FetchedCountryMetadata[], dataSource: string): CountryMetadata[] {
    return rawData.map(item => ({
      countryCode: item.iso3 || item.countryCode || item.id,
      countryName: item.name || item.countryName || '',
      continent: item.continent || '',
      availableAdminLevels: item.adminLevels || [],
      population: item.population,
      area: item.area,
      dataQuality: this.determineDataQuality(item),
    }));
  }

  /**
   * Determine data quality based on metadata
   */
  private determineDataQuality(item: any): 'high' | 'medium' | 'low' {
    const numLevels = item.adminLevels?.length || 0;
    if (numLevels >= 4) return 'high';
    if (numLevels >= 2) return 'medium';
    return 'low';
  }

  /**
   * Get metadata for a specific country
   */
  async getCountryMetadata(
    dataSource: string,
    countryCode: string
  ): Promise<CountryMetadata | undefined> {
    const allMetadata = await this.loadMetadata(dataSource);
    return allMetadata.find(
      country => 
        country.countryCode === countryCode ||
        country.countryCode.toLowerCase() === countryCode.toLowerCase()
    );
  }

  /**
   * Get metadata for multiple countries
   */
  async getCountriesMetadata(
    dataSource: string,
    countryCodes: string[]
  ): Promise<CountryMetadata[]> {
    const allMetadata = await this.loadMetadata(dataSource);
    const lowerCodes = countryCodes.map(code => code.toLowerCase());
    
    return allMetadata.filter(country =>
      lowerCodes.includes(country.countryCode.toLowerCase())
    );
  }

  /**
   * Clear cache for a specific data source or all
   */
  clearCache(dataSource?: string): void {
    if (dataSource) {
      this.metadataCache.delete(dataSource);
    } else {
      this.metadataCache.clear();
    }
  }

  /**
   * Get all available data sources
   */
  getAvailableDataSources(): string[] {
    return Object.keys(this.dataSourceFileMap);
  }
}

export const metadataLoader = MetadataLoader.getInstance();