/**
  * GeoBoundaries
 * https://www.geoboundaries.org/
  */

import { BaseDataSourceStrategy, type DataSourceConfig, type FetchOptions, type ProcessOptions } from './DataSourceStrategy.js';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { ShapeEntity } from '../../common/types/index.js';
import type { NodeId } from '@hierarchidb/common-types';
import { configurePluginDownloadDefaults, downloadArrayBuffer, downloadJson, getCorsProxyBaseURL } from '@hierarchidb/download';

const ensureShapeDownloadDefaults = (): void => {
  const corsProxyBaseURL = getCorsProxyBaseURL() || undefined;
  configurePluginDownloadDefaults('shape', {
    dbPrefix: 'shape',
    corsProxyBaseURL,
  });
};

type GeoBoundariesProperties = Record<string, unknown>;
type GeoBoundariesGeoJSON = FeatureCollection<Geometry, GeoBoundariesProperties>;
type GeoBoundariesFeature = Feature<Geometry, GeoBoundariesProperties>;

export interface GeoBoundariesApiResponse {
  gjDownloadURL?: string;
  simplifiedGeometryGeoJSON?: string;
  boundaryYear?: number;
  licenseDetail?: string;
  releaseType?: 'gbOpen';
  [key: string]: unknown;
}

export interface GeoBoundariesRawData {
  geojson?: GeoBoundariesGeoJSON;
  shapefile?: Map<string, ArrayBuffer>;
  metadata: {
    source: 'geoboundaries';
    downloadedAt: string;
    country: string;
    adminLevel: string;
    releaseType: 'gbOpen';
    version: number;
    format: 'geojson' | 'shapefile' | 'kml' | 'topojson';
    apiResponse?: GeoBoundariesApiResponse;
  };
}

//  GeoBoundaries
export type GeoBoundariesProcessedData = Array<ShapeEntity> & {
  metadata?: {
    source: 'geoboundaries';
    processedAt: string;
    count: number;
    country?: string;
    adminLevel?: string;
    releaseType?: string;
    version: number;
    license?: string;
  };
}

/**
  * GeoBoundaries
  */
export class GeoBoundariesStrategy extends BaseDataSourceStrategy<GeoBoundariesRawData, GeoBoundariesProcessedData> {
  readonly id = 'geoboundaries-admin-areas';
  readonly name = 'GeoBoundaries Administrative Areas';
  readonly config: DataSourceConfig = {
    id: 'geoboundaries-admin-areas',
    name: 'GeoBoundaries Global Administrative Areas',
    description: 'Open, free, and research-ready administrative boundaries',
    version: '5.0.0',
    access: {
      method: 'REST',
      baseUrl: 'https://www.geoboundaries.org/api/current/',
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
      transformations: [
        { type: 'coordinate-system', from: 'EPSG:4326', to: 'EPSG:4326' },
      ],
    },
    cache: {
      ttl: 86400000 * 7, //  1
      strategy: 'disk',
    },
  };

  private readonly adminLevels: Record<string, string> = {
    'country': 'ADM0',
    'state': 'ADM1',
    'county': 'ADM2',
    'municipality': 'ADM3',
    'ward': 'ADM4',
    'neighborhood': 'ADM5',
    '0': 'ADM0',
    '1': 'ADM1',
    '2': 'ADM2',
    '3': 'ADM3',
    '4': 'ADM4',
    '5': 'ADM5',
  };

  private readonly releaseType: 'gbOpen' = 'gbOpen';

  async fetchData(options?: FetchOptions): Promise<GeoBoundariesRawData> {
    const {
      country = 'USA',
      adminLevel = '1',
      signal,
    } = options || {};

    //  admin
    const normalizedCountry = this.normalizeCountryCode(country);
    const normalizedAdminLevel = this.normalizeAdminLevel(adminLevel.toString());

    try {
      //  APIURL
      const apiData = await this.fetchBoundaryMetadata(normalizedCountry, normalizedAdminLevel, signal);

      if (!apiData || !apiData.simplifiedGeometryGeoJSON) {
        throw new Error(`No boundary data available for ${normalizedCountry} ${normalizedAdminLevel}`);
      }

      console.log(`[GeoBoundaries] Downloading ${this.releaseType} data for ${normalizedCountry} ${normalizedAdminLevel}`);
      console.log(`[GeoBoundaries] URL: ${apiData.simplifiedGeometryGeoJSON}`);

      //  GeoJSON
      const retries = this.config.access.retries ?? { count: 1, delay: 0, backoff: 'exponential' };
      ensureShapeDownloadDefaults();
      const buffer = await downloadArrayBuffer(
        'shape',
        apiData.simplifiedGeometryGeoJSON,
        `geoboundaries:${normalizedCountry}:${normalizedAdminLevel}`,
        { retries: retries.count, delayMs: retries.delay, backoff: retries.backoff },
        signal,
      );
      console.log(`[GeoBoundaries] Download succeeded: ${apiData.simplifiedGeometryGeoJSON}`);
      const geojson = JSON.parse(new TextDecoder('utf-8').decode(buffer)) as GeoBoundariesGeoJSON;

      return {
        geojson,
        metadata: {
          source: 'geoboundaries',
          downloadedAt: new Date().toISOString(),
          country: normalizedCountry,
          adminLevel: normalizedAdminLevel,
          releaseType: this.releaseType,
          version: typeof apiData.boundaryYear === 'number' ? apiData.boundaryYear : 2023,
          format: 'geojson',
          apiResponse: apiData,
        },
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`[GeoBoundaries] Download failed: ${normalizedCountry} ${normalizedAdminLevel}`, message);
      throw new Error(`Failed to fetch GeoBoundaries data for ${normalizedCountry} ${normalizedAdminLevel}: ${message}`);
    }
  }

  async processData(rawData: GeoBoundariesRawData, options?: ProcessOptions): Promise<GeoBoundariesProcessedData> {
    const { filters, transformations } = options || {};

    try {
      if (!rawData.geojson || !rawData.geojson.features) {
        throw new Error('Invalid GeoJSON data');
      }

      let features: GeoBoundariesFeature[] = rawData.geojson.features.filter(
        (feature): feature is GeoBoundariesFeature => Boolean(feature),
      );

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
      const entities: ShapeEntity[] = features.map((feature: GeoBoundariesFeature, index: number) => {
        const properties = feature.properties ?? {};
        const processedAt = new Date().toISOString();

        return {
          id: this.generateEntityId(properties, index),
          nodeId: this.generateNodeId(properties, index),
          geometry: feature.geometry,
          properties: {
            ...properties,
            source: 'geoboundaries',
            country: rawData.metadata?.country,
            adminLevel: rawData.metadata?.adminLevel,
            releaseType: rawData.metadata?.releaseType,
            boundaryYear: rawData.metadata?.version,
            geoboundariesVersion: rawData.metadata?.version,
            downloadedAt: rawData.metadata?.downloadedAt,
            processedAt,
            originalIndex: index,
            license: rawData.metadata?.apiResponse?.licenseDetail || 'Open Data',
          },
        };
      });

      const version = rawData.metadata ? rawData.metadata.version + 1 : 1;
      const result = entities as GeoBoundariesProcessedData;
      result.metadata = {
        source: 'geoboundaries',
        processedAt: new Date().toISOString(),
        count: entities.length,
        country: rawData.metadata?.country,
        adminLevel: rawData.metadata?.adminLevel,
        releaseType: rawData.metadata?.releaseType,
        version,
        license: rawData.metadata?.apiResponse?.licenseDetail || 'Open Data',
      };

      return result;

    } catch (error) {
      throw new Error(`Failed to process GeoBoundaries data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async fetchBoundaryMetadata(
    country: string,
    adminLevel: string,
    signal?: AbortSignal,
  ): Promise<GeoBoundariesApiResponse> {
    const url = `${this.config.access.baseUrl}${this.releaseType}/${country}/${adminLevel}/`;
    console.log(`[GeoBoundaries] Fetching metadata: ${url}`);

    try {
      ensureShapeDownloadDefaults();
      const data = await downloadJson<GeoBoundariesApiResponse>(
        'shape',
        url,
        `geoboundaries:metadata:${country}:${adminLevel}`,
        undefined,
        signal,
      );
      data.releaseType = this.releaseType;
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/HTTP 404/.test(message)) {
        throw new Error(`No boundary data found for ${country} ${adminLevel} in ${this.releaseType}`);
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
      'US': 'USA',
      'UNITED KINGDOM': 'GBR',
      'UK': 'GBR',
      'GREAT BRITAIN': 'GBR',
      'JAPAN': 'JPN',
      'JP': 'JPN',
      'GERMANY': 'DEU',
      'DE': 'DEU',
      'FRANCE': 'FRA',
      'FR': 'FRA',
      'ITALY': 'ITA',
      'IT': 'ITA',
      'SPAIN': 'ESP',
      'ES': 'ESP',
      'CANADA': 'CAN',
      'CA': 'CAN',
      'AUSTRALIA': 'AUS',
      'AU': 'AUS',
      'BRAZIL': 'BRA',
      'BR': 'BRA',
      'CHINA': 'CHN',
      'CN': 'CHN',
      'INDIA': 'IND',
      'IN': 'IND',
      'RUSSIA': 'RUS',
      'RU': 'RUS',
    };

    return countryMappings[upperCountry] || upperCountry.substring(0, 3);
  }

  private normalizeAdminLevel(adminLevel: string): string {
    const normalized = this.adminLevels[adminLevel.toLowerCase()];
    return normalized || `ADM${Math.min(Math.max(parseInt(adminLevel) || 0, 0), 5)}`;
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

  async getAvailableCountries(): Promise<string[]> {
    try {
      ensureShapeDownloadDefaults();
      const data = await downloadJson<Record<string, unknown>>(
        'shape',
        `${this.config.access.baseUrl}available/`,
        'geoboundaries:available',
      );
      return Object.keys(data);
    } catch (error) {
      console.warn('Failed to fetch available countries:', error);
    }
    return [];
  }

  async getAvailableAdminLevels(country: string): Promise<string[]> {
    try {
      const normalizedCountry = this.normalizeCountryCode(country);
      ensureShapeDownloadDefaults();
      const data = await downloadJson<Record<string, string[]>>(
        'shape',
        `${this.config.access.baseUrl}available/`,
        'geoboundaries:available',
      );
      return data[normalizedCountry] || [];
    } catch (error) {
      console.warn(`Failed to fetch available admin levels for ${country}:`, error);
    }
    return [];
  }
}
