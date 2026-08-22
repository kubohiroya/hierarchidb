/**
 * GeoBoundaries
 * https://www.geoboundaries.org/
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { ShapeFeaturePayload } from '~/common/types/index';
import { decodeFlatGeoJson, encodeFlatGeoJson } from '~/services/build/strategies/flatgeobufUtils';
import {
  buildRawDataDataSourceCacheKey,
  buildShapeCacheKey,
  createShapeChunkStore,
  getOrFetchWithRetry,
  jsonDeserializer,
  jsonSerializer,
  type RetryConfig,
} from '~/services/utils/chunkStore';
import {
  buildGeoBoundariesMetadataUrl,
  GEOBOUNDARIES_API_BASE_URL,
  GEOBOUNDARIES_RELEASE_TYPE,
} from '~/services/utils/geoboundariesEndpoints';
import {
  bufferToStream,
  fetchRawDataWithPipeline,
  streamToBuffer,
} from '~/services/utils/RawDataPipelineResult';
import {
  BaseDataSourceStrategy,
  type DataSourceConfig,
  type FetchOptions,
  type ProcessOptions,
  type RawDataPipeline,
  type RawDataPipelineContext,
} from './DataSourceStrategy.js';
import { assertGeoBoundariesGeoJsonSourcePayload } from './providerGeoJsonSourcePayloadValidators.js';
import { summarizeGeojsonFeatures } from './summarizeGeojsonFeatures.js';

type GeoBoundariesProperties = Record<string, unknown>;
type GeoBoundariesGeoJSON = FeatureCollection<Geometry, GeoBoundariesProperties>;
type GeoBoundariesFeature = Feature<Geometry, GeoBoundariesProperties>;

export interface GeoBoundariesApiResponse {
  gjDownloadURL?: string;
  tjDownloadURL?: string;
  simplifiedGeometryGeoJSON?: string;
  Continent?: string;
  boundaryYear?: number;
  licenseDetail?: string;
  releaseType?: 'gbOpen';
  [key: string]: unknown;
}

export interface GeoBoundariesRawData {
  geojson?: GeoBoundariesGeoJSON;
  metadata: {
    source: 'geoboundaries';
    downloadedAt: string;
    country: string;
    adminLevel: string;
    releaseType: 'gbOpen';
    version: number;
    format: 'geojson';
    apiResponse?: GeoBoundariesApiResponse;
    continent?: string;
    rawSourceCacheKey?: string;
  };
}

//  GeoBoundaries
export type GeoBoundariesProcessedData = Array<ShapeFeaturePayload> & {
  metadata?: {
    source: 'geoboundaries';
    processedAt: string;
    count: number;
    inputFeatureCount?: number;
    inputPolygonCount?: number;
    inputVertexCount?: number;
    country?: string;
    adminLevel?: string;
    continent?: string;
    releaseType?: string;
    version: number;
    license?: string;
  };
};

/**
 * GeoBoundaries
 */
export class GeoBoundariesStrategy extends BaseDataSourceStrategy<
  GeoBoundariesRawData,
  GeoBoundariesProcessedData
> {
  readonly id = 'geoboundaries-admin-areas';
  readonly name = 'GeoBoundaries Administrative Areas';
  readonly config: DataSourceConfig = {
    id: 'geoboundaries-admin-areas',
    name: 'GeoBoundaries Global Administrative Areas',
    description: 'Open, free, and research-ready administrative boundaries',
    version: '5.0.0',
    access: {
      method: 'REST',
      baseUrl: `${GEOBOUNDARIES_API_BASE_URL}/`,
      authentication: { type: 'none' },
      timeout: 60000, //  60
      retries: { count: 3, delay: 2000, backoff: 'exponential' },
    },
    processing: {
      inputFormat: 'geojson',
      outputFormat: 'geojson',
      validation: [
        { field: 'geometry', rule: 'required' },
        { field: 'properties', rule: 'required' },
        { field: 'properties.shapeName', rule: 'required' },
      ],
      transformations: [{ type: 'coordinate-system', from: 'EPSG:4326', to: 'EPSG:4326' }],
    },
    cache: {
      ttl: 86400000 * 7, //  1
      strategy: 'disk',
    },
  };

  private readonly adminLevels: Record<string, string> = {
    country: 'ADM0',
    state: 'ADM1',
    county: 'ADM2',
    municipality: 'ADM3',
    ward: 'ADM4',
    neighborhood: 'ADM5',
    '0': 'ADM0',
    '1': 'ADM1',
    '2': 'ADM2',
    '3': 'ADM3',
    '4': 'ADM4',
    '5': 'ADM5',
  };

  private readonly releaseType: 'gbOpen' = GEOBOUNDARIES_RELEASE_TYPE;

  async fetchData(options?: FetchOptions): Promise<GeoBoundariesRawData> {
    const { country = 'USA', adminLevel = '1', signal } = options || {};
    const resolvedNodeId = options?.nodeId;
    if (!resolvedNodeId) {
      throw new Error('GeoBoundaries fetchData requires nodeId.');
    }

    //  admin
    const normalizedCountry = this.normalizeCountryCode(country);
    const normalizedAdminLevel = this.normalizeAdminLevel(adminLevel.toString());
    const cacheKeyMode = options?.cacheKeyMode ?? 'legacy';
    const retries =
      options?.retryConfig ??
      ({ count: 1, delay: 0, backoff: 'exponential' } satisfies RetryConfig);
    try {
      //  APIURL
      const apiData = await this.fetchBoundaryMetadata(
        resolvedNodeId,
        normalizedCountry,
        normalizedAdminLevel,
        signal,
        cacheKeyMode,
        retries,
        options?.onRetryAttempt
      );

      if (!apiData || !apiData.simplifiedGeometryGeoJSON) {
        throw new Error(
          `No boundary data available for ${normalizedCountry} ${normalizedAdminLevel}`
        );
      }
      const downloadUrl = apiData.simplifiedGeometryGeoJSON;
      const continent = this.resolveContinent(apiData);

      console.log(
        `[GeoBoundaries] Downloading ${this.releaseType} data for ${normalizedCountry} ${normalizedAdminLevel}`
      );
      console.log(`[GeoBoundaries] URL: ${downloadUrl}`);

      const pipeline = this.createRawDataPipeline({
        nodeId: resolvedNodeId,
        fetchOptions: options ?? {},
        metadata: {
          apiData,
          normalizedCountry,
          normalizedAdminLevel,
          continent,
          downloadUrl,
          cacheKeyMode,
        },
      });

      const { decoded, cacheKey } = await fetchRawDataWithPipeline({
        nodeId: resolvedNodeId,
        fetchOptions: options ?? {},
        pipeline,
        retryConfig: retries,
        onRetryAttempt: options?.onRetryAttempt,
        onDownloadProgress: options?.onDownloadProgress,
      });
      console.log(`[GeoBoundaries] Download succeeded: ${downloadUrl}`);
      return {
        ...decoded,
        metadata: {
          ...decoded.metadata,
          rawSourceCacheKey: cacheKey,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn(
        `[GeoBoundaries] Download failed: ${normalizedCountry} ${normalizedAdminLevel}`,
        message
      );
      throw new Error(
        `Failed to fetch GeoBoundaries data for ${normalizedCountry} ${normalizedAdminLevel}: ${message}`
      );
    }
  }

  createRawDataPipeline(context: RawDataPipelineContext): RawDataPipeline<GeoBoundariesRawData> {
    const metadata = context.metadata as {
      apiData: GeoBoundariesApiResponse;
      normalizedCountry: string;
      normalizedAdminLevel: string;
      continent: string | null;
      downloadUrl: string;
      cacheKeyMode: 'url' | 'legacy';
    };
    const contentType = 'application/flatgeobuf';
    return {
      prepareRequest: () => {
        const cacheKey =
          metadata.cacheKeyMode === 'url'
            ? metadata.downloadUrl
            : buildRawDataDataSourceCacheKey({
                dataSource: 'geoboundaries',
                countryCode: metadata.normalizedCountry,
                adminLevel: Number(metadata.normalizedAdminLevel),
                url: metadata.downloadUrl,
              });
        return {
          url: metadata.downloadUrl,
          cacheKey,
          accept: 'application/json',
        };
      },
      transformStream: async (stream) => {
        const buffer = await streamToBuffer(stream);
        const geojson = assertGeoBoundariesGeoJsonSourcePayload(
          JSON.parse(new TextDecoder('utf-8').decode(buffer))
        );
        const encoded = await encodeFlatGeoJson(geojson);
        return { stream: bufferToStream(encoded), contentType };
      },
      decodeBuffer: async (buffer) => {
        const raw = await decodeFlatGeoJson(buffer);
        const geojson: GeoBoundariesGeoJSON = {
          type: 'FeatureCollection',
          features: raw.features.map((feature) => ({
            ...feature,
          })) as GeoBoundariesFeature[],
        };
        const validatedGeojson = assertGeoBoundariesGeoJsonSourcePayload(geojson);
        return {
          geojson: validatedGeojson,
          metadata: {
            source: 'geoboundaries',
            downloadedAt: new Date().toISOString(),
            country: metadata.normalizedCountry,
            adminLevel: metadata.normalizedAdminLevel,
            releaseType: this.releaseType,
            version:
              typeof metadata.apiData.boundaryYear === 'number'
                ? metadata.apiData.boundaryYear
                : 2023,
            format: 'geojson',
            apiResponse: metadata.apiData,
            continent: metadata.continent ?? undefined,
          },
        };
      },
    };
  }

  async processData(
    rawData: GeoBoundariesRawData,
    options?: ProcessOptions
  ): Promise<GeoBoundariesProcessedData> {
    const { filters, transformations } = options || {};

    try {
      if (!rawData.geojson || !rawData.geojson.features) {
        throw new Error('Invalid GeoJSON data');
      }
      const geojson = assertGeoBoundariesGeoJsonSourcePayload(rawData.geojson);

      let features: GeoBoundariesFeature[] = geojson.features.filter(
        (feature): feature is GeoBoundariesFeature => Boolean(feature)
      );
      const inputStats = summarizeGeojsonFeatures(features);

      if (filters && filters.length > 0) {
        features = await this.applyFilters(features, filters);
      }

      if (transformations && transformations.length > 0) {
        features = await this.applyTransformations(features, transformations);
      }

      if (features.length === 0) {
        const source = rawData.metadata?.country ?? 'unknown';
        const adminLevel = rawData.metadata?.adminLevel ?? 'unknown';
        throw new Error(`GeoBoundaries features empty after filtering: ${source} ${adminLevel}`);
      }

      //  ShapeEntity
      const entities: ShapeFeaturePayload[] = features.map(
        (feature: GeoBoundariesFeature, index: number) => {
          const properties = feature.properties ?? {};
          const processedAt = new Date().toISOString();

          return {
            id: this.generateEntityId(properties, index),
            nodeId: this.generateNodeId(properties, index),
            geometry: feature.geometry ?? undefined,
            properties: {
              ...properties,
              source: 'geoboundaries',
              country: rawData.metadata?.country,
              adminLevel: rawData.metadata?.adminLevel,
              continent: rawData.metadata?.continent,
              releaseType: rawData.metadata?.releaseType,
              boundaryYear: rawData.metadata?.version,
              geoboundariesVersion: rawData.metadata?.version,
              downloadedAt: rawData.metadata?.downloadedAt,
              processedAt,
              originalIndex: index,
              license: rawData.metadata?.apiResponse?.licenseDetail || 'Open Data',
            },
          };
        }
      );

      const version = rawData.metadata ? rawData.metadata.version + 1 : 1;
      const result = entities as GeoBoundariesProcessedData;
      result.metadata = {
        source: 'geoboundaries',
        processedAt: new Date().toISOString(),
        count: entities.length,
        inputFeatureCount: inputStats.featureCount,
        inputPolygonCount: inputStats.polygonCount,
        inputVertexCount: inputStats.vertexCount,
        country: rawData.metadata?.country,
        adminLevel: rawData.metadata?.adminLevel,
        continent: rawData.metadata?.continent,
        releaseType: rawData.metadata?.releaseType,
        version,
        license: rawData.metadata?.apiResponse?.licenseDetail || 'Open Data',
      };

      return result;
    } catch (error) {
      throw new Error(
        `Failed to process GeoBoundaries data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async fetchBoundaryMetadata(
    nodeId: NodeId,
    country: string,
    adminLevel: string,
    signal?: AbortSignal,
    cacheKeyMode: 'url' | 'legacy' = 'legacy',
    retryConfig?: RetryConfig,
    onRetryAttempt?: (attempt: number, error: unknown) => void | Promise<void>
  ): Promise<GeoBoundariesApiResponse> {
    const url = buildGeoBoundariesMetadataUrl(country, adminLevel);
    console.log(`[GeoBoundaries] Fetching metadata: ${url}`);

    try {
      const store = createShapeChunkStore(jsonSerializer, jsonDeserializer);
      const entry = retryConfig
        ? await getOrFetchWithRetry(
            store,
            nodeId,
            url,
            {
              accept: 'application/json',
              cacheKey:
                cacheKeyMode === 'url'
                  ? url
                  : buildShapeCacheKey(`geoboundaries:metadata:${country}:${adminLevel}`, url),
              signal,
            },
            retryConfig,
            onRetryAttempt
          )
        : await store.getOrFetchForNode(nodeId, url, {
            accept: 'application/json',
            cacheKey:
              cacheKeyMode === 'url'
                ? url
                : buildShapeCacheKey(`geoboundaries:metadata:${country}:${adminLevel}`, url),
            signal,
          });
      const data = entry.value as GeoBoundariesApiResponse;
      data.releaseType = this.releaseType;
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/HTTP 404/.test(message)) {
        throw new Error(
          `No boundary data found for ${country} ${adminLevel} in ${this.releaseType}`
        );
      }
      throw new Error(`API error: ${message}`);
    }
  }

  private normalizeCountryCode(country: string): string {
    //  ISO 3166-1 alpha-3
    const upperCountry = country.toUpperCase();

    //  ISO 3166-1 alpha-3
    if (upperCountry.length === 3) {
      return upperCountry;
    }

    //  /
    const countryMappings: Record<string, string> = {
      'UNITED STATES': 'USA',
      US: 'USA',
      'UNITED KINGDOM': 'GBR',
      UK: 'GBR',
      'GREAT BRITAIN': 'GBR',
      JAPAN: 'JPN',
      JP: 'JPN',
      GERMANY: 'DEU',
      DE: 'DEU',
      FRANCE: 'FRA',
      FR: 'FRA',
      ITALY: 'ITA',
      IT: 'ITA',
      SPAIN: 'ESP',
      ES: 'ESP',
      CANADA: 'CAN',
      CA: 'CAN',
      AUSTRALIA: 'AUS',
      AU: 'AUS',
      BRAZIL: 'BRA',
      BR: 'BRA',
      CHINA: 'CHN',
      CN: 'CHN',
      INDIA: 'IND',
      IN: 'IND',
      RUSSIA: 'RUS',
      RU: 'RUS',
    };

    return countryMappings[upperCountry] || upperCountry.substring(0, 3);
  }

  private normalizeAdminLevel(adminLevel: string): string {
    const normalized = this.adminLevels[adminLevel.toLowerCase()];
    return normalized || `ADM${Math.min(Math.max(parseInt(adminLevel) || 0, 0), 5)}`;
  }

  private resolveContinent(apiData?: GeoBoundariesApiResponse): string | undefined {
    if (!apiData) return undefined;
    const value = apiData.Continent;
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    return undefined;
  }

  private generateEntityId(properties: GeoBoundariesProperties, index: number): string {
    //  GeoBoundariesID
    const shapeID = this.getString(properties, 'shapeID');
    const shapeGroup = this.getString(properties, 'shapeGroup');
    const shapeName = this.getString(properties, 'shapeName');

    if (shapeID) {
      return `gb-${shapeID}`;
    } else if (shapeGroup && shapeName) {
      return `gb-${shapeGroup}-${shapeName.toLowerCase().replace(/\s+/g, '-')}`;
    } else if (shapeName) {
      return `gb-${shapeName.toLowerCase().replace(/\s+/g, '-')}`;
    }

    return `gb-feature-${index}`;
  }

  private generateNodeId(properties: GeoBoundariesProperties, index: number): NodeId {
    return `node-${this.generateEntityId(properties, index)}` as NodeId;
  }

  private getString(properties: GeoBoundariesProperties, key: string): string | undefined {
    const value = properties[key];
    return typeof value === 'string' ? value : undefined;
  }

  // Availability is derived from the ALL/ALL metadata payload.
}
