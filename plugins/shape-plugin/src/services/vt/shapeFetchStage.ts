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
import { ephemeralShapeDB } from '@hierarchidb/shape-store';
import type { ShapeFeatureMetadata } from '@hierarchidb/plugin-service-api';
import {
  pickAdminCode,
  pickAdminLevel,
  pickAdminName,
  pickCountryCode,
  pickCountryName,
} from '@hierarchidb/gis-sdk';
import { geojson as geojsonApi } from 'flatgeobuf';
import type {
  CountryMetadata,
  DataSourceName,
  FetchTaskPayload,
  SelectedArrayByCountries,
  ShapeEntity,
} from '../../common/types/index.js';
import { generateDownloadTaskPayloadsFromSelection } from '../utils/utils.js';
import { metadataLoader } from '../metadata/MetadataLoader.js';
import { DataSourceStrategyFactory } from '../datasources/DataSourceStrategyFactory.js';
import { resolveStrategyIdFromDataSource } from '../datasources/strategyIds.js';
import type { RetryConfig } from '../datasources/DataSourceStrategy.js';
import * as turf from '@turf/turf';
import { shapeMutationAPIImpl } from '../batch/ShapeBuildAPIClient.ts';
import { buildFeatureId, extractGeometryStats } from './featureMetadataUtils.ts';
import { filterFetchCollectionByZoom } from './fetchGeometryFilters.ts';
import { buildZoomBandRanges } from '../../common/config/zoomBands.ts';

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

const turfBbox = (turf as { bbox?: (input: unknown) => number[] }).bbox;

export type ShapeFetchStageParams = {
  nodeId: NodeId;
  dataSource: DataSourceName;
  selectedArrayByCountries?: SelectedArrayByCountries;
  downloadTaskPayloads?: FetchTaskPayload[];
  buildConfig: ShapeBuildConfig;
  taskQueue: VtTaskQueueDb;
  metadata?: CountryMetadata[];
  waitIfPaused?: () => Promise<void>;
  resumeExistingTasks?: boolean;
  abortController?: AbortController;
  failureHandling?: 'continue' | 'stop' | 'skip';
};

const buildRetryConfig = (config: ShapeBuildConfig): RetryConfig => {
  const downloadConfig = config.fetchConfig;
  const retryAttempts = downloadConfig.retryAttempts;
  const retryDelay = downloadConfig.retryDelay;
  const retryLimit = downloadConfig.retryLimit;
  const maxRetries = Math.max(0, Math.min(retryLimit, retryAttempts));
  return {
    count: Math.max(1, maxRetries + 1),
    delay: retryDelay,
    backoff: downloadConfig.retryBackoff,
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

const buildFetchCacheId = (nodeId: NodeId, sourceKey: string): string => (
  `${String(nodeId)}-shape-${sourceKey}`
);

const formatReduction = (label: string, output: number, input?: number): string => {
  if (input === undefined || !Number.isFinite(input) || input <= 0) {
    return `${label}=${output}`;
  }
  const reducedRatio = Math.max(0, Math.min(1, (input - output) / input));
  const reducedPercent = (reducedRatio * 100).toFixed(1);
  return `${label}=${output}/${input} (reduced=${reducedPercent}%)`;
};

const normalizeFeatureCollection = async (decoded: unknown): Promise<FeatureCollection | null> => {
  if (!decoded || typeof decoded !== 'object') return null;
  const collection = decoded as FeatureCollection;
  if (collection.type === 'FeatureCollection') {
    const features = Array.isArray(collection.features) ? collection.features : [];
    return { ...collection, features };
  }
  if (typeof (decoded as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    const features: Feature[] = [];
    for await (const feature of decoded as AsyncIterable<Feature>) {
      features.push(feature);
    }
    return { type: 'FeatureCollection', features };
  }
  return null;
};

const readNumericProperty = (properties: Record<string, unknown>, key: string): number | undefined => {
  const value = properties[key];
  if (typeof value !== 'number') return undefined;
  return Number.isFinite(value) ? value : undefined;
};

const decodeFetchCacheData = async (buffer: ArrayBuffer): Promise<FeatureCollection | null> => {
  try {
    const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
    return await normalizeFeatureCollection(decoded as unknown);
  } catch {
    return null;
  }
};

const getFetchCache = async (nodeId: NodeId, sourceKey: string) => (
  await ephemeralShapeDB.fetchCache
    .where('[nodeId+sourceKey]')
    .equals([nodeId, sourceKey])
    .first()
);

const putFetchCache = async (params: {
  nodeId: NodeId;
  sourceKey: string;
  countryCode: ISO2;
  adminLevel: number;
  data: ArrayBuffer;
  featureCount: number;
  inputFeatureCount?: number;
  bbox: [number, number, number, number];
  downloadTime: number;
  vertexCount: number;
  polygonCount: number;
  inputVertexCount?: number;
  inputPolygonCount?: number;
}): Promise<string> => {
  const recordId = buildFetchCacheId(params.nodeId, params.sourceKey);
  await ephemeralShapeDB.fetchCache.put({
    id: recordId,
    nodeId: params.nodeId,
    domainType: 'shape',
    sourceKey: params.sourceKey,
    countryCode: params.countryCode,
    adminLevel: params.adminLevel,
    data: params.data,
    featureCount: params.featureCount,
    inputFeatureCount: params.inputFeatureCount,
    bbox: params.bbox,
    downloadTime: params.downloadTime,
    size: params.data.byteLength,
    vertexCount: params.vertexCount,
    polygonCount: params.polygonCount,
    inputVertexCount: params.inputVertexCount,
    inputPolygonCount: params.inputPolygonCount,
    timestamp: Date.now(),
  });
  return recordId;
};

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
    const vertexCount = countVerticesFromGeometry(entity.geometry);
    const polygonCount = countPolygonsFromGeometry(entity.geometry);
    properties.__hdbFetchVertexCount = vertexCount;
    properties.__hdbFetchPolygonCount = polygonCount;
    features.push({
      type: 'Feature',
      geometry: entity.geometry,
      properties,
    });
  }
  return { type: 'FeatureCollection', features };
};

const buildEmptyFeatureMetadata = (params: {
  nodeId: NodeId;
  originKey: string;
  dataSource: DataSourceName;
  countryCode?: ISO2;
  adminLevel?: number;
  createdAt: number;
}): ShapeFeatureMetadata => {
  const featureId = `empty:${params.originKey}`;
  return {
    id: `${String(params.nodeId)}-${featureId}`,
    nodeId: String(params.nodeId),
    featureId,
    countryCode: params.countryCode,
    adminLevel: params.adminLevel,
    dataSource: params.dataSource,
    createdAt: params.createdAt,
    vertexCount: 0,
    polygonCount: 0,
    fetchVertexCount: 0,
    fetchPolygonCount: 0,
    area: 0,
  };
};

const buildFetchFeatureMetadata = (params: {
  nodeId: NodeId;
  dataSource: DataSourceName;
  collection: FeatureCollection;
  createdAt: number;
}): ShapeFeatureMetadata[] => {
  const records: ShapeFeatureMetadata[] = [];
  for (let index = 0; index < params.collection.features.length; index += 1) {
    const feature = params.collection.features[index];
    if (!feature) continue;
    feature.properties = feature.properties ?? {};
    const properties = feature.properties as Record<string, unknown>;
    const countryCode = pickCountryCode(properties);
    const adminLevel = pickAdminLevel(properties);
    const adminCode = pickAdminCode(properties);
    const featureId = buildFeatureId(feature, index, { countryCode, adminLevel, adminCode });
    const stats = extractGeometryStats(feature);
    const fetchVertexCount = readNumericProperty(properties, '__hdbFetchVertexCount') ?? stats.vertexCount;
    const fetchPolygonCount = readNumericProperty(properties, '__hdbFetchPolygonCount') ?? stats.polygonCount;
    records.push({
      id: `${String(params.nodeId)}-${featureId}`,
      nodeId: String(params.nodeId),
      featureId,
      countryName: pickCountryName(properties),
      countryCode,
      adminName: pickAdminName(properties),
      adminLevel,
      adminCode,
      dataSource: params.dataSource,
      createdAt: params.createdAt,
      vertexCount: stats.vertexCount,
      polygonCount: stats.polygonCount,
      fetchVertexCount,
      fetchPolygonCount,
      bbox: stats.bbox,
      area: stats.area,
    });
  }
  return records;
};

const buildOriginKey = (dataSource: DataSourceName, sourceKey: string): string => (
  `${dataSource}:${sourceKey}`
);

const assertNotAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new Error('task aborted');
  }
};

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
): {
  featureCount: number;
  vertexCount: number;
  polygonCount: number;
  bbox: [number, number, number, number];
} => {
  const featureCount = collection.features.length;
  let vertexCount = 0;
  let polygonCount = 0;
  for (const feature of collection.features) {
    vertexCount += countVerticesFromGeometry(feature.geometry);
    polygonCount += countPolygonsFromGeometry(feature.geometry);
  }
  let bbox: [number, number, number, number] = [0, 0, 0, 0];
  if (turfBbox) {
    const bounds = turfBbox(collection);
    if (Array.isArray(bounds) && bounds.length === 4 && bounds.every((value) => Number.isFinite(value))) {
      const [minX, minY, maxX, maxY] = bounds as [number, number, number, number];
      bbox = [minX, minY, maxX, maxY];
    }
  }
  return { featureCount, vertexCount, polygonCount, bbox };
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
  dataSource: DataSourceName;
  abortSignal?: AbortSignal;
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

    assertNotAborted(params.abortSignal);
    const existing = await getFetchCache(params.nodeId, input.sourceKey);
    if (existing) {
      const createdAt = Date.now();
      const cachedCollection = await decodeFetchCacheData(existing.data);
      if (cachedCollection && cachedCollection.features.length > 0) {
        const cachedMetadata = buildFetchFeatureMetadata({
          nodeId: params.nodeId,
          dataSource: input.dataSource,
          collection: cachedCollection,
          createdAt,
        });
        if (cachedMetadata.length > 0) {
          await shapeMutationAPIImpl.putFeatureMetadata(cachedMetadata);
        }
      } else if (existing.featureCount === 0) {
        const emptyMetadata = buildEmptyFeatureMetadata({
          nodeId: params.nodeId,
          originKey: buildOriginKey(input.dataSource, input.sourceKey),
          dataSource: input.dataSource,
          countryCode: input.countryCode,
          adminLevel: input.adminLevel,
          createdAt,
        });
        await shapeMutationAPIImpl.putFeatureMetadata([emptyMetadata]);
      }
      const cachedVertexCount = existing.vertexCount ?? 0;
      const cachedPolygonCount = existing.polygonCount ?? 0;
      const cachedSummary = [
        formatReduction('polygons', cachedPolygonCount, existing.inputPolygonCount),
        formatReduction('vertices', cachedVertexCount, existing.inputVertexCount),
      ].join(', ');
      return {
        status: 'completed',
        message: `reused: fetch cache exists (${cachedSummary})`,
        outputData: {
          fetchCacheId: existing.id,
          featureCount: existing.featureCount,
          vertexCount: cachedVertexCount,
        },
      };
    }

    assertNotAborted(params.abortSignal);
    const downloadStart = Date.now();
    const raw = await strategy.fetchData({
      nodeId: params.nodeId,
      country: input.urlCountryCode,
      adminLevel: input.adminLevel,
      endpoint: input.url,
      cacheKeyMode: 'url',
      retryConfig,
      timeout: params.buildConfig.fetchConfig.timeoutMs,
    });
    const downloadTime = Date.now() - downloadStart;

    assertNotAborted(params.abortSignal);
    const processed = await strategy.processData(raw, {
      filters: strategy.config.processing.filters,
      transformations: strategy.config.processing.transformations,
      validation: true,
    });
    const originKey = buildOriginKey(input.dataSource, input.sourceKey);
    const collection = buildFetchFeatureCollection(processed, originKey);
    const inputSummary = summarizeFeatureCollection(collection);
    const zoomRanges = buildZoomBandRanges(params.buildConfig.transformConfig.zoomBandBoundaries);
    const filterZoom = zoomRanges[0]?.max;
    const filteredCollection = Number.isFinite(filterZoom)
      ? filterFetchCollectionByZoom(collection, {
        zTarget: filterZoom!,
        omitDetailsConfig: params.buildConfig.transformConfig.omitDetailsConfig,
        excludePolygonAreaCoefficient: params.buildConfig.transformConfig.excludePolygonAreaCoefficient,
        quantize: params.buildConfig.transformConfig.quantize,
        minRingVertices: params.buildConfig.transformConfig.ringFixConfig?.minRingVertices,
      })
      : collection;
    if (filteredCollection.features.length === 0) {
      const createdAt = Date.now();
      const emptyMetadata = buildEmptyFeatureMetadata({
        nodeId: params.nodeId,
        originKey,
        dataSource: input.dataSource,
        countryCode: input.countryCode,
        adminLevel: input.adminLevel,
        createdAt,
      });
      await shapeMutationAPIImpl.putFeatureMetadata([emptyMetadata]);
      return {
        status: 'completed',
        message: 'skipped: no features after fetch filter',
      };
    }

    const createdAt = Date.now();
    const featureMetadata = buildFetchFeatureMetadata({
      nodeId: params.nodeId,
      dataSource: input.dataSource,
      collection: filteredCollection,
      createdAt,
    });
    if (featureMetadata.length > 0) {
      await shapeMutationAPIImpl.putFeatureMetadata(featureMetadata);
    }

    assertNotAborted(params.abortSignal);
    const { featureCount, vertexCount, polygonCount, bbox } = summarizeFeatureCollection(filteredCollection);
    const data = await encodeFlatGeobufFromFeatureCollection(filteredCollection);
    assertNotAborted(params.abortSignal);
    const bufferId = await putFetchCache({
      nodeId: params.nodeId,
      sourceKey: input.sourceKey,
      countryCode: input.countryCode,
      adminLevel: input.adminLevel,
      data,
      featureCount,
      inputFeatureCount: inputSummary.featureCount,
      bbox,
      downloadTime,
      vertexCount,
      polygonCount,
      inputVertexCount: inputSummary.vertexCount,
      inputPolygonCount: inputSummary.polygonCount,
    });
    const reductionSummary = [
      formatReduction('polygons', polygonCount, inputSummary.polygonCount),
      formatReduction('vertices', vertexCount, inputSummary.vertexCount),
    ].join(', ');

    return {
      status: 'completed',
      message: `completed: features=${featureCount} (${reductionSummary})`,
      outputData: {
        fetchCacheId: bufferId,
        featureCount,
        vertexCount,
        polygonCount,
      },
    };
  };
};

export const runShapeFetchStage = async (params: ShapeFetchStageParams): Promise<void> => {
  const metadata = params.metadata ?? await metadataLoader.loadMetadata(params.dataSource, params.nodeId);
  const abortSignal = params.abortController?.signal;
  const resumeExistingTasks = Boolean(params.resumeExistingTasks);
  if (!resumeExistingTasks) {
    await params.taskQueue.tasks
      .where('[nodeId+stage]')
      .equals([params.nodeId, 'fetch'])
      .delete();
  }
  const existingTasks = resumeExistingTasks
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
      dataSource: params.dataSource,
      abortSignal,
    }),
    waitIfPaused: params.waitIfPaused,
    maxConcurrent: params.buildConfig.fetchConfig.maxConcurrent,
    failureHandling: params.failureHandling,
    abortController: params.abortController,
  });
};
