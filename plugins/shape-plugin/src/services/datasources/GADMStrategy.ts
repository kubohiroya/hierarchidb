/**
  * GADM (Database of Global Administrative Areas)
 * https://gadm.org/
  */

import {
  BaseDataSourceStrategy,
  type DataSourceConfig,
  type FetchOptions,
  type ProcessOptions,
  type RawDataPipeline,
  type RawDataPipelineContext,
} from './DataSourceStrategy.js';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { ShapeEntityPayload } from '../../common/types/index.js';
import {
  buildRawDataDataSourceCacheKey,
  type RetryConfig,
} from '../utils/chunkStore.js';
import { bufferToStream, fetchRawDataWithPipeline, streamToBuffer } from '../utils/rawDataPipeline.js';
import { summarizeGeojsonFeatures } from './geojsonStats.js';

//  GADM
export interface GADMRawData {
  geojson?: GADMGeoJSON;
  metadata: {
    source: 'gadm';
    downloadedAt: string;
    country: string;
    level: number;
    format: 'json';
    version: string;
  };
}

//  GADM
export interface GADMProcessedData extends Array<ShapeEntityPayload> {
  metadata?: {
    source: 'gadm';
    processedAt: string;
    count: number;
    inputFeatureCount?: number;
    inputPolygonCount?: number;
    inputVertexCount?: number;
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
        'country-json': 'json/gadm41_{country}_{level}.json',
        'country-json-zip': 'json/gadm41_{country}_{level}.json.zip',
      },
      authentication: { type: 'none' },
      timeout: 120000, //  2
      retries: { count: 3, delay: 5000, backoff: 'linear' },
    },
    processing: {
      inputFormat: 'geojson',
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
    } = options || {};
    const resolvedNodeId = options?.nodeId;
    if (!resolvedNodeId) {
      throw new Error('GADM fetchData requires nodeId.');
    }

    const normalizedCountry = this.normalizeCountryCode(country);
    const level = Math.min(Math.max(adminLevel, 0), 5); // GADM supports levels 0-5
    const cacheKeyMode = options?.cacheKeyMode ?? 'legacy';
    const retries = options?.retryConfig ?? { count: 1, delay: 0, backoff: 'exponential' } satisfies RetryConfig;

    try {
      const downloadUrl = level === 0
        ? `${this.config.access.baseUrl}json/gadm41_${normalizedCountry}_${level}.json`
        : `${this.config.access.baseUrl}json/gadm41_${normalizedCountry}_${level}.json.zip`;

      console.log(`[GADM] Downloading JSON for ${normalizedCountry} level ${level}: ${downloadUrl}`);

      const pipeline = this.createRawDataPipeline({
        nodeId: resolvedNodeId,
        fetchOptions: options ?? {},
        metadata: {
          normalizedCountry,
          level,
          downloadUrl,
          cacheKeyMode,
        },
      });

      const { decoded } = await fetchRawDataWithPipeline({
        nodeId: resolvedNodeId,
        fetchOptions: options ?? {},
        pipeline,
        retryConfig: retries,
      });
      return decoded;

    } catch (error) {
      throw new Error(`Failed to download GADM data for ${normalizedCountry}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  createRawDataPipeline(context: RawDataPipelineContext): RawDataPipeline<GADMRawData> {
    const metadata = context.metadata as {
      normalizedCountry: string;
      level: number;
      downloadUrl: string;
      cacheKeyMode: 'url' | 'legacy';
    };
    const zipContentType = 'application/zip';
    return {
      prepareRequest: () => {
        const cacheKey = metadata.cacheKeyMode === 'url'
          ? metadata.downloadUrl
          : buildRawDataDataSourceCacheKey({
            dataSource: 'gadm',
            countryCode: metadata.normalizedCountry,
            adminLevel: metadata.level,
            url: metadata.downloadUrl,
          });
        return {
          url: metadata.downloadUrl,
          cacheKey,
          accept: metadata.level === 0 ? 'application/json' : 'application/zip',
        };
      },
      transformStream: async (stream) => {
        const rawBuffer = await streamToBuffer(stream);
        if (metadata.level === 0) {
          const zipped = await this.zipJsonBuffer(rawBuffer, metadata.normalizedCountry, metadata.level);
          return { stream: bufferToStream(zipped), contentType: zipContentType };
        }
        return { stream: bufferToStream(rawBuffer), contentType: zipContentType };
      },
      decodeBuffer: async (buffer) => {
        const geojson = await this.decodeGeoJson(buffer);
        return {
          geojson,
          metadata: {
            source: 'gadm',
            downloadedAt: new Date().toISOString(),
            country: metadata.normalizedCountry,
            level: metadata.level,
            format: 'json',
            version: '4.1',
          },
        };
      },
    };
  }

  async processData(rawData: GADMRawData, options?: ProcessOptions): Promise<GADMProcessedData> {
    const { filters, adminLevel } = options || {};

    try {
      let geojson: GADMGeoJSON;

      if (rawData.geojson) {
        geojson = rawData.geojson;
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
      const inputStats = summarizeGeojsonFeatures(features);

      if (filters && filters.length > 0) {
        features = await this.applyFilters(features, filters);
      }

      //  ShapeEntity
      const entities: ShapeEntityPayload[] = features.map((feature: GADMFeature, index: number) => {
        const properties = feature.properties ?? {};
        const processedAt = new Date().toISOString();

        return {
          //id: this.generateEntityId(properties, index),
          // nodeId: this.generateNodeId(properties, index),
          // name: this.extractName(properties),
          // description: this.extractDescription(properties),
          geometry: feature.geometry ?? undefined,
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
        };
      });
      const result = entities as GADMProcessedData;
      const resolvedAdminLevel = typeof adminLevel === 'number' ? adminLevel : rawData.metadata.level;
      result.metadata = {
        source: 'gadm',
        processedAt: new Date().toISOString(),
        count: entities.length,
        inputFeatureCount: inputStats.featureCount,
        inputPolygonCount: inputStats.polygonCount,
        inputVertexCount: inputStats.vertexCount,
        country: rawData.metadata.country,
        adminLevel: resolvedAdminLevel,
        version: rawData.metadata.version,
      };
      return result;

    } catch (error) {
      throw new Error(`Failed to process GADM data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

  private async decodeGeoJson(buffer: ArrayBuffer): Promise<GADMGeoJSON> {
    const rawBuffer = this.isZipBuffer(buffer) ? await this.unzipJsonBuffer(buffer) : buffer;
    const text = new TextDecoder('utf-8').decode(rawBuffer);
    return JSON.parse(text) as GADMGeoJSON;
  }

  private isZipBuffer(buffer: ArrayBuffer): boolean {
    const bytes = new Uint8Array(buffer);
    return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  }

  private async unzipJsonBuffer(buffer: ArrayBuffer): Promise<ArrayBuffer> {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const zipData = await zip.loadAsync(buffer);
    for (const [fileName, fileData] of Object.entries(zipData.files)) {
      if (fileName.endsWith('.json') && !fileData.dir) {
        const text = await fileData.async('string');
        return new TextEncoder().encode(text).buffer;
      }
    }
    throw new Error('No JSON file found in archive');
  }

  private async zipJsonBuffer(buffer: ArrayBuffer, country: string, level: number): Promise<ArrayBuffer> {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const fileName = `gadm41_${country}_${level}.json`;
    zip.file(fileName, buffer);
    return await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  }

}
