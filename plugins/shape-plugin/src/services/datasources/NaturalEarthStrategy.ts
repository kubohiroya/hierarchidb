/**
  * Natural Earth
 * https://www.naturalearthdata.com/ Shapefile
  */

import { BaseDataSourceStrategy, type DataSourceConfig, type FetchOptions, type ProcessOptions } from './DataSourceStrategy.js';
import type { ShapeEntityPayload } from '../../common/types/index.js';
import type { NodeId } from '@hierarchidb/core-types';
import type JSZip from 'jszip';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import {
  buildShapeCacheKey,
  bufferDeserializer,
  bufferSerializer,
  createShapeChunkStore,
  getOrFetchWithRetry,
  type RetryConfig,
} from '../utils/chunkStore.js';
import { summarizeGeojsonFeatures } from './geojsonStats.js';

//  Natural Earth
export interface NaturalEarthRawData {
  files: Map<string, ArrayBuffer>; //  ->
  metadata: {
    source: string;
    downloadedAt: string;
    endpoint: string;
    totalSize: number;
  };
}

//  Natural Earth
export interface NaturalEarthProcessedData extends Array<ShapeEntityPayload> {
  metadata?: {
    source: 'natural-earth';
    processedAt: string;
    count: number;
    inputFeatureCount?: number;
    inputPolygonCount?: number;
    inputVertexCount?: number;
    adminLevel?: number;
    resolution?: string;
  };
}

type NaturalEarthProperties = Record<string, unknown>;
type NaturalEarthGeoJSON = FeatureCollection<Geometry, NaturalEarthProperties>;
type NaturalEarthFeature = Feature<Geometry, NaturalEarthProperties>;

/**
  * Natural Earth
  */
export class NaturalEarthStrategy extends BaseDataSourceStrategy<NaturalEarthRawData, NaturalEarthProcessedData> {
  readonly id = 'natural-earth-shapes';
  readonly name = 'Natural Earth Vector Data';
  readonly config: DataSourceConfig = {
    id: 'natural-earth-shapes',
    name: 'Natural Earth Vector Data',
    description: 'Free vector and raster map data at 1:10m, 1:50m, and 1:110m scales',
    version: '5.1.1',
    access: {
      method: 'File',
      baseUrl: 'https://www.naturalearthdata.com/download/',
      endpoints: {
        // 1:10m (Large scale data, 1:10,000,000)
        'countries-10m': '10m/cultural/ne_10m_admin_0_countries.zip',
        'states-10m': '10m/cultural/ne_10m_admin_1_states_provinces.zip',
        'cities-10m': '10m/cultural/ne_10m_populated_places.zip',
        'coastline-10m': '10m/physical/ne_10m_coastline.zip',
        'rivers-10m': '10m/physical/ne_10m_rivers_lake_centerlines.zip',
        'lakes-10m': '10m/physical/ne_10m_lakes.zip',

        // 1:50m (Medium scale data, 1:50,000,000)
        'countries-50m': '50m/cultural/ne_50m_admin_0_countries.zip',
        'states-50m': '50m/cultural/ne_50m_admin_1_states_provinces.zip',
        'cities-50m': '50m/cultural/ne_50m_populated_places.zip',
        'coastline-50m': '50m/physical/ne_50m_coastline.zip',
        'rivers-50m': '50m/physical/ne_50m_rivers_lake_centerlines.zip',
        'lakes-50m': '50m/physical/ne_50m_lakes.zip',

        // 1:110m (Small scale data, 1:110,000,000)
        'countries-110m': '110m/cultural/ne_110m_admin_0_countries.zip',
        'states-110m': '110m/cultural/ne_110m_admin_1_states_provinces.zip',
        'cities-110m': '110m/cultural/ne_110m_populated_places.zip',
        'coastline-110m': '110m/physical/ne_110m_coastline.zip',
        'rivers-110m': '110m/physical/ne_110m_rivers_lake_centerlines.zip',
        'lakes-110m': '110m/physical/ne_110m_lakes.zip',
      },
      authentication: { type: 'none' },
      timeout: 60000, //  60
      retries: { count: 3, delay: 2000, backoff: 'exponential' },
    },
    processing: {
      inputFormat: 'shapefile',
      outputFormat: 'geojson',
      validation: [
        { field: 'geometry', rule: 'required' },
        { field: 'properties', rule: 'required' },
      ],
      transformations: [
        { type: 'coordinate-system', from: 'EPSG:4326', to: 'EPSG:4326' }, //  WGS84
        { type: 'extract', tolerance: 0.001 }],
    },
    cache: {
      ttl: 86400000 * 7, //  1
      strategy: 'disk',
    },
  };

  async fetchData(options?: FetchOptions): Promise<NaturalEarthRawData> {
    const {
      endpoint = 'countries-50m',
      adminLevel,
      bbox: _bbox,
      signal,
    } = options || {};
    const resolvedNodeId = options?.nodeId;
    if (!resolvedNodeId) {
      throw new Error('NaturalEarth fetchData requires nodeId.');
    }
    const cacheKeyMode = options?.cacheKeyMode ?? 'legacy';
    const retries = options?.retryConfig ?? { count: 1, delay: 0, backoff: 'exponential' } satisfies RetryConfig;

    const isDirectUrl = typeof endpoint === 'string' && endpoint.startsWith('http');
    const selectedEndpoint = isDirectUrl
      ? endpoint
      : this.selectEndpoint(endpoint, adminLevel);
    if (!selectedEndpoint) {
      throw new Error(`Unknown endpoint: ${selectedEndpoint}`);
    }
    const endpoints = this.config.access.endpoints;
    const endpointPath = !isDirectUrl ? endpoints?.[selectedEndpoint] : undefined;
    if (!isDirectUrl && !endpointPath) {
      throw new Error(`Unknown endpoint: ${selectedEndpoint}`);
    }

    const downloadUrl = isDirectUrl
      ? selectedEndpoint
      : `${this.config.access.baseUrl}${endpointPath}`;

    console.log(`[NaturalEarth] Downloading from: ${downloadUrl}`);

    try {
      //  ZIP
      const store = createShapeChunkStore(bufferSerializer, bufferDeserializer);
      const entry = await getOrFetchWithRetry(
        store,
        resolvedNodeId,
        downloadUrl,
        {
          accept: 'application/zip',
          cacheKey: cacheKeyMode === 'url'
            ? downloadUrl
            : buildShapeCacheKey(`naturalearth:${selectedEndpoint}`, downloadUrl),
          signal,
        },
        retries,
      );
      const zipBuffer = entry.value;

      //  ZIP
      const JSZipCtor = await ensureJsZip();
      const zip = new JSZipCtor();
      const zipData = await zip.loadAsync(zipBuffer);

      const files = new Map<string, ArrayBuffer>();

      const entries = Object.entries(zipData.files) as Array<[string, JSZip.JSZipObject]>;
      for (const [fileName, fileData] of entries) {
        if (!fileData.dir) {
          const buffer = await fileData.async('arraybuffer');
          files.set(fileName, buffer);
        }
      }

      return {
        files,
        metadata: {
          source: 'natural-earth',
          downloadedAt: new Date().toISOString(),
          endpoint: selectedEndpoint,
          totalSize: zipBuffer.byteLength,
        },
      };

    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : String(error);
      const cause = error instanceof Error && error.cause
        ? (error.cause instanceof Error ? error.cause.message : String(error.cause))
        : '';
      const suffix = cause ? ` (${cause})` : '';
      throw new Error(`Failed to download Natural Earth data: ${baseMessage}${suffix}`);
    }
  }

  async processData(rawData: NaturalEarthRawData, options?: ProcessOptions): Promise<NaturalEarthProcessedData> {
    const { filters, transformations, extract: _extract = true, tolerance: _tolerance = 0.001 } = options || {};

    try {
      //  ShapefileGeoJSON
      const geojson = await this.convertShapefilesToGeoJSON(rawData.files);

      let features: NaturalEarthFeature[] = geojson.features as NaturalEarthFeature[];
      const inputStats = summarizeGeojsonFeatures(features);
      if (filters && filters.length > 0) {
        features = await this.applyFilters(features, filters);
      }

      if (transformations && transformations.length > 0) {
        features = await this.applyTransformations(features, transformations);
      }

      //  ShapeEntity
      const entities: ShapeEntityPayload[] = features.map((feature, index) => {
        const properties = feature.properties ?? {};
        const entityId = this.generateEntityId(properties, index) as NodeId;
        const nodeId = this.generateNodeId(properties, index) as NodeId;

        return {
          id: entityId,
          nodeId,
          geometry: feature.geometry ?? undefined,
          properties: {
            ...properties,
            source: 'natural-earth',
            endpoint: rawData.metadata.endpoint,
            originalIndex: index,
            downloadedAt: rawData.metadata.downloadedAt,
            processedAt: new Date().toISOString(),
            adminLevel: this.extractAdminLevel(rawData.metadata.endpoint),
          },
        };
      });

      const result = entities as NaturalEarthProcessedData;
      result.metadata = {
        source: 'natural-earth',
        processedAt: new Date().toISOString(),
        count: entities.length,
        inputFeatureCount: inputStats.featureCount,
        inputPolygonCount: inputStats.polygonCount,
        inputVertexCount: inputStats.vertexCount,
        adminLevel: this.extractAdminLevel(rawData.metadata.endpoint),
      };

      return result;

    } catch (error) {
      throw new Error(`Failed to process Natural Earth data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private selectEndpoint(endpoint: string, adminLevel?: number): string {
    if (adminLevel !== undefined) {
      if (adminLevel === 0) {
        return 'countries-50m';
      } else if (adminLevel === 1) {
        return 'states-50m';
      }
    }

    //  test-1
    if (endpoint?.startsWith('test-')) return 'countries-50m';
    return endpoint;
  }


  private async convertShapefilesToGeoJSON(files: Map<string, ArrayBuffer>): Promise<NaturalEarthGeoJSON> {
    if (!files || files.size === 0) {
      throw new Error('No shapefile entries to convert');
    }
    const JSZipCtor = (await import('jszip')).default;
    const zip = new JSZipCtor();
    for (const [name, buf] of files.entries()) {
      zip.file(name, buf);
    }
    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    const shp = (await import('shpjs')).default;
    const geojson = (await shp.parseZip(zipBuffer)) as FeatureCollection<Geometry, NaturalEarthProperties>;
    return geojson;
  }

  private generateEntityId(properties: NaturalEarthProperties, index: number): string {
    //  ID
    const iso =
      this.getString(properties, 'ISO_A3') ||
      this.getString(properties, 'ISO_3166_1') ||
      this.getString(properties, 'adm0_a3');
    const name = this.getString(properties, 'NAME') || this.getString(properties, 'NAME_EN') || this.getString(properties, 'name');

    if (iso) return `ne-${iso.toLowerCase()}`;
    if (name) return `ne-${name.toLowerCase().replace(/\s+/g, '-')}`;

    return `ne-feature-${index}`;
  }

  private generateNodeId(properties: NaturalEarthProperties, index: number): string {
    return `node-${this.generateEntityId(properties, index)}`;
  }

  private getString(properties: NaturalEarthProperties, key: string): string | undefined {
    const value = properties[key];
    return typeof value === 'string' ? value : undefined;
  }

  private extractAdminLevel(endpoint: string): number | undefined {
    if (endpoint.includes('countries')) return 0;
    if (endpoint.includes('states')) return 1;
    if (endpoint.includes('cities')) return 2;
    return undefined;
  }
}
let jszipModule: Promise<typeof JSZip> | null = null;
function ensureJsZip(): Promise<typeof JSZip> {
  if (!jszipModule) {
    jszipModule = import('jszip').then((mod) => {
      if ('default' in mod && mod.default) {
        return mod.default;
      }
      return mod as unknown as typeof JSZip;
    });
  }
  return jszipModule;
}
