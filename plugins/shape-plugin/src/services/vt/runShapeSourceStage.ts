import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { ISO2, NodeId } from '@hierarchidb/core-types';
import { encodeFlatGeobufFromFeatureCollection, geometryBbox, type GeometryEngine } from '@hierarchidb/gis-sdk';
import type { StageHandler, TaskQueueRecord } from '@hierarchidb/build-api';
import type { ShapeRuntimeBuildConfig } from '~/common/types/index';
import {
  VtTaskQueueDb,
  deleteTasksByIds,
  listTasksByStage,
  runStageTasks,
  updateTask,
} from '@hierarchidb/vt-orchestrator';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import type { ShapeFeatureMetadata } from '@hierarchidb/shape-api';
import {
  pickAdminCode,
  pickAdminLevel,
  pickCountryCode,
  pickCountryName,
} from '@hierarchidb/gis-sdk';
import { geojson as geojsonApi } from 'flatgeobuf';
import type {
  CountryMetadata,
  DataSourceName,
  SourceTaskPayload,
  SelectedArrayByCountries,
  ShapeFeaturePayload,
} from '~/common/types/index';
import { countSelectedAdminPairs, generateDownloadTaskPayloadsFromSelection } from '~/services/utils/shapeBuildUtils';
import { metadataLoader } from '~/services/metadata/MetadataLoader';
import { DataSourceStrategyFactory } from '~/services/datasources/DataSourceStrategyFactory';
import { resolveStrategyIdFromDataSource } from '~/services/datasources/resolveStrategyIdFromDataSource';
import type { RetryConfig } from '~/services/datasources/DataSourceStrategy';
import type { Topology } from 'topojson-specification';
import { feature as topojsonFeature, merge as topojsonMerge } from 'topojson-client';
import { topology as topojsonTopology } from 'topojson-server';
import { shapeMutationAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import {
  buildFeatureId,
  extractGeometryStats,
  measureFeatureGeoJsonByteSize,
  resolveAdminHierarchyFields,
} from './featureMetadataUtils.ts';
import { filterFetchCollectionByZoom } from './filterFetchCollectionByZoom.ts';
import { buildZoomBandRanges } from '@hierarchidb/util';
import { buildStableSignature } from './buildStableSignature.ts';
import { applyStageTaskReconcile } from './shapeStageReconcile.ts';
import {
  buildRawDataDataSourceCacheKey,
  buildShapeCacheKey,
  createShapeChunkStore,
  getOrFetchWithRetry,
  jsonDeserializer,
  jsonSerializer,
} from '~/services/utils/chunkStore';
import { fetchRawDataWithPipeline } from '~/services/utils/rawDataPipeline';
import { buildGeoBoundariesMetadataUrl } from '~/services/utils/geoboundariesEndpoints';
import type { GeoBoundariesApiResponse } from '~/services/datasources/GeoBoundariesStrategy';
import { setSourcePlannedTotal } from './shapeProgressPlan.ts';
import { buildSourceTaskCacheIdentity } from './shapeTaskCacheIdentity.ts';
import { hashSourceArtifact, resolveSourceArtifactHashFromRecord } from './shapeSourceArtifactHash.ts';

export type ShapeSourceTaskInput = {
  url: string;
  dataSource: DataSourceName;
  sourceKey: string;
  upstreamRevision?: string;
  countryCode: ISO2;
  countryName?: string;
  urlCountryCode: string;
  adminLevel: number;
  configSignature?: string;
  cacheKey?: string;
  inputHash?: string;
};

export type ShapeSourceTaskOutput = {
  sourceCacheId?: string;
  sourceArtifactHash?: string;
  featureCount?: number;
  vertexCount?: number;
  polygonCount?: number;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const GEOBOUNDARIES_MERGE_COUNTRIES = new Set(['CAN', 'GRL', 'CA', 'GL']);

const isGeoBoundariesSource = (source: DataSourceName): boolean => (
  source === 'geoboundaries' || source === 'geoboundaries-topojson'
);

const shouldMergeGeoBoundaries = (params: {
  dataSource: DataSourceName;
  adminLevel: number;
  countryCode: string;
}): boolean => {
  if (!isGeoBoundariesSource(params.dataSource)) return false;
  if (params.adminLevel !== 0) return false;
  const normalized = params.countryCode.trim().toUpperCase();
  return GEOBOUNDARIES_MERGE_COUNTRIES.has(normalized);
};

const compressGzip = async (buffer: ArrayBuffer): Promise<ArrayBuffer> => {
  if (typeof CompressionStream !== 'function') {
    throw new Error('CompressionStream is not available for gzip compression');
  }
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  await writer.write(new Uint8Array(buffer));
  await writer.close();
  return await new Response(stream.readable).arrayBuffer();
};

const decompressGzip = async (buffer: ArrayBuffer): Promise<ArrayBuffer> => {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('DecompressionStream is not available for gzip decompression');
  }
  const stream = new DecompressionStream('gzip');
  const writer = stream.writable.getWriter();
  await writer.write(new Uint8Array(buffer));
  await writer.close();
  return await new Response(stream.readable).arrayBuffer();
};

const decodeTopoJson = (buffer: ArrayBuffer): Topology => {
  const text = textDecoder.decode(new Uint8Array(buffer));
  return JSON.parse(text) as Topology;
};

const encodeTopoJson = (topology: Topology): ArrayBuffer => (
  textEncoder.encode(JSON.stringify(topology)).buffer
);

const resolveTopoJsonObject = (topology: Topology): { key: string; object: Topology['objects'][string] } | null => {
  const keys = Object.keys(topology.objects ?? {});
  const key = keys[0];
  if (!key) return null;
  const object = topology.objects[key];
  if (!object) return null;
  return { key, object };
};

const normalizeTopoJsonCollection = (topology: Topology): FeatureCollection => {
  const entry = resolveTopoJsonObject(topology);
  if (!entry) {
    return { type: 'FeatureCollection', features: [] };
  }
  const geojson = topojsonFeature(
    topology,
    entry.object as Parameters<typeof topojsonFeature>[1],
  ) as FeatureCollection | Feature;
  if ('features' in geojson) {
    const features = Array.isArray(geojson.features) ? geojson.features : [];
    return { ...geojson, features };
  }
  return { type: 'FeatureCollection', features: [geojson] };
};

const mergeTopoJsonCollection = (topology: Topology, properties?: Record<string, unknown>): FeatureCollection | null => {
  const entry = resolveTopoJsonObject(topology);
  if (!entry) return null;
  const geometries = (entry.object as { geometries?: unknown[] }).geometries;
  if (!Array.isArray(geometries) || geometries.length === 0) return null;
  const merged = topojsonMerge(topology, geometries as Parameters<typeof topojsonMerge>[1]);
  if (!merged) return null;
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: merged as Geometry,
      properties: { ...(properties ?? {}) },
    }],
  };
};

const normalizeGeojsonCollection = (collection: FeatureCollection): FeatureCollection => {
  const features = Array.isArray(collection.features) ? collection.features : [];
  return { ...collection, features };
};

const mergeGeojsonCollection = (collection: FeatureCollection): FeatureCollection => {
  if (collection.features.length <= 1) return collection;
  const topology = topojsonTopology({ collection });
  const baseProps = collection.features[0]?.properties ?? {};
  const merged = mergeTopoJsonCollection(topology, baseProps);
  return merged ?? collection;
};

export type ShapeSourceStageParams = {
  nodeId: NodeId;
  dataSource: DataSourceName;
  selectedArrayByCountries?: SelectedArrayByCountries;
  downloadTaskPayloads?: SourceTaskPayload[];
  buildConfig: ShapeRuntimeBuildConfig;
  taskQueue: VtTaskQueueDb;
  metadata?: CountryMetadata[];
  recyclingByFeatureId?: Map<string, boolean>;
  waitIfPaused?: () => Promise<void>;
  resumeExistingTasks?: boolean;
  abortController?: AbortController;
  failureHandling?: 'continue' | 'stop' | 'skip';
  onTasksEnqueued?: (payload: {
    nodeId: NodeId;
    stage: 'source';
    taskCount: number;
    source: 'created' | 'reused';
  }) => Promise<void> | void;
};

const buildRetryConfig = (config: ShapeRuntimeBuildConfig): RetryConfig => {
  const downloadConfig = config.sourceConfig;
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

const fetchGeoBoundariesApiData = async (params: {
  nodeId: NodeId;
  country: string;
  adminLevel: number;
  signal?: AbortSignal;
  cacheKeyMode: 'url' | 'legacy';
  retryConfig?: RetryConfig;
  onRetryAttempt?: (attempt: number, error: unknown) => void | Promise<void>;
}): Promise<GeoBoundariesApiResponse> => {
  const adminLabel = `ADM${params.adminLevel}`;
  const normalizedCountry = params.country.trim().toUpperCase();
  const url = buildGeoBoundariesMetadataUrl(normalizedCountry, adminLabel);
  const cacheKey = params.cacheKeyMode === 'url'
    ? url
    : buildShapeCacheKey(`geoboundaries:metadata:${normalizedCountry}:${adminLabel}`, url);
  const store = createShapeChunkStore(jsonSerializer, jsonDeserializer);
  const entry = params.retryConfig
    ? await getOrFetchWithRetry(
      store,
      params.nodeId,
      url,
      {
        accept: 'application/json',
        cacheKey,
        signal: params.signal,
      },
      params.retryConfig,
      params.onRetryAttempt,
    )
    : await store.getOrFetchForNode(params.nodeId, url, {
      accept: 'application/json',
      cacheKey,
      signal: params.signal,
    });
  return entry.value as GeoBoundariesApiResponse;
};

const fetchGeoBoundariesTopoJson = async (params: {
  nodeId: NodeId;
  country: string;
  adminLevel: number;
  signal?: AbortSignal;
  cacheKeyMode: 'url' | 'legacy';
  retryConfig?: RetryConfig;
  timeoutMs?: number;
  onRetryAttempt?: (attempt: number, error: unknown) => void | Promise<void>;
}): Promise<{ topology: Topology; apiData: GeoBoundariesApiResponse; downloadUrl: string }> => {
  const apiData = await fetchGeoBoundariesApiData({
    nodeId: params.nodeId,
    country: params.country,
    adminLevel: params.adminLevel,
    signal: params.signal,
    cacheKeyMode: params.cacheKeyMode,
    retryConfig: params.retryConfig,
  });
  const downloadUrl = apiData.tjDownloadURL;
  if (!downloadUrl || typeof downloadUrl !== 'string') {
    throw new Error(`TopoJSON download URL is missing for ${params.country} ADM${params.adminLevel}`);
  }
  const pipeline = {
    prepareRequest: () => ({
      url: downloadUrl,
      cacheKey: params.cacheKeyMode === 'url'
        ? downloadUrl
        : buildRawDataDataSourceCacheKey({
          dataSource: 'geoboundaries-topojson',
          countryCode: params.country,
          adminLevel: params.adminLevel,
          url: downloadUrl,
        }),
      accept: 'application/json',
    }),
    transformStream: async (stream: ReadableStream<Uint8Array>) => ({
      stream,
      contentType: 'application/topojson',
    }),
    decodeBuffer: async (buffer: ArrayBuffer) => decodeTopoJson(buffer),
  };
  const { decoded } = await fetchRawDataWithPipeline({
    nodeId: params.nodeId,
    fetchOptions: {
      nodeId: params.nodeId,
      signal: params.signal,
      timeout: params.timeoutMs,
      cacheKeyMode: params.cacheKeyMode,
    },
    pipeline,
    retryConfig: params.retryConfig,
    onRetryAttempt: params.onRetryAttempt,
  });
  return { topology: decoded, apiData, downloadUrl };
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

const buildShapeSourceTaskId = (nodeId: NodeId, sourceKey: string): string => (
  `${String(nodeId)}:source:${sourceKey}`
);

const buildSourceCacheId = (nodeId: NodeId, sourceKey: string): string => (
  `${String(nodeId)}-shape-${sourceKey}`
);

const formatCount = (value: number): string => (
  Number.isFinite(value) ? new Intl.NumberFormat('en-US').format(value) : '-'
);

const formatSignedPercent = (output: number, input: number): string => {
  if (!Number.isFinite(input) || input <= 0) return '-0.0%';
  const percent = ((output - input) / input) * 100;
  const prefix = percent <= 0 ? '-' : '+';
  return `${prefix}${Math.abs(percent).toFixed(1)}%`;
};

const formatChangeSummary = (label: string, input: number, output: number): string => {
  const safeInput = Number.isFinite(input) ? input : output;
  const safeOutput = Number.isFinite(output) ? output : 0;
  return `${label}: ${formatCount(safeInput)} -> ${formatCount(safeOutput)} (${formatSignedPercent(safeOutput, safeInput)})`;
};

const buildSourceFilterReductionSummary = (inputSummary: {
  featureCount: number;
  polygonCount: number;
  vertexCount: number;
}): string => ([
  formatChangeSummary('features', inputSummary.featureCount, 0),
  formatChangeSummary('polygons', inputSummary.polygonCount, 0),
  formatChangeSummary('vertices', inputSummary.vertexCount, 0),
].join(', '));

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

const decodeSourceCacheData = async (params: {
  data: ArrayBuffer;
  format?: string;
  compression?: string;
}): Promise<FeatureCollection | null> => {
  const format = params.format ?? 'flatgeobuf';
  if (format === 'topojson') {
    try {
      const buffer = params.compression === 'gzip'
        ? await decompressGzip(params.data)
        : params.data;
      const topology = decodeTopoJson(buffer);
      return normalizeTopoJsonCollection(topology);
    } catch {
      return null;
    }
  }
  try {
    const decoded = geojsonApi.deserialize(new Uint8Array(params.data));
    return await normalizeFeatureCollection(decoded);
  } catch {
    return null;
  }
};

const getSourceCache = async (nodeId: NodeId, sourceKey: string) => (
  await ephemeralDB.sourceCache
    .where('[nodeId+sourceKey]')
    .equals([nodeId, sourceKey])
    .first()
);

const buildSourceCacheMetadata = (params: {
  status: 'completed' | 'failed' | 'skipped';
  dataSource: DataSourceName;
  sourceKey: string;
  countryCode: ISO2;
  adminLevel?: number;
  featureCount: number;
  inputFeatureCount?: number;
  vertexCount: number;
  polygonCount: number;
  inputVertexCount?: number;
  inputPolygonCount?: number;
  polygonPerFeatureMax?: number;
  inputPolygonPerFeatureMax?: number;
  retryAttempt?: number;
}): Record<string, unknown> => ({
  stage: 'source',
  status: params.status,
  dataSource: params.dataSource,
  sourceKey: params.sourceKey,
  countryCode: params.countryCode,
  adminLevel: params.adminLevel,
  featureCount: params.featureCount,
  inputFeatureCount: params.inputFeatureCount,
  vertexCount: params.vertexCount,
  polygonCount: params.polygonCount,
  inputVertexCount: params.inputVertexCount,
  inputPolygonCount: params.inputPolygonCount,
  polygonPerFeatureMax: params.polygonPerFeatureMax,
  inputPolygonPerFeatureMax: params.inputPolygonPerFeatureMax,
  retryAttempt: Number.isFinite(params.retryAttempt ?? NaN)
    ? Math.trunc(params.retryAttempt!)
    : undefined,
});

const markSourceCacheWriteComplete = async (cacheIds: string[]): Promise<void> => {
  if (cacheIds.length === 0) return;
  const completedAt = Date.now();
  await Promise.all(cacheIds.map((id) => (
    ephemeralDB.sourceCache.update(id, { timestamp: completedAt })
  )));
};

const putSourceCache = async (params: {
  nodeId: NodeId;
  sourceKey: string;
  countryCode: ISO2;
  adminLevel: number;
  data: ArrayBuffer;
  format?: 'flatgeobuf' | 'topojson';
  compression?: 'gzip' | 'none';
  featureCount: number;
  inputFeatureCount?: number;
  bbox: [number, number, number, number];
  downloadTime: number;
  vertexCount: number;
  polygonCount: number;
  inputVertexCount?: number;
  inputPolygonCount?: number;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string; contentHash: string }> => {
  const recordId = buildSourceCacheId(params.nodeId, params.sourceKey);
  const contentHash = hashSourceArtifact(params.data);

  // Phase 1: Write data with timestamp: 0 (invalid state)
  await ephemeralDB.sourceCache.put({
    id: recordId,
    nodeId: params.nodeId,
    domainType: 'shape',
    sourceKey: params.sourceKey,
    countryCode: params.countryCode,
    adminLevel: params.adminLevel,
    data: params.data,
    format: params.format,
    compression: params.compression,
    featureCount: params.featureCount,
    inputFeatureCount: params.inputFeatureCount,
    bbox: params.bbox,
    downloadTime: params.downloadTime,
    size: params.data.byteLength,
    vertexCount: params.vertexCount,
    polygonCount: params.polygonCount,
    inputVertexCount: params.inputVertexCount,
    inputPolygonCount: params.inputPolygonCount,
    metadata: params.metadata,
    contentHash,
    timestamp: 0,
  });

  // Phase 2: Mark write complete with non-zero timestamp (valid state)
  await markSourceCacheWriteComplete([recordId]);

  return { id: recordId, contentHash };
};

const buildSourceFeatureCollection = (
  entities: ShapeFeaturePayload[],
  originKey: string
): FeatureCollection => {
  const features: Feature[] = [];
  for (const entity of entities) {
    if (!entity?.geometry) continue;
    const entityProperties = isRecord(entity) && isRecord(entity.properties)
      ? entity.properties
      : undefined;
    const properties = {
      ...(entityProperties ?? {}),
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

const ORIGIN_KEY_PROP = '__hdbOriginKey';

const parseOriginKey = (originKey: string): { countryCode?: string; adminLevel?: number } => {
  const index = originKey.indexOf(':');
  const sourceKey = index > 0 ? originKey.slice(index + 1) : originKey;
  const [countryCode, adminLevelRaw] = sourceKey.split(':');
  const adminLevel = adminLevelRaw != null ? Number(adminLevelRaw) : undefined;
  return {
    countryCode: countryCode?.trim().toUpperCase() || undefined,
    adminLevel: Number.isFinite(adminLevel) ? adminLevel : undefined,
  };
};

const resolveFeatureOriginInfo = (
  properties: Record<string, unknown>,
  lookup?: Map<string, CountryMetadata>,
): { countryCode?: ISO2; countryName?: string; adminLevel?: number } => {
  const originKey = typeof properties[ORIGIN_KEY_PROP] === 'string' ? properties[ORIGIN_KEY_PROP] as string : undefined;
  const originInfo = originKey ? parseOriginKey(originKey) : {};
  const rawCountryCode = originInfo.countryCode ?? pickCountryCode(properties);
  const rawAdminLevel = originInfo.adminLevel ?? pickAdminLevel(properties);
  const meta = rawCountryCode ? lookup?.get(rawCountryCode.trim().toUpperCase()) : undefined;
  const normalizedCode = (meta?.countryCode ?? meta?.iso2 ?? rawCountryCode)?.trim().toUpperCase();
  const normalizedName = meta?.countryName ?? pickCountryName(properties) ?? rawCountryCode;
  return {
    countryCode: normalizedCode as ISO2 | undefined,
    countryName: normalizedName,
    adminLevel: typeof rawAdminLevel === 'number' ? rawAdminLevel : undefined,
  };
};

const buildEmptyFeatureMetadata = (params: {
  nodeId: NodeId;
  originKey: string;
  dataSource: DataSourceName;
  countryCode?: ISO2;
  adminLevel?: number;
  createdAt: number;
  recyclingByFeatureId?: Map<string, boolean>;
}): ShapeFeatureMetadata => {
  const featureId = `empty:${params.originKey}`;
  const admin0Code = params.countryCode;
  return {
    id: `${String(params.nodeId)}-${featureId}`,
    nodeId: String(params.nodeId),
    featureId,
    countryCode: params.countryCode,
    adminLevel: params.adminLevel,
    admin0Code,
    dataSource: params.dataSource,
    createdAt: params.createdAt,
    vertexCount: 0,
    polygonCount: 0,
    fetchVertexCount: 0,
    fetchPolygonCount: 0,
    geojsonByteSize: 0,
    area: 0,
    recycling: params.recyclingByFeatureId?.get(featureId),
  };
};

const buildSourceFeatureMetadata = (params: {
  nodeId: NodeId;
  dataSource: DataSourceName;
  collection: FeatureCollection;
  createdAt: number;
  countryLookup?: Map<string, CountryMetadata>;
  recyclingByFeatureId?: Map<string, boolean>;
  geometryEngine: GeometryEngine;
}): ShapeFeatureMetadata[] => {
  const records: ShapeFeatureMetadata[] = [];
  for (let index = 0; index < params.collection.features.length; index += 1) {
    const feature = params.collection.features[index];
    if (!feature) continue;
    feature.properties = feature.properties ?? {};
    const properties = feature.properties as Record<string, unknown>;
    const originInfo = resolveFeatureOriginInfo(properties, params.countryLookup);
    const countryCode = originInfo.countryCode;
    const adminLevel = originInfo.adminLevel;
    const adminHierarchy = resolveAdminHierarchyFields({
      properties,
      countryCode,
      adminLevel,
    });
    const resolvedAdminLevel = adminHierarchy.resolvedAdminLevel ?? adminLevel;
    const adminCode = pickAdminCode(properties)
      ?? (resolvedAdminLevel === 2
        ? adminHierarchy.admin2Code
        : resolvedAdminLevel === 1
          ? adminHierarchy.admin1Code
          : adminHierarchy.admin0Code);
    const featureId = buildFeatureId(feature, index, { countryCode, adminLevel, adminCode });
    if (properties.__hdbFeatureId !== featureId) {
      properties.__hdbFeatureId = featureId;
    }
    const stats = extractGeometryStats(feature, params.geometryEngine);
    const fetchVertexCount = readNumericProperty(properties, '__hdbFetchVertexCount') ?? stats.vertexCount;
    const fetchPolygonCount = readNumericProperty(properties, '__hdbFetchPolygonCount') ?? stats.polygonCount;
    records.push({
      id: `${String(params.nodeId)}-${featureId}`,
      nodeId: String(params.nodeId),
      featureId,
      countryName: originInfo.countryName,
      countryCode,
      adminLevel: resolvedAdminLevel,
      admin0Name: originInfo.countryName,
      admin0Code: adminHierarchy.admin0Code,
      admin1Name: adminHierarchy.admin1Name,
      admin1Code: adminHierarchy.admin1Code,
      admin2Name: adminHierarchy.admin2Name,
      admin2Code: adminHierarchy.admin2Code,
      dataSource: params.dataSource,
      createdAt: params.createdAt,
      vertexCount: stats.vertexCount,
      polygonCount: stats.polygonCount,
      fetchVertexCount,
      fetchPolygonCount,
      geojsonByteSize: measureFeatureGeoJsonByteSize(feature),
      bbox: stats.bbox,
      area: stats.area,
      recycling: params.recyclingByFeatureId?.get(featureId),
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

const applyOriginPropertiesToCollection = (collection: FeatureCollection, originKey: string): FeatureCollection => {
  const features = collection.features.map((feature) => {
    const properties = { ...(feature.properties ?? {}) } as Record<string, unknown>;
    if (!properties.__hdbOriginKey) {
      properties.__hdbOriginKey = originKey;
    }
    const geometry = feature.geometry;
    if (geometry) {
      if (typeof properties.__hdbFetchVertexCount !== 'number') {
        properties.__hdbFetchVertexCount = countVerticesFromGeometry(geometry);
      }
      if (typeof properties.__hdbFetchPolygonCount !== 'number') {
        properties.__hdbFetchPolygonCount = countPolygonsFromGeometry(geometry);
      }
    }
    return { ...feature, properties };
  });
  return { ...collection, features };
};

const summarizeFeatureCollection = async (
  collection: FeatureCollection,
  geometryEngine: GeometryEngine,
  options?: {
    onFeatureCountProgress?: (featureIndex: number, featureTotal: number) => Promise<void> | void;
  },
): Promise<{
  featureCount: number;
  vertexCount: number;
  polygonCount: number;
  maxPolygonPerFeature: number;
  bbox: [number, number, number, number];
}> => {
  const featureCount = collection.features.length;
  let vertexCount = 0;
  let polygonCount = 0;
  let maxPolygonPerFeature = 0;
  for (let featureIndex = 0; featureIndex < collection.features.length; featureIndex += 1) {
    await options?.onFeatureCountProgress?.(featureIndex + 1, featureCount);
    const feature = collection.features[featureIndex];
    if (!feature) continue;
    vertexCount += countVerticesFromGeometry(feature.geometry);
    const polygonCountPerFeature = countPolygonsFromGeometry(feature.geometry);
    polygonCount += polygonCountPerFeature;
    if (polygonCountPerFeature > maxPolygonPerFeature) {
      maxPolygonPerFeature = polygonCountPerFeature;
    }
  }
  let bbox: [number, number, number, number] = [0, 0, 0, 0];
  {
    const bounds = geometryBbox(collection, geometryEngine);
    if (Array.isArray(bounds) && bounds.length === 4 && bounds.every((value) => Number.isFinite(value))) {
      const [minX, minY, maxX, maxY] = bounds as [number, number, number, number];
      bbox = [minX, minY, maxX, maxY];
    }
  }
  return { featureCount, vertexCount, polygonCount, maxPolygonPerFeature, bbox };
};

const buildSourceTasks = (
  nodeId: NodeId,
  payloads: SourceTaskPayload[],
  metadata: CountryMetadata[],
  configSignature: string,
): Array<TaskQueueRecord<ShapeSourceTaskInput, ShapeSourceTaskOutput>> => {
  const lookup = buildCountryLookup(metadata);
  return payloads.map((payload, index) => {
    const countryCode = payload.countryCode.trim().toUpperCase();
    const countryMeta = lookup.get(countryCode);
    if (!countryMeta) {
      throw new Error(`[shape-source] Missing metadata for ${payload.countryCode}`);
    }
    const iso2 = (countryMeta.countryCode ?? countryMeta.iso2 ?? '').trim().toUpperCase() as ISO2;
    if (!iso2) {
      throw new Error(`[shape-source] Missing ISO2 for ${payload.countryCode}`);
    }
    const sourceKey = `${iso2}:${payload.adminLevel}`;
    const cacheIdentity = buildSourceTaskCacheIdentity({
      nodeId,
      dataSource: payload.dataSource,
      sourceKey,
      url: payload.url,
      upstreamRevision: payload.upstreamRevision,
      configSignature,
    });
    return {
      taskId: buildShapeSourceTaskId(nodeId, sourceKey),
      nodeId,
      stage: 'source',
      status: 'queued',
      index,
      progress: 0,
      inputData: {
        url: payload.url,
        dataSource: payload.dataSource,
        sourceKey,
        upstreamRevision: payload.upstreamRevision,
        countryCode: iso2,
        countryName: countryMeta.countryName,
        urlCountryCode: payload.countryCode.trim().toUpperCase(),
        adminLevel: payload.adminLevel,
        configSignature,
        cacheKey: cacheIdentity.cacheKey,
        inputHash: cacheIdentity.inputHash,
      },
    };
  });
};

const createSourceHandler = (params: {
  nodeId: NodeId;
  buildConfig: ShapeRuntimeBuildConfig;
  dataSource: DataSourceName;
  recyclingByFeatureId?: Map<string, boolean>;
  abortSignal?: AbortSignal;
}): StageHandler<ShapeSourceTaskInput, ShapeSourceTaskOutput> => {
  const factory = new DataSourceStrategyFactory();
  const geometryEngine: GeometryEngine = params.buildConfig.geometryConfig.geometryEngine ?? 'turf';
  const isTopoJsonSource = params.dataSource === 'geoboundaries-topojson';
  const strategySource = isTopoJsonSource ? 'geoboundaries' : params.dataSource;
  const strategyId = resolveStrategyIdFromDataSource(strategySource);
  if (!strategyId) {
    throw new Error(`[shape-source] Unsupported data source: ${params.dataSource}`);
  }
  const strategy = factory.create(strategyId);
  const taskQueue = new VtTaskQueueDb();
  const retryConfig = buildRetryConfig(params.buildConfig);
  const invalidGeometryFilter = params.buildConfig.tileEmitConfig.invalidGeometryFilter;
  const hasInvalidGeometryFilter = Boolean(
    invalidGeometryFilter
    && (
      invalidGeometryFilter.area
      || invalidGeometryFilter.lineLength
      || invalidGeometryFilter.maxEdgeLength
      || invalidGeometryFilter.selfIntersection
      || invalidGeometryFilter.triangleRingRatio
    ),
  );
  const buildCountPolygonsVerticesMessage = (featureIndex: number, featureTotal: number): string => (
    `Count polygons/vertices of feature ${featureIndex} of ${featureTotal}`
  );
  const buildInvalidGeometryCheckMessage = (check: string, polygonIndex: number, polygonTotal: number): string => (
    `Check ${check} of polygon ${polygonIndex} of ${polygonTotal}`
  );
  const createTaskMessageReporter = (taskId: string) => {
    let lastUpdatedAt = 0;
    let lastMessage = '';
    return async (message: string, force = false): Promise<void> => {
      if (!force && message === lastMessage) return;
      const now = Date.now();
      if (!force && now - lastUpdatedAt < 120) return;
      lastUpdatedAt = now;
      lastMessage = message;
      try {
        await updateTask(taskQueue, taskId, { message });
      } catch (error) {
        console.warn('[ShapeSource] failed to update task message', { taskId, message, error });
      }
    };
  };
  const updateRetryAttempt = async (taskId: string, retryAttempt: number): Promise<void> => {
    try {
      const record = await taskQueue.tasks.get(taskId);
      const currentMetadata = isRecord(record?.metadata) ? record.metadata as Record<string, unknown> : {};
      const nextRetryAttempt = Number.isFinite(retryAttempt) && retryAttempt > 0 ? Math.trunc(retryAttempt) : 0;
      await updateTask(taskQueue, taskId, {
        metadata: { ...currentMetadata, retryAttempt: nextRetryAttempt },
      });
    } catch (error) {
      console.warn('[ShapeSource] failed to update task retryAttempt', {
        taskId,
        retryAttempt,
        error,
      });
    }
  };
  let metadataLookupPromise: Promise<Map<string, CountryMetadata>> | null = null;
  const getMetadataLookup = async (): Promise<Map<string, CountryMetadata>> => {
    if (!metadataLookupPromise) {
      metadataLookupPromise = metadataLoader
        .loadMetadata(params.dataSource, params.nodeId)
        .then((metadata) => buildCountryLookup(metadata));
    }
    return metadataLookupPromise;
  };

  const normalizeCount = (value: number | null | undefined): number | null => (
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null
  );

  const buildSourceDetailMetadata = (
    input: ShapeSourceTaskInput,
    counts: {
      inputFeatureCount?: number | null;
      featureCount?: number | null;
      inputPolygonCount?: number | null;
      polygonCount?: number | null;
      inputPolygonPerFeatureMax?: number | null;
      polygonPerFeatureMax?: number | null;
    },
    preview?: {
      sourceCacheId?: string | null;
      sourceCacheFormat?: 'flatgeobuf' | 'topojson';
      sourceCacheCompression?: 'gzip' | 'none';
    },
  ): Record<string, unknown> => ({
    fetchDetail: {
      countryCode: input.countryCode,
      countryName: input.countryName ?? null,
      adminLevel: input.adminLevel,
      url: input.url,
      features: {
        input: normalizeCount(counts.inputFeatureCount),
        output: normalizeCount(counts.featureCount),
      },
      polygons: {
        input: normalizeCount(counts.inputPolygonCount),
        output: normalizeCount(counts.polygonCount),
      },
      polygonsPerFeature: {
        input: normalizeCount(counts.inputPolygonPerFeatureMax),
        output: normalizeCount(counts.polygonPerFeatureMax),
      },
    },
    preview: {
      stage: 'source',
      sourceKey: input.sourceKey,
      dataSource: input.dataSource,
      sourceUrl: input.url,
      sourceCountryCode: input.urlCountryCode || input.countryCode,
      adminLevel: input.adminLevel,
      rawSourceCacheKey: buildRawDataDataSourceCacheKey({
        dataSource: input.dataSource,
        countryCode: input.urlCountryCode,
        adminLevel: input.adminLevel,
        url: input.url,
      }),
      sourceCacheId: preview?.sourceCacheId ?? null,
      sourceCacheFormat: preview?.sourceCacheFormat ?? 'flatgeobuf',
      sourceCacheCompression: preview?.sourceCacheCompression ?? 'none',
    },
  });

  return async (task) => {
    const input = task.inputData;
    if (!input) {
      return { status: 'failed', errorMessage: 'source task input is missing' };
    }

    const reportTaskMessage = createTaskMessageReporter(task.taskId);
    const onFeatureCountProgress = async (featureIndex: number, featureTotal: number): Promise<void> => {
      await reportTaskMessage(
        buildCountPolygonsVerticesMessage(featureIndex, featureTotal),
        featureTotal > 0 && featureIndex >= featureTotal,
      );
    };
    const onInvalidGeometryCheck = async (progress: {
      check: string;
      polygonIndex: number;
      polygonTotal: number;
    }): Promise<void> => {
      await reportTaskMessage(
        buildInvalidGeometryCheckMessage(progress.check, progress.polygonIndex, progress.polygonTotal),
        progress.polygonTotal > 0 && progress.polygonIndex >= progress.polygonTotal,
      );
    };
    const onRetryAttempt = (attempt: number) => updateRetryAttempt(task.taskId, attempt);
    void updateRetryAttempt(task.taskId, 0);

    assertNotAborted(params.abortSignal);
    const existing = await getSourceCache(params.nodeId, input.sourceKey);
    if (existing) {
      const existingMetadata = isRecord(existing.metadata) ? existing.metadata : {};
      const isRawCacheInvalidated = existingMetadata.rawCacheInvalidated === true;
      if (!isRawCacheInvalidated) {
        const createdAt = Date.now();
        let sourceArtifactHash = await resolveSourceArtifactHashFromRecord(ephemeralDB.sourceCache, existing);
        const existingInputFeatureCount = existing.inputFeatureCount ?? existing.featureCount;
        const existingOutputFeatureCount = existing.featureCount;
        const cachedPolygonPerFeatureMax = readNumericProperty(existingMetadata, 'polygonPerFeatureMax')
          ?? (existingOutputFeatureCount > 0
            ? (existing.polygonCount ?? 0) / existingOutputFeatureCount
            : 0);
        const cachedInputPolygonPerFeatureMax = readNumericProperty(existingMetadata, 'inputPolygonPerFeatureMax')
          ?? (existingInputFeatureCount > 0
            ? (existing.inputPolygonCount ?? existing.polygonCount ?? 0) / existingInputFeatureCount
            : 0);
        const cachedCollection = await decodeSourceCacheData({
          data: existing.data,
          format: existing.format,
          compression: existing.compression,
        });
        const sourceMetadata = buildSourceCacheMetadata({
          status: 'completed',
          dataSource: input.dataSource,
          sourceKey: input.sourceKey,
          countryCode: input.countryCode,
          adminLevel: input.adminLevel,
          featureCount: existing.featureCount,
          inputFeatureCount: existingInputFeatureCount,
          vertexCount: existing.vertexCount ?? 0,
          polygonCount: existing.polygonCount ?? 0,
          inputVertexCount: existing.inputVertexCount ?? 0,
          inputPolygonCount: existing.inputPolygonCount ?? 0,
          polygonPerFeatureMax: cachedPolygonPerFeatureMax,
          inputPolygonPerFeatureMax: cachedInputPolygonPerFeatureMax,
        });
        if (cachedCollection && cachedCollection.features.length > 0) {
          const hasMissingFeatureIds = cachedCollection.features.some((feature) => {
            const props = feature?.properties as Record<string, unknown> | undefined;
            return typeof props?.__hdbFeatureId !== 'string' || props.__hdbFeatureId.length === 0;
          });
          const countryLookup = await getMetadataLookup();
          const cachedMetadata = buildSourceFeatureMetadata({
            nodeId: params.nodeId,
            dataSource: input.dataSource,
            collection: cachedCollection,
            createdAt,
            countryLookup,
            recyclingByFeatureId: params.recyclingByFeatureId,
            geometryEngine,
          });
          if (cachedMetadata.length > 0) {
            await shapeMutationAPIImpl.putFeatureMetadata(cachedMetadata);
          }
          if (hasMissingFeatureIds) {
            let data: ArrayBuffer | null = null;
            if (existing.format === 'topojson') {
              const topology = topojsonTopology({ collection: cachedCollection });
              const encoded = encodeTopoJson(topology);
              data = existing.compression === 'gzip'
                ? await compressGzip(encoded)
                : encoded;
            } else if (existing.format === 'flatgeobuf' || !existing.format) {
              data = await encodeFlatGeobufFromFeatureCollection(cachedCollection);
            }
            if (data) {
              sourceArtifactHash = hashSourceArtifact(data);
              await ephemeralDB.sourceCache.update(existing.id, {
                data,
                size: data.byteLength,
                contentHash: sourceArtifactHash,
                timestamp: Date.now(),
                metadata: sourceMetadata,
              });
            }
          } else if (existing.metadata?.status !== 'completed') {
            await ephemeralDB.sourceCache.update(existing.id, {
              metadata: sourceMetadata,
            });
          }
        } else if (existing.featureCount === 0) {
          const emptyMetadata = buildEmptyFeatureMetadata({
            nodeId: params.nodeId,
            originKey: buildOriginKey(input.dataSource, input.sourceKey),
            dataSource: input.dataSource,
            countryCode: input.countryCode,
            adminLevel: input.adminLevel,
            createdAt,
            recyclingByFeatureId: params.recyclingByFeatureId,
          });
          await shapeMutationAPIImpl.putFeatureMetadata([emptyMetadata]);
          await ephemeralDB.sourceCache.update(existing.id, {
            metadata: {
              ...sourceMetadata,
              status: 'completed',
            },
          });
        }
        const cachedVertexCount = existing.vertexCount ?? 0;
        const cachedPolygonCount = existing.polygonCount ?? 0;
        const cachedSummary = [
          formatChangeSummary('features', existing.inputFeatureCount ?? existing.featureCount, existing.featureCount),
          formatChangeSummary('polygons', existing.inputPolygonCount ?? cachedPolygonCount, cachedPolygonCount),
          formatChangeSummary('vertices', existing.inputVertexCount ?? cachedVertexCount, cachedVertexCount),
        ].join(', ');
        return {
          status: 'completed',
          message: `reused: source cache exists (${cachedSummary})`,
          metadata: buildSourceDetailMetadata(input, {
            inputFeatureCount: existingInputFeatureCount,
            featureCount: existing.featureCount,
            inputPolygonCount: existing.inputPolygonCount ?? cachedPolygonCount,
            polygonCount: cachedPolygonCount,
            inputPolygonPerFeatureMax: cachedInputPolygonPerFeatureMax,
            polygonPerFeatureMax: cachedPolygonPerFeatureMax,
          }, {
            sourceCacheId: existing.id,
            sourceCacheFormat: existing.format === 'topojson' ? 'topojson' : 'flatgeobuf',
            sourceCacheCompression: existing.compression === 'gzip' ? 'gzip' : 'none',
          }),
          outputData: {
            sourceCacheId: existing.id,
            sourceArtifactHash,
            featureCount: existing.featureCount,
            vertexCount: cachedVertexCount,
          },
        };
      }
    }

    assertNotAborted(params.abortSignal);
    const originKey = buildOriginKey(input.dataSource, input.sourceKey);
    const zoomRanges = buildZoomBandRanges(params.buildConfig.geometryConfig.zoomBandBoundaries);
    const filterZoom = zoomRanges[0]?.max;

    if (isTopoJsonSource) {
      const downloadStart = Date.now();
      const topojsonResult = await fetchGeoBoundariesTopoJson({
        nodeId: params.nodeId,
        country: input.urlCountryCode,
        adminLevel: input.adminLevel,
        signal: params.abortSignal,
        cacheKeyMode: 'url',
        retryConfig,
        timeoutMs: params.buildConfig.sourceConfig.timeoutMs,
        onRetryAttempt,
      });
      const downloadTime = Date.now() - downloadStart;

      let baseCollection = normalizeTopoJsonCollection(topojsonResult.topology);
      if (shouldMergeGeoBoundaries({
        dataSource: input.dataSource,
        adminLevel: input.adminLevel,
        countryCode: input.urlCountryCode,
      })) {
        const merged = mergeTopoJsonCollection(topojsonResult.topology, baseCollection.features[0]?.properties ?? {});
        if (merged) {
          baseCollection = merged;
        }
      }
      baseCollection = normalizeGeojsonCollection(baseCollection);
      const inputSummary = await summarizeFeatureCollection(baseCollection, geometryEngine, {
        onFeatureCountProgress,
      });
      const filteredCollection = Number.isFinite(filterZoom)
        ? await filterFetchCollectionByZoom(baseCollection, {
          zTarget: filterZoom!,
          omitDetailsConfig: params.buildConfig.geometryConfig.omitDetailsConfig,
          excludePolygonAreaCoefficient: params.buildConfig.geometryConfig.excludePolygonAreaCoefficient,
          minRingVertices: params.buildConfig.geometryConfig.minRingVertices,
          geometryEngine,
          invalidGeometryFilter,
          onInvalidGeometryCheck: hasInvalidGeometryFilter ? onInvalidGeometryCheck : undefined,
        })
        : baseCollection;

      if (filteredCollection.features.length === 0) {
        const createdAt = Date.now();
        const emptyMetadata = buildEmptyFeatureMetadata({
          nodeId: params.nodeId,
          originKey,
          dataSource: input.dataSource,
          countryCode: input.countryCode,
          adminLevel: input.adminLevel,
          createdAt,
          recyclingByFeatureId: params.recyclingByFeatureId,
        });
        await shapeMutationAPIImpl.putFeatureMetadata([emptyMetadata]);
        return {
          status: 'completed',
          message: buildSourceFilterReductionSummary(inputSummary),
          metadata: buildSourceDetailMetadata(input, {
            inputFeatureCount: inputSummary.featureCount,
            featureCount: 0,
            inputPolygonCount: inputSummary.polygonCount,
            polygonCount: 0,
            inputPolygonPerFeatureMax: inputSummary.maxPolygonPerFeature,
            polygonPerFeatureMax: 0,
          }),
        };
      }

      const collectionWithOrigin = applyOriginPropertiesToCollection(filteredCollection, originKey);
      const createdAt = Date.now();
      const countryLookup = await getMetadataLookup();
      const featureMetadata = buildSourceFeatureMetadata({
        nodeId: params.nodeId,
        dataSource: input.dataSource,
        collection: collectionWithOrigin,
        createdAt,
        countryLookup,
        recyclingByFeatureId: params.recyclingByFeatureId,
        geometryEngine,
      });
      if (featureMetadata.length > 0) {
        await shapeMutationAPIImpl.putFeatureMetadata(featureMetadata);
      }

      assertNotAborted(params.abortSignal);
      const outputSummary = await summarizeFeatureCollection(collectionWithOrigin, geometryEngine, {
        onFeatureCountProgress,
      });
      const cachedTopology = topojsonTopology({ collection: collectionWithOrigin });
      const encodedTopology = encodeTopoJson(cachedTopology);
      const compressedTopology = await compressGzip(encodedTopology);
      assertNotAborted(params.abortSignal);
      const sourceCacheRecord = await putSourceCache({
        nodeId: params.nodeId,
        sourceKey: input.sourceKey,
        countryCode: input.countryCode,
        adminLevel: input.adminLevel,
        data: compressedTopology,
        format: 'topojson',
        compression: 'gzip',
        featureCount: outputSummary.featureCount,
        inputFeatureCount: inputSummary.featureCount,
        bbox: outputSummary.bbox,
        downloadTime,
        vertexCount: outputSummary.vertexCount,
        polygonCount: outputSummary.polygonCount,
        inputVertexCount: inputSummary.vertexCount,
        inputPolygonCount: inputSummary.polygonCount,
        metadata: buildSourceCacheMetadata({
          status: 'completed',
          dataSource: input.dataSource,
          sourceKey: input.sourceKey,
          countryCode: input.countryCode,
          adminLevel: input.adminLevel,
          featureCount: outputSummary.featureCount,
          inputFeatureCount: inputSummary.featureCount,
          vertexCount: outputSummary.vertexCount,
          polygonCount: outputSummary.polygonCount,
          inputVertexCount: inputSummary.vertexCount,
          inputPolygonCount: inputSummary.polygonCount,
          polygonPerFeatureMax: outputSummary.maxPolygonPerFeature,
          inputPolygonPerFeatureMax: inputSummary.maxPolygonPerFeature,
        }),
      });
      const reductionSummary = [
        formatChangeSummary('features', inputSummary.featureCount, outputSummary.featureCount),
        formatChangeSummary('polygons', inputSummary.polygonCount, outputSummary.polygonCount),
        formatChangeSummary('vertices', inputSummary.vertexCount, outputSummary.vertexCount),
      ].join(', ');

      return {
        status: 'completed',
        message: reductionSummary,
        metadata: buildSourceDetailMetadata(input, {
          inputFeatureCount: inputSummary.featureCount,
          featureCount: outputSummary.featureCount,
          inputPolygonCount: inputSummary.polygonCount,
          polygonCount: outputSummary.polygonCount,
          inputPolygonPerFeatureMax: inputSummary.maxPolygonPerFeature,
          polygonPerFeatureMax: outputSummary.maxPolygonPerFeature,
        }, {
          sourceCacheId: sourceCacheRecord.id,
          sourceCacheFormat: 'topojson',
          sourceCacheCompression: 'gzip',
        }),
        outputData: {
          sourceCacheId: sourceCacheRecord.id,
          sourceArtifactHash: sourceCacheRecord.contentHash,
          featureCount: outputSummary.featureCount,
          vertexCount: outputSummary.vertexCount,
          polygonCount: outputSummary.polygonCount,
        },
      };
    }

    const downloadStart = Date.now();
    const raw = await strategy.fetchData({
      nodeId: params.nodeId,
      country: input.urlCountryCode,
      adminLevel: input.adminLevel,
      endpoint: input.url,
      cacheKeyMode: 'url',
      retryConfig,
      timeout: params.buildConfig.sourceConfig.timeoutMs,
      onRetryAttempt,
    });
    const downloadTime = Date.now() - downloadStart;

    assertNotAborted(params.abortSignal);
    const processed = await strategy.processData(raw, {
      filters: strategy.config.processing.filters,
      transformations: strategy.config.processing.transformations,
      validation: true,
    });
    let collection = buildSourceFeatureCollection(processed, originKey);
    if (shouldMergeGeoBoundaries({
      dataSource: input.dataSource,
      adminLevel: input.adminLevel,
      countryCode: input.urlCountryCode,
    })) {
      collection = mergeGeojsonCollection(collection);
    }
    collection = normalizeGeojsonCollection(collection);
    const inputSummary = await summarizeFeatureCollection(collection, geometryEngine, {
      onFeatureCountProgress,
    });
    const filteredCollection = Number.isFinite(filterZoom)
      ? await filterFetchCollectionByZoom(collection, {
        zTarget: filterZoom!,
        omitDetailsConfig: params.buildConfig.geometryConfig.omitDetailsConfig,
        excludePolygonAreaCoefficient: params.buildConfig.geometryConfig.excludePolygonAreaCoefficient,
        minRingVertices: params.buildConfig.geometryConfig.minRingVertices,
        geometryEngine,
        invalidGeometryFilter,
        onInvalidGeometryCheck: hasInvalidGeometryFilter ? onInvalidGeometryCheck : undefined,
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
        recyclingByFeatureId: params.recyclingByFeatureId,
      });
      await shapeMutationAPIImpl.putFeatureMetadata([emptyMetadata]);
      return {
        status: 'completed',
        message: buildSourceFilterReductionSummary(inputSummary),
        metadata: buildSourceDetailMetadata(input, {
          inputFeatureCount: inputSummary.featureCount,
          featureCount: 0,
          inputPolygonCount: inputSummary.polygonCount,
          polygonCount: 0,
          inputPolygonPerFeatureMax: inputSummary.maxPolygonPerFeature,
          polygonPerFeatureMax: 0,
        }),
      };
    }

    const createdAt = Date.now();
    const countryLookup = await getMetadataLookup();
    const featureMetadata = buildSourceFeatureMetadata({
      nodeId: params.nodeId,
      dataSource: input.dataSource,
      collection: filteredCollection,
      createdAt,
      countryLookup,
      recyclingByFeatureId: params.recyclingByFeatureId,
      geometryEngine,
    });
    if (featureMetadata.length > 0) {
      await shapeMutationAPIImpl.putFeatureMetadata(featureMetadata);
    }

    assertNotAborted(params.abortSignal);
    const { featureCount, vertexCount, polygonCount, maxPolygonPerFeature, bbox } = await summarizeFeatureCollection(filteredCollection, geometryEngine, {
      onFeatureCountProgress,
    });
    const data = await encodeFlatGeobufFromFeatureCollection(filteredCollection);
    assertNotAborted(params.abortSignal);
    const sourceCacheRecord = await putSourceCache({
      nodeId: params.nodeId,
      sourceKey: input.sourceKey,
      countryCode: input.countryCode,
      adminLevel: input.adminLevel,
      data,
      format: 'flatgeobuf',
      compression: 'none',
      featureCount,
      inputFeatureCount: inputSummary.featureCount,
      bbox,
      downloadTime,
      vertexCount,
      polygonCount,
      inputVertexCount: inputSummary.vertexCount,
      inputPolygonCount: inputSummary.polygonCount,
      metadata: buildSourceCacheMetadata({
        status: 'completed',
        dataSource: input.dataSource,
        sourceKey: input.sourceKey,
        countryCode: input.countryCode,
        adminLevel: input.adminLevel,
        featureCount,
        inputFeatureCount: inputSummary.featureCount,
        vertexCount,
        polygonCount,
        inputVertexCount: inputSummary.vertexCount,
        inputPolygonCount: inputSummary.polygonCount,
        polygonPerFeatureMax: maxPolygonPerFeature,
        inputPolygonPerFeatureMax: inputSummary.maxPolygonPerFeature,
      }),
    });
    const reductionSummary = [
      formatChangeSummary('features', inputSummary.featureCount, featureCount),
      formatChangeSummary('polygons', inputSummary.polygonCount, polygonCount),
      formatChangeSummary('vertices', inputSummary.vertexCount, vertexCount),
    ].join(', ');

    return {
      status: 'completed',
      message: reductionSummary,
      metadata: buildSourceDetailMetadata(input, {
        inputFeatureCount: inputSummary.featureCount,
        featureCount,
        inputPolygonCount: inputSummary.polygonCount,
        polygonCount,
        inputPolygonPerFeatureMax: inputSummary.maxPolygonPerFeature,
        polygonPerFeatureMax: maxPolygonPerFeature,
      }, {
        sourceCacheId: sourceCacheRecord.id,
        sourceCacheFormat: 'flatgeobuf',
        sourceCacheCompression: 'none',
      }),
      outputData: {
        sourceCacheId: sourceCacheRecord.id,
        sourceArtifactHash: sourceCacheRecord.contentHash,
        featureCount,
        vertexCount,
        polygonCount,
      },
    };
  };
};

export const runShapeSourceStage = async (params: ShapeSourceStageParams): Promise<void> => {
  const abortSignal = params.abortController?.signal;
  const resumeExistingTasks = Boolean(params.resumeExistingTasks);
  const notifyTasksEnqueued = async (payload: {
    taskCount: number;
    source: 'created' | 'reused';
  }): Promise<void> => {
    if (!params.onTasksEnqueued) return;
    try {
      await params.onTasksEnqueued({
        nodeId: params.nodeId,
        stage: 'source',
        taskCount: payload.taskCount,
        source: payload.source,
      });
    } catch (error) {
      console.warn('[ShapeSource] notify tasks enqueued failed', error);
    }
  };
  if (!resumeExistingTasks) {
    const staleTasks = await listTasksByStage(params.taskQueue, params.nodeId, 'source');
    await deleteTasksByIds(params.taskQueue, staleTasks.map((task) => task.taskId));
  }
  const existingTasks = resumeExistingTasks
    ? await listTasksByStage(params.taskQueue, params.nodeId, 'source')
    : [];
  let metadataForPayloads = params.metadata ?? await metadataLoader.loadMetadata(params.dataSource, params.nodeId);
  let payloads = resolveSourcePayloads(params, metadataForPayloads);
  const selectedAdminPairCount = countSelectedAdminPairs(params.selectedArrayByCountries);
  if (
    payloads.length === 0
    && selectedAdminPairCount > 0
    && (!params.downloadTaskPayloads || params.downloadTaskPayloads.length === 0)
    && !params.metadata
  ) {
    metadataLoader.clearCache(params.dataSource);
    const refreshedMetadata = await metadataLoader.loadMetadata(params.dataSource, params.nodeId, { force: true });
    metadataForPayloads = refreshedMetadata;
    payloads = resolveSourcePayloads(params, metadataForPayloads);
  }
  const reuseExistingTasks = resumeExistingTasks && existingTasks.length > 0 && payloads.length === 0;
  if (payloads.length === 0 && !reuseExistingTasks) {
    if (selectedAdminPairCount > 0) {
      throw new Error(
        `[shape-source] No source tasks generated for ${selectedAdminPairCount}`
        + ' selected entries. Metadata may be stale or incompatible with the selection.',
      );
    }
    setSourcePlannedTotal(params.nodeId, 0);
    await notifyTasksEnqueued({ taskCount: 0, source: 'created' });
    return;
  }
  const configSignature = buildStableSignature(params.buildConfig.sourceConfig ?? null);
  if (!reuseExistingTasks) {
    const tasks = buildSourceTasks(params.nodeId, payloads, metadataForPayloads, configSignature);
    setSourcePlannedTotal(params.nodeId, tasks.length);
    await applyStageTaskReconcile({
      taskQueue: params.taskQueue,
      nodeId: params.nodeId,
      stage: 'source',
      desiredTasks: tasks,
      existingTasks,
      resumeExistingTasks,
    });
    await notifyTasksEnqueued({ taskCount: tasks.length, source: 'created' });
  } else {
    setSourcePlannedTotal(params.nodeId, existingTasks.length);
    await notifyTasksEnqueued({ taskCount: existingTasks.length, source: 'reused' });
  }
  await runStageTasks<ShapeSourceTaskInput, ShapeSourceTaskOutput>({
    nodeId: params.nodeId,
    stageId: 'source-stage',
    capability: 'io',
    handler: createSourceHandler({
      nodeId: params.nodeId,
      buildConfig: params.buildConfig,
      dataSource: params.dataSource,
      recyclingByFeatureId: params.recyclingByFeatureId,
      abortSignal,
    }),
    waitIfPaused: params.waitIfPaused,
    maxConcurrent: params.buildConfig.sourceConfig.maxConcurrent,
    failureHandling: params.failureHandling,
    abortController: params.abortController,
  });
};

const resolveSourcePayloads = (
  params: ShapeSourceStageParams,
  metadata: CountryMetadata[],
): SourceTaskPayload[] => {
  if (params.downloadTaskPayloads && params.downloadTaskPayloads.length > 0) {
    return params.downloadTaskPayloads;
  }
  return generateDownloadTaskPayloadsFromSelection(
    params.dataSource,
    params.selectedArrayByCountries,
    metadata,
  );
};
