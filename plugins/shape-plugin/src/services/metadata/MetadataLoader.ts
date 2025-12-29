import gadmMetadata from '@hierarchidb/fetch-save-metadata/output/gadm.json' with { type: 'json' };
import geoboundariesMetadata from '@hierarchidb/fetch-save-metadata/output/geoboundaries.json' with { type: 'json' };
import naturalearthMetadata from '@hierarchidb/fetch-save-metadata/output/naturalearth.json' with { type: 'json' };
import osmMetadata from '@hierarchidb/fetch-save-metadata/output/osm.json' with { type: 'json' };
import type { CountryMetadata, DataSourceName } from '../../common/types/index.js';
import { normalizeDataSourceName } from '../utils/utils.js';
import { normalizeCountryCodeFormat } from '../utils/iso3166.js';

type RawCountryMetadata = Partial<CountryMetadata> & {
  availableAdminLevels?: Array<number | { level?: number } | string>;
  adminLevels?: Array<number | { level?: number }>;
  maxAdminLevel?: number;
  countryCode?: string;
  iso2?: string;
  iso3?: string;
  countryName?: string;
  continent?: string;
  population?: number;
  area?: number;
  bbox?: number[];
};

/**
 * MetadataLoader service
 * Loads country metadata from @hierarchidb/fetch-save-metadata output files
 */
export class MetadataLoader {
  private static instance: MetadataLoader | null = null;
  private metadataCache: Map<DataSourceName, CountryMetadata[]> = new Map();

  // Mapping of data source names to metadata file names
  private readonly metadataModules: Record<DataSourceName, RawCountryMetadata[]> = {
    gadm: gadmMetadata as unknown as RawCountryMetadata[],
    geoboundaries: geoboundariesMetadata as unknown as RawCountryMetadata[],
    naturalearth: naturalearthMetadata as unknown as RawCountryMetadata[],
    openstreetmap: osmMetadata as unknown as RawCountryMetadata[],
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
      // Import metadata from 02-fetch-save-metadata package
      const moduleData = this.metadataModules[normalized];
      if (!moduleData) {
        console.warn(`Unknown data source: ${normalized}`);
        return [];
      }
      const rawData = moduleData;

      const metadata = await this.transformMetadata(rawData, normalized);

      // Cache the result
      this.metadataCache.set(normalized, metadata);

      return metadata;
    } catch (error) {
      console.error(`Error loading metadata for ${normalized}:`, error);
      return [];
    }
  }

  /**
   * Transform raw metadata to CountryMetadata format
   */
  private async transformMetadata(
    rawData: RawCountryMetadata[],
    _dataSource: string,
  ): Promise<CountryMetadata[]> {
    return Promise.all(rawData.map(async (item) => {
      const resolvedLevels = this.normalizeAvailableLevels(item);
      const rawCode = (item.iso2 ?? item.countryCode ?? item.iso3 ?? '').trim();
      const normalizedIso2 = rawCode
        ? await normalizeCountryCodeFormat(rawCode, 'iso2')
        : '';
      const iso2 = normalizedIso2.length === 2
        ? normalizedIso2
        : (item.iso2?.trim().toUpperCase() ?? '');
      const countryCode = iso2 || 'UNKNOWN';
      if (!iso2 && rawCode) {
        console.warn('[MetadataLoader] failed to resolve ISO2 code', {
          rawCode,
          iso3: item.iso3,
          countryName: item.countryName,
        });
      }
      return {
        countryCode,
        countryName: item.countryName || '',
        continent: item.continent || '',
        availableAdminLevels: resolvedLevels,
        iso2: iso2 || undefined,
        iso3: item.iso3?.trim().toUpperCase(),
        bbox: Array.isArray(item.bbox) && item.bbox.length === 4
          ? [item.bbox[0] as number, item.bbox[1] as number, item.bbox[2] as number, item.bbox[3] as number]
          : undefined,
        population: item.population,
        area: item.area,
        dataQuality: this.determineDataQuality(resolvedLevels),
      };
    }));
  }

  private normalizeAvailableLevels(item: RawCountryMetadata): number[] {
    if (Array.isArray(item.availableAdminLevels)) {
      return item.availableAdminLevels
        .map((v: unknown) => (typeof v === 'number' ? v : Number.NaN))
        .filter((v: number) => Number.isFinite(v))
        .sort((a: number, b: number) => a - b);
    }
    if (Array.isArray(item.adminLevels)) {
      const levels = item.adminLevels
        .map((v: unknown) => {
          if (typeof v === 'number') return v;
          if (v && typeof (v as { level?: unknown }).level === 'number') return (v as { level: number }).level;
          return Number.NaN;
        })
        .filter((v: number) => Number.isFinite(v))
        .sort((a: number, b: number) => a - b);
      return levels.length ? levels : [];
    }
    if (typeof item.maxAdminLevel === 'number' && item.maxAdminLevel >= 0) {
      return Array.from({ length: item.maxAdminLevel + 1 }, (_, idx) => idx);
    }
    return [];
  }

  /**
   * Determine data quality based on available levels
   */
  private determineDataQuality(levels: number[]): 'high' | 'medium' | 'low' {
    const numLevels = levels.length || 0;
    if (numLevels >= 4) return 'high';
    if (numLevels >= 2) return 'medium';
    return 'low';
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
    return Object.keys(this.metadataModules);
  }
}

export const metadataLoader = MetadataLoader.getInstance();
