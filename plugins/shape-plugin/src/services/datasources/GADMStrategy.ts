/**
  * GADM (Database of Global Administrative Areas)
 * https://gadm.org/
  */

import { BaseDataSourceStrategy, type DataSourceConfig, type FetchOptions, type ProcessOptions } from './DataSourceStrategy.js';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { ShapeEntity } from '../../common/types/index.js';

//  GADM
export interface GADMRawData {
  geopackage?: ArrayBuffer;
  shapefile?: Map<string, ArrayBuffer>;
  metadata: {
    source: 'gadm';
    downloadedAt: string;
    country: string;
    level: number;
    format: 'gpkg' | 'shp';
    version: string;
  };
}

//  GADM
export interface GADMProcessedData extends Array<ShapeEntity> {
  metadata?: {
    source: 'gadm';
    processedAt: string;
    count: number;
    country: string;
    adminLevel: number;
    version: string;
  };
}

type GADMProperties = Record<string, unknown>;
type GADMGeoJSON = FeatureCollection<Geometry, GADMProperties>;
type GADMFeature = Feature<Geometry, GADMProperties>;

/**
  * GADM
  */
export class GADMStrategy extends BaseDataSourceStrategy<GADMRawData, GADMProcessedData> {
  readonly id = 'gadm-administrative-areas';
  readonly name = 'GADM Administrative Areas';
  readonly config: DataSourceConfig = {
    id: 'gadm-administrative-areas',
    name: 'GADM Database of Global Administrative Areas',
    description: 'Global administrative areas (countries, provinces, counties) at multiple levels',
    version: '4.1',
    access: {
      method: 'File',
      baseUrl: 'https://geodata.ucdavis.edu/gadm/gadm4.1/',
      endpoints: {
        'country-gpkg': '{format}/{country}_adm_{level}.{format}',
        'country-shp': 'shp/{country}_adm_shp.zip',
        'world-gpkg': 'gadm41.gpkg',
        'world-levels': 'gadm41_levels.gpkg',
      },
      authentication: { type: 'none' },
      timeout: 120000, //  2
      retries: { count: 3, delay: 5000, backoff: 'linear' },
    },
    processing: {
      inputFormat: 'geojson', //  GeoPackage
      outputFormat: 'geojson',
      validation: [
        { field: 'geometry', rule: 'required' },
        { field: 'properties.GID_0', rule: 'required' },
        { field: 'properties.NAME_0', rule: 'required' },
      ],
      transformations: [
        { type: 'coordinate-system', from: 'EPSG:4326', to: 'EPSG:4326' },
      ],
    },
    cache: {
      ttl: 86400000 * 30, //  30
      strategy: 'disk',
    },
  };

  //  ISO 3166-1 alpha-3
  private readonly countryMappings: Record<string, string> = {
    'japan': 'JPN',
    'usa': 'USA',
    'united-states': 'USA',
    'canada': 'CAN',
    'mexico': 'MEX',
    'brazil': 'BRA',
    'argentina': 'ARG',
    'australia': 'AUS',
    'china': 'CHN',
    'india': 'IND',
    'russia': 'RUS',
    'germany': 'DEU',
    'france': 'FRA',
    'italy': 'ITA',
    'spain': 'ESP',
    'united-kingdom': 'GBR',
    'south-africa': 'ZAF',
    'egypt': 'EGY',
    'nigeria': 'NGA',
  };

  async fetchData(options?: FetchOptions): Promise<GADMRawData> {
    const {
      country = 'JPN',
      adminLevel = 1,
      endpoint = 'country-gpkg',
      timeout = this.config.access.timeout,
    } = options || {};

    const normalizedCountry = this.normalizeCountryCode(country);
    const level = Math.min(Math.max(adminLevel, 0), 5); // GADM supports levels 0-5

    try {
      let downloadUrl: string;
      let format: 'gpkg' | 'shp';

      if (endpoint === 'country-shp') {
        //  Shapefile
        format = 'shp';
        downloadUrl = `${this.config.access.baseUrl}shp/${normalizedCountry}_adm_shp.zip`;
      } else {
        //  GeoPackage
        format = 'gpkg';
        downloadUrl = `${this.config.access.baseUrl}gpkg/${normalizedCountry}_adm_gpkg.zip`;
      }

      console.log(`[GADM] Downloading ${format.toUpperCase()} for ${normalizedCountry} level ${level}: ${downloadUrl}`);

      const response = await this.downloadWithRetry(downloadUrl, timeout);

      if (format === 'gpkg') {
        const zipBuffer = await response.arrayBuffer();
        const geopackage = await this.extractGeoPackageFromZip(zipBuffer);

        return {
          geopackage,
          metadata: {
            source: 'gadm',
            downloadedAt: new Date().toISOString(),
            country: normalizedCountry,
            level,
            format,
            version: '4.1',
          },
        };
      } else {
        const zipBuffer = await response.arrayBuffer();
        const shapefile = await this.extractShapefileFromZip(zipBuffer);

        return {
          shapefile,
          metadata: {
            source: 'gadm',
            downloadedAt: new Date().toISOString(),
            country: normalizedCountry,
            level,
            format,
            version: '4.1',
          },
        };
      }

    } catch (error) {
      throw new Error(`Failed to download GADM data for ${normalizedCountry}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processData(rawData: GADMRawData, options?: ProcessOptions): Promise<GADMProcessedData> {
    const { filters, adminLevel } = options || {};

    try {
      let geojson: GADMGeoJSON;

      if (rawData.geopackage) {
        //  GeoPackage
        geojson = await this.processGeoPackage(rawData.geopackage, rawData.metadata.level);
      } else if (rawData.shapefile) {
        //  Shapefile
        geojson = await this.processShapefile(rawData.shapefile);
      } else {
        throw new Error('No valid data found in raw data');
      }

      let features: GADMFeature[] = geojson.features;
      if (adminLevel !== undefined) {
        features = features.filter((feature: GADMFeature) => {
          const level = this.extractAdminLevel(feature.properties ?? {});
          return level === adminLevel;
        });
      }

      if (filters && filters.length > 0) {
        features = await this.applyFilters(features, filters);
      }

      //  ShapeEntity
      return features.map((feature: GADMFeature, index: number) => {
        const properties = feature.properties ?? {};
        const processedAt = new Date().toISOString();

        return {
          //id: this.generateEntityId(properties, index),
          // nodeId: this.generateNodeId(properties, index),
          // name: this.extractName(properties),
          // description: this.extractDescription(properties),
          geometry: feature.geometry,
          properties: {
            ...properties,
            source: 'gadm',
            country: rawData.metadata.country,
            adminLevel: this.extractAdminLevel(properties),
            gadmVersion: rawData.metadata.version,
            downloadedAt: rawData.metadata.downloadedAt,
            processedAt,
            originalIndex: index,
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        };
      });

    } catch (error) {
      throw new Error(`Failed to process GADM data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processGeoPackage(_geopackage: ArrayBuffer, _level: number): Promise<GADMGeoJSON> {
    return { type: 'FeatureCollection', features: [] };
  }

  private async processShapefile(shapefile: Map<string, ArrayBuffer>): Promise<GADMGeoJSON> {
    if (!shapefile || shapefile.size === 0) {
      throw new Error('No shapefile content to process');
    }
    const JSZipCtor = (await import('jszip')).default;
    const zip = new JSZipCtor();
    for (const [name, buf] of shapefile.entries()) {
      zip.file(name, buf);
    }
    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    const shp = (await import('shpjs')).default;
    const geojson = (await shp.parseZip(zipBuffer)) as GADMGeoJSON;
    return geojson;
  }

  private extractAdminLevel(properties: Record<string, unknown>): number {
    const value =
      properties.adminLevel ??
      properties.admin_level ??
      properties.ADM_LEVEL ??
      properties.level ??
      properties.LEVEL;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  }

  private normalizeCountryCode(country: string): string {
    const lower = country.toLowerCase().replace(/\s+/g, '-');
    return this.countryMappings[lower] || country.toUpperCase();
  }

  private async downloadWithRetry(url: string, timeout?: number): Promise<Response> {
    const { count = 3, delay = 5000, backoff = 'linear' } = this.config.access.retries || {};

    for (let attempt = 0; attempt < count; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = timeout ? setTimeout(() => controller.abort(), timeout) : null;

        const { authFetch } = await import('../utils/authFetch.js');
        const response = await authFetch(url, {
          signal: controller.signal,
        });

        if (timeoutId) clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`[GADM] HTTP ${response.status} for ${url}`);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;

      } catch (error) {
        if (attempt === count - 1) throw error;

        const waitTime = backoff === 'exponential'
          ? delay * 2 ** attempt
          : delay * (attempt + 1);

        console.warn(`[GADM] Attempt ${attempt + 1} failed, retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw new Error('Max retry attempts reached');
  }

  private async extractGeoPackageFromZip(zipBuffer: ArrayBuffer): Promise<ArrayBuffer> {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const zipData = await zip.loadAsync(zipBuffer);

    //  .gpkg
    for (const [fileName, fileData] of Object.entries(zipData.files)) {
      if (fileName.endsWith('.gpkg') && !fileData.dir) {
        return await fileData.async('arraybuffer');
      }
    }

    throw new Error('No .gpkg file found in archive');
  }

  private async extractShapefileFromZip(zipBuffer: ArrayBuffer): Promise<Map<string, ArrayBuffer>> {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const zipData = await zip.loadAsync(zipBuffer);

    const files = new Map<string, ArrayBuffer>();

    for (const [fileName, fileData] of Object.entries(zipData.files)) {
      if (!fileData.dir) {
        const buffer = await fileData.async('arraybuffer');
        files.set(fileName, buffer);
      }
    }

    return files;
  }

}
