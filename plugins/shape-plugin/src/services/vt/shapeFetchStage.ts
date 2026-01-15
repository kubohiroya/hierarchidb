import type { Feature, FeatureCollection } from 'geojson';
import type { NodeId, ISO2 } from '@hierarchidb/common-types';
import { encodeFlatGeobufFromFeatureCollection } from '@hierarchidb/gis-sdk';
import type { StageHandler, TaskQueueRecord } from '@hierarchidb/common-types';
import type { ShapeBuildConfig } from '../../common/types/index.js';
import {
  type VtTaskQueueDb,
  listTasksByStage,
  putTasks,
  runStageTasks,
} from '@hierarchidb/vt-orchestrator';
import { type VtShapeDb, getFetchCache, putFetchCache } from '@hierarchidb/vt-shape-store';
import type {
  CountryMetadata,
  DataSourceName,
  FetchTaskPayload,
  SelectedArrayByCountries,
  ShapeEntity,
} from '../../common/types/index.js';
import { DEFAULT_BUILD_CONFIG } from '../../common/types/constants.js';
import { generateDownloadTaskPayloadsFromSelection } from '../utils/utils.js';
import { metadataLoader } from '../metadata/MetadataLoader.js';
import { DataSourceStrategyFactory } from '../datasources/DataSourceStrategyFactory.js';
import { resolveStrategyIdFromDataSource } from '../datasources/strategyIds.js';
import type { RetryConfig } from '../datasources/DataSourceStrategy.js';

export type ShapeFetchTaskInput = {
  url: string;
  dataSource: DataSourceName;
  sourceKey: string;
  countryCode: ISO2;
  countryName?: string;
  urlCountryCode: string;
  adminLevel: number;
};

export type ShapeFetchTaskOutput = {
  fetchCacheId?: string;
  featureCount?: number;
  vertexCount?: number;
  polygonCount?: number;
};

export type ShapeFetchStageParams = {
  nodeId: NodeId;
  dataSource: DataSourceName;
  selectedArrayByCountries?: SelectedArrayByCountries;
  downloadTaskPayloads?: FetchTaskPayload[];
  buildConfig: ShapeBuildConfig;
  taskQueue: VtTaskQueueDb;
  shapeStore: VtShapeDb;
  metadata?: CountryMetadata[];
  waitIfPaused?: () => Promise<void>;
  resumeExistingTasks?: boolean;
};

const buildRetryConfig = (config: ShapeBuildConfig): RetryConfig => {
  const downloadConfig = config.fetchConfig ?? DEFAULT_BUILD_CONFIG.fetchConfig;
  const retryAttempts = downloadConfig?.retryAttempts ?? 0;
  const retryDelay = downloadConfig?.retryDelay ?? 0;
  return {
    count: Math.max(1, retryAttempts + 1),
    delay: retryDelay,
  };
};

const buildCountryLookup = (metadata: CountryMetadata[]): Map<string, CountryMetadata> => {
  const map = new Map<string, CountryMetadata>();
  metadata.forEach((entry) => {
    const iso2 = entry.iso2?.trim().toUpperCase() ?? entry.countryCode?.trim().toUpperCase();
    const iso3 = entry.iso3?.trim().toUpperCase();
    if (iso2) map.set(iso2, entry);
    if (iso3) map.set(iso3, entry);
    if (entry.countryCode) map.set(entry.countryCode.trim().toUpperCase(), entry);
  });
  return map;
};

const buildShapeFetchTaskId = (nodeId: NodeId, sourceKey: string): string => (
  `${String(nodeId)}:fetch:${sourceKey}`
);

const buildFetchFeatureCollection = (
  entities: ShapeEntity[],
  originKey: string
): FeatureCollection => {
  const features: Feature[] = [];
  for (const entity of entities) {
    if (!entity?.geometry) continue;
    const properties = {
      ...(entity.properties ?? {}),
    } as Record<string, unknown>;
    if (!properties.__hdbOriginKey) {
      properties.__hdbOriginKey = originKey;
    }
    features.push({
      type: 'Feature',
      geometry: entity.geometry,
      properties,
    });
  }
  return { type: 'FeatureCollection', features };
};

const buildOriginKey = (dataSource: DataSourceName, sourceKey: string): string => (
  `${dataSource}:${sourceKey}`
);

const countVertices = (coords: unknown): number => {
  if (!Array.isArray(coords)) return 0;
  if (coords.length === 0) return 0;
  if (typeof coords[0] === 'number') return 1;
  return coords.reduce((sum: number, child: unknown) => sum + countVertices(child), 0);
};

const countVerticesFromGeometry = (geometry: Feature['geometry']): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum: number, child) => sum + countVerticesFromGeometry(child), 0);
  }
  return countVertices(geometry.coordinates);
};

const countPolygonsFromGeometry = (geometry: Feature['geometry']): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum: number, child) => sum + countPolygonsFromGeometry(child), 0);
  }
  if (geometry.type === 'Polygon') {
    return 1;
  }
  if (geometry.type === 'MultiPolygon') {
    return Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0;
  }
  return 0;
};

const summarizeFeatureCollection = (
  collection: FeatureCollection
): { featureCount: number; vertexCount: number; polygonCount: number } => {
  const featureCount = collection.features.length;
  let vertexCount = 0;
  let polygonCount = 0;
  for (const feature of collection.features) {
    vertexCount += countVerticesFromGeometry(feature.geometry);
    polygonCount += countPolygonsFromGeometry(feature.geometry);
  }
  return { featureCount, vertexCount, polygonCount };
};

const buildFetchTasks = (
  nodeId: NodeId,
  payloads: FetchTaskPayload[],
  metadata: CountryMetadata[],
): Array<TaskQueueRecord<ShapeFetchTaskInput, ShapeFetchTaskOutput>> => {
  const lookup = buildCountryLookup(metadata);
  return payloads.map((payload, index) => {
    const countryCode = payload.countryCode.trim().toUpperCase();
    const countryMeta = lookup.get(countryCode);
    if (!countryMeta) {
      throw new Error(`[shape-fetch] Missing metadata for ${payload.countryCode}`);
    }
    const iso2 = (countryMeta.countryCode ?? countryMeta.iso2 ?? '').trim().toUpperCase() as ISO2;
    if (!iso2) {
      throw new Error(`[shape-fetch] Missing ISO2 for ${payload.countryCode}`);
    }
    const sourceKey = `${iso2}:${payload.adminLevel}`;
    return {
      taskId: buildShapeFetchTaskId(nodeId, sourceKey),
      nodeId,
      stage: 'fetch',
      status: 'queued',
      index,
      progress: 0,
      inputData: {
        url: payload.url,
        dataSource: payload.dataSource,
        sourceKey,
        countryCode: iso2,
        countryName: countryMeta.countryName,
        urlCountryCode: payload.countryCode.trim().toUpperCase(),
        adminLevel: payload.adminLevel,
      },
    };
  });
};

const createFetchHandler = (params: {
  nodeId: NodeId;
  buildConfig: ShapeBuildConfig;
  shapeStore: VtShapeDb;
  dataSource: DataSourceName;
}): StageHandler<ShapeFetchTaskInput, ShapeFetchTaskOutput> => {
  const factory = new DataSourceStrategyFactory();
  const strategyId = resolveStrategyIdFromDataSource(params.dataSource);
  if (!strategyId) {
    throw new Error(`[shape-fetch] Unsupported data source: ${params.dataSource}`);
  }
  const strategy = factory.create(strategyId);
  const retryConfig = buildRetryConfig(params.buildConfig);

  return async (task) => {
    const input = task.inputData;
    if (!input) {
      return { status: 'failed', errorMessage: 'fetch task input is missing' };
    }

    const existing = await getFetchCache(params.shapeStore, params.nodeId, input.sourceKey);
    if (existing) {
      return {
        status: 'completed',
        message: 'reused: fetch cache exists',
        outputData: {
          fetchCacheId: existing.id,
          featureCount: existing.featureCount,
          vertexCount: existing.vertexCount,
        },
      };
    }

    const raw = await strategy.fetchData({
      nodeId: params.nodeId,
      country: input.urlCountryCode,
      adminLevel: input.adminLevel,
      cacheKeyMode: 'url',
      retryConfig,
    });

    const processed = await strategy.processData(raw, {
      filters: strategy.config.processing.filters,
      transformations: strategy.config.processing.transformations,
      validation: true,
    });

    const originKey = buildOriginKey(input.dataSource, input.sourceKey);
    const collection = buildFetchFeatureCollection(processed, originKey);
    if (collection.features.length === 0) {
      return {
        status: 'completed',
        message: 'skipped: no features',
      };
    }

    const { featureCount, vertexCount, polygonCount } = summarizeFeatureCollection(collection);
    const data = await encodeFlatGeobufFromFeatureCollection(collection);
    const buffer = await putFetchCache(params.shapeStore, params.nodeId, {
      sourceKey: input.sourceKey,
      countryCode: input.countryCode,
      adminLevel: input.adminLevel,
      data,
      featureCount,
      vertexCount,
      polygonCount,
    });

    return {
      status: 'completed',
      message: `completed: features=${featureCount}`,
      outputData: {
        fetchCacheId: buffer.id,
        featureCount,
        vertexCount,
        polygonCount,
      },
    };
  };
};

export const runShapeFetchStage = async (params: ShapeFetchStageParams): Promise<void> => {
  const metadata = params.metadata ?? await metadataLoader.loadMetadata(params.dataSource, params.nodeId);
  const existingTasks = params.resumeExistingTasks
    ? await listTasksByStage(params.taskQueue, params.nodeId, 'fetch')
    : [];
  const shouldGenerateTasks = existingTasks.length === 0;
  const payloads = shouldGenerateTasks
    ? ((params.downloadTaskPayloads && params.downloadTaskPayloads.length > 0)
      ? params.downloadTaskPayloads
      : generateDownloadTaskPayloadsFromSelection(
        params.dataSource,
        params.selectedArrayByCountries,
        metadata,
      ))
    : [];
  if (payloads.length === 0 && shouldGenerateTasks) return;

  if (shouldGenerateTasks) {
    const tasks = buildFetchTasks(params.nodeId, payloads, metadata);
    await putTasks(params.taskQueue, tasks);
  }
  await runStageTasks({
    nodeId: params.nodeId,
    stage: 'fetch',
    handler: createFetchHandler({
      nodeId: params.nodeId,
      buildConfig: params.buildConfig,
      shapeStore: params.shapeStore,
      dataSource: params.dataSource,
    }),
    waitIfPaused: params.waitIfPaused,
  });
};
