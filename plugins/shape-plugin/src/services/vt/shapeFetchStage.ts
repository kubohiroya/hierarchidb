import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { ISO2, NodeId } from '@hierarchidb/core-types';
import { encodeFlatGeobufFromFeatureCollection, geometryBbox, type GeometryEngine } from '@hierarchidb/gis-sdk';
import type { StageHandler, TaskQueueRecord } from '@hierarchidb/batch-api';
import { NobleSha3HashPort } from '@hierarchidb/chunk-store';
import type { ShapeRuntimeBuildConfig } from '../../common/types/index.js';
import {
  type VtTaskQueueDb,
  deleteTasksByIds,
  listTasksByStage,
  putTasks,
  runStageTasks,
} from '@hierarchidb/vt-orchestrator';
import { ephemeralShapeDB } from '@hierarchidb/gis-sdk';
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
  FetchTaskPayload,
  SelectedArrayByCountries,
  ShapeFeaturePayload,
} from '../../common/types/index.js';
import { generateDownloadTaskPayloadsFromSelection } from '../utils/utils.js';
import { metadataLoader } from '../metadata/MetadataLoader.js';
import { DataSourceStrategyFactory } from '../datasources/DataSourceStrategyFactory.js';
import { resolveStrategyIdFromDataSource } from '../datasources/strategyIds.js';
import type { RetryConfig } from '../datasources/DataSourceStrategy.js';
import type { Topology } from 'topojson-specification';
import { feature as topojsonFeature, merge as topojsonMerge } from 'topojson-client';
import { topology as topojsonTopology } from 'topojson-server';
import { shapeMutationAPIImpl } from '../batch/ShapeBuildAPIClient.ts';
import {
  buildFeatureId,
  extractGeometryStats,
  measureFeatureGeoJsonByteSize,
  resolveAdminHierarchyFields,
} from './featureMetadataUtils.ts';
import { filterFetchCollectionByZoom } from './fetchGeometryFilters.ts';
import { buildZoomBandRanges } from '@hierarchidb/util';
import { buildStableSignature } from './taskSignatures.ts';
import { reconcileStageTasksByMetadata } from './shapeStageReconcile.ts';
import {
  buildRawDataDataSourceCacheKey,
  buildShapeCacheKey,
  createShapeChunkStore,
  getOrFetchWithRetry,
  jsonDeserializer,
  jsonSerializer,
} from '../utils/chunkStore.js';
import { fetchRawDataWithPipeline } from '../utils/rawDataPipeline.js';
import { buildGeoBoundariesMetadataUrl } from '../utils/geoboundariesEndpoints.js';
import type { GeoBoundariesApiResponse } from '../datasources/GeoBoundariesStrategy.js';
import { setFetchPlannedTotal } from './shapeProgressPlan.ts';
import { buildFetchTaskCacheIdentity } from './shapeTaskCacheIdentity.ts';

export type ShapeFetchTaskInput = {
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

export type ShapeFetchTaskOutput = {
  fetchCacheId?: string;
  fetchArtifactHash?: string;
  featureCount?: number;
  vertexCount?: number;
  polygonCount?: number;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8');
const FETCH_ARTIFACT_HASH_ALGORITHM = 'sha3-256' as const;
const fetchArtifactHasher = new NobleSha3HashPort();

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
  const merged = topojsonMerge(topology, geometries as unknown as Parameters<typeof topojsonMerge>[1]);
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

export type ShapeFetchStageParams = {
  nodeId: NodeId;
  dataSource: DataSourceName;
  selectedArrayByCountries?: SelectedArrayByCountries;
  downloadTaskPayloads?: FetchTaskPayload[];
  buildConfig: ShapeRuntimeBuildConfig;
  taskQueue: VtTaskQueueDb;
  metadata?: CountryMetadata[];
  recyclingByFeatureId?: Map<string, boolean>;
  waitIfPaused?: () => Promise<void>;
  resumeExistingTasks?: boolean;
  abortController?: AbortController;
  failureHandling?: 'continue' | 'stop' | 'skip';
};

const buildRetryConfig = (config: ShapeRuntimeBuildConfig): RetryConfig => {
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

const fetchGeoBoundariesApiData = async (params: {
  nodeId: NodeId;
  country: string;
  adminLevel: number;
  signal?: AbortSignal;
  cacheKeyMode: 'url' | 'legacy';
  retryConfig?: RetryConfig;
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

const buildShapeFetchTaskId = (nodeId: NodeId, sourceKey: string): string => (
  `${String(nodeId)}:fetch:${sourceKey}`
);

const buildFetchCacheId = (nodeId: NodeId, sourceKey: string): string => (
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

const buildFetchFilterReductionSummary = (inputSummary: {
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

const decodeFetchCacheData = async (params: {
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

const hashFetchArtifact = (data: ArrayBuffer): string => (
  fetchArtifactHasher.digest(data, FETCH_ARTIFACT_HASH_ALGORITHM)
);

const putFetchCache = async (params: {
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
}): Promise<{ id: string; contentHash: string }> => {
  const recordId = buildFetchCacheId(params.nodeId, params.sourceKey);
  const contentHash = hashFetchArtifact(params.data);
  await ephemeralShapeDB.transaction('rw', ephemeralShapeDB.fetchCache, async () => {
    await ephemeralShapeDB.fetchCache.put({
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
      contentHash,
      timestamp: Date.now(),
    });
  });
  return { id: recordId, contentHash };
};

const buildFetchFeatureCollection = (
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

const buildFetchFeatureMetadata = (params: {
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

const summarizeFeatureCollection = (
  collection: FeatureCollection,
  geometryEngine: GeometryEngine,
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
  {
    const bounds = geometryBbox(collection, geometryEngine);
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
  configSignature: string,
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
    const cacheIdentity = buildFetchTaskCacheIdentity({
      nodeId,
      dataSource: payload.dataSource,
      sourceKey,
      url: payload.url,
      upstreamRevision: payload.upstreamRevision,
      configSignature,
    });
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

const createFetchHandler = (params: {
  nodeId: NodeId;
  buildConfig: ShapeRuntimeBuildConfig;
  dataSource: DataSourceName;
  recyclingByFeatureId?: Map<string, boolean>;
  abortSignal?: AbortSignal;
}): StageHandler<ShapeFetchTaskInput, ShapeFetchTaskOutput> => {
  const factory = new DataSourceStrategyFactory();
  const geometryEngine: GeometryEngine = params.buildConfig.transformConfig.geometryEngine ?? 'turf';
  const isTopoJsonSource = params.dataSource === 'geoboundaries-topojson';
  const strategySource = isTopoJsonSource ? 'geoboundaries' : params.dataSource;
  const strategyId = resolveStrategyIdFromDataSource(strategySource);
  if (!strategyId) {
    throw new Error(`[shape-fetch] Unsupported data source: ${params.dataSource}`);
  }
  const strategy = factory.create(strategyId);
  const retryConfig = buildRetryConfig(params.buildConfig);
  let metadataLookupPromise: Promise<Map<string, CountryMetadata>> | null = null;
  const getMetadataLookup = async (): Promise<Map<string, CountryMetadata>> => {
    if (!metadataLookupPromise) {
      metadataLookupPromise = metadataLoader
        .loadMetadata(params.dataSource, params.nodeId)
        .then((metadata) => buildCountryLookup(metadata));
    }
    return metadataLookupPromise;
  };

  return async (task) => {
    const input = task.inputData;
    if (!input) {
      return { status: 'failed', errorMessage: 'fetch task input is missing' };
    }

    assertNotAborted(params.abortSignal);
    const existing = await getFetchCache(params.nodeId, input.sourceKey);
    if (existing) {
      const createdAt = Date.now();
      let fetchArtifactHash = typeof existing.contentHash === 'string' && existing.contentHash.length > 0
        ? existing.contentHash
        : hashFetchArtifact(existing.data);
      if (existing.contentHash !== fetchArtifactHash) {
        await ephemeralShapeDB.fetchCache.update(existing.id, { contentHash: fetchArtifactHash });
      }
      const cachedCollection = await decodeFetchCacheData({
        data: existing.data,
        format: existing.format,
        compression: existing.compression,
      });
      if (cachedCollection && cachedCollection.features.length > 0) {
        const hasMissingFeatureIds = cachedCollection.features.some((feature) => {
          const props = feature?.properties as Record<string, unknown> | undefined;
          return typeof props?.__hdbFeatureId !== 'string' || props.__hdbFeatureId.length === 0;
        });
        const countryLookup = await getMetadataLookup();
        const cachedMetadata = buildFetchFeatureMetadata({
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
            fetchArtifactHash = hashFetchArtifact(data);
            await ephemeralShapeDB.transaction('rw', ephemeralShapeDB.fetchCache, async () => {
              await ephemeralShapeDB.fetchCache.update(existing.id, {
                data,
                size: data.byteLength,
                contentHash: fetchArtifactHash,
                timestamp: Date.now(),
              });
            });
          }
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
        message: `reused: fetch cache exists (${cachedSummary})`,
        outputData: {
          fetchCacheId: existing.id,
          fetchArtifactHash,
          featureCount: existing.featureCount,
          vertexCount: cachedVertexCount,
        },
      };
    }

    assertNotAborted(params.abortSignal);
    const originKey = buildOriginKey(input.dataSource, input.sourceKey);
    const zoomRanges = buildZoomBandRanges(params.buildConfig.transformConfig.zoomBandBoundaries);
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
        timeoutMs: params.buildConfig.fetchConfig.timeoutMs,
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
      const inputSummary = summarizeFeatureCollection(baseCollection, geometryEngine);
      const filteredCollection = Number.isFinite(filterZoom)
        ? filterFetchCollectionByZoom(baseCollection, {
          zTarget: filterZoom!,
          omitDetailsConfig: params.buildConfig.transformConfig.omitDetailsConfig,
          excludePolygonAreaCoefficient: params.buildConfig.transformConfig.excludePolygonAreaCoefficient,
          minRingVertices: params.buildConfig.transformConfig.minRingVertices,
          geometryEngine,
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
          message: buildFetchFilterReductionSummary(inputSummary),
        };
      }

      const collectionWithOrigin = applyOriginPropertiesToCollection(filteredCollection, originKey);
      const createdAt = Date.now();
      const countryLookup = await getMetadataLookup();
      const featureMetadata = buildFetchFeatureMetadata({
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
      const outputSummary = summarizeFeatureCollection(collectionWithOrigin, geometryEngine);
      const cachedTopology = topojsonTopology({ collection: collectionWithOrigin });
      const encodedTopology = encodeTopoJson(cachedTopology);
      const compressedTopology = await compressGzip(encodedTopology);
      assertNotAborted(params.abortSignal);
      const fetchCacheRecord = await putFetchCache({
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
      });
      const reductionSummary = [
        formatChangeSummary('features', inputSummary.featureCount, outputSummary.featureCount),
        formatChangeSummary('polygons', inputSummary.polygonCount, outputSummary.polygonCount),
        formatChangeSummary('vertices', inputSummary.vertexCount, outputSummary.vertexCount),
      ].join(', ');

      return {
        status: 'completed',
        message: reductionSummary,
        outputData: {
          fetchCacheId: fetchCacheRecord.id,
          fetchArtifactHash: fetchCacheRecord.contentHash,
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
      timeout: params.buildConfig.fetchConfig.timeoutMs,
    });
    const downloadTime = Date.now() - downloadStart;

    assertNotAborted(params.abortSignal);
    const processed = await strategy.processData(raw, {
      filters: strategy.config.processing.filters,
      transformations: strategy.config.processing.transformations,
      validation: true,
    });
    let collection = buildFetchFeatureCollection(processed, originKey);
    if (shouldMergeGeoBoundaries({
      dataSource: input.dataSource,
      adminLevel: input.adminLevel,
      countryCode: input.urlCountryCode,
    })) {
      collection = mergeGeojsonCollection(collection);
    }
    collection = normalizeGeojsonCollection(collection);
    const inputSummary = summarizeFeatureCollection(collection, geometryEngine);
    const filteredCollection = Number.isFinite(filterZoom)
      ? filterFetchCollectionByZoom(collection, {
        zTarget: filterZoom!,
        omitDetailsConfig: params.buildConfig.transformConfig.omitDetailsConfig,
        excludePolygonAreaCoefficient: params.buildConfig.transformConfig.excludePolygonAreaCoefficient,
        minRingVertices: params.buildConfig.transformConfig.minRingVertices,
        geometryEngine,
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
        message: buildFetchFilterReductionSummary(inputSummary),
      };
    }

    const createdAt = Date.now();
    const countryLookup = await getMetadataLookup();
    const featureMetadata = buildFetchFeatureMetadata({
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
    const { featureCount, vertexCount, polygonCount, bbox } = summarizeFeatureCollection(filteredCollection, geometryEngine);
    const data = await encodeFlatGeobufFromFeatureCollection(filteredCollection);
    assertNotAborted(params.abortSignal);
    const fetchCacheRecord = await putFetchCache({
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
    });
    const reductionSummary = [
      formatChangeSummary('features', inputSummary.featureCount, featureCount),
      formatChangeSummary('polygons', inputSummary.polygonCount, polygonCount),
      formatChangeSummary('vertices', inputSummary.vertexCount, vertexCount),
    ].join(', ');

    return {
      status: 'completed',
      message: reductionSummary,
      outputData: {
        fetchCacheId: fetchCacheRecord.id,
        fetchArtifactHash: fetchCacheRecord.contentHash,
        featureCount,
        vertexCount,
        polygonCount,
      },
    };
  };
};

export const runShapeFetchStage = async (params: ShapeFetchStageParams): Promise<void> => {
  const abortSignal = params.abortController?.signal;
  const resumeExistingTasks = Boolean(params.resumeExistingTasks);
  const countSelectedAdminPairs = (selectedArrayByCountries: SelectedArrayByCountries | undefined): number => {
    if (!selectedArrayByCountries || typeof selectedArrayByCountries !== 'object' || Array.isArray(selectedArrayByCountries)) {
      return 0;
    }
    let selectedAdminPairCount = 0;
    Object.values(selectedArrayByCountries).forEach((row) => {
      if (!Array.isArray(row)) return;
      row.forEach((selected) => {
        if (selected === true) {
          selectedAdminPairCount += 1;
        }
      });
    });
    return selectedAdminPairCount;
  };
  if (!resumeExistingTasks) {
    const staleTasks = await listTasksByStage(params.taskQueue, params.nodeId, 'fetch');
    await deleteTasksByIds(params.taskQueue, staleTasks.map((task) => task.taskId));
  }
  const existingTasks = resumeExistingTasks
    ? await listTasksByStage(params.taskQueue, params.nodeId, 'fetch')
    : [];
  let metadataForPayloads = params.metadata ?? await metadataLoader.loadMetadata(params.dataSource, params.nodeId);
  let payloads = resolveFetchPayloads(params, metadataForPayloads);
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
    payloads = resolveFetchPayloads(params, metadataForPayloads);
  }
  const reuseExistingTasks = resumeExistingTasks && existingTasks.length > 0 && payloads.length === 0;
  if (payloads.length === 0 && !reuseExistingTasks) {
    if (selectedAdminPairCount > 0) {
      throw new Error(
        `[shape-fetch] No fetch tasks generated for ${selectedAdminPairCount}`
        + ' selected entries. Metadata may be stale or incompatible with the selection.',
      );
    }
    setFetchPlannedTotal(params.nodeId, 0);
    return;
  }
  const configSignature = buildStableSignature(params.buildConfig.fetchConfig ?? null);
  if (!reuseExistingTasks) {
    const tasks = buildFetchTasks(params.nodeId, payloads, metadataForPayloads, configSignature);
    setFetchPlannedTotal(params.nodeId, tasks.length);
    await reconcileFetchTasks(params, existingTasks, tasks, resumeExistingTasks);
  } else {
    setFetchPlannedTotal(params.nodeId, existingTasks.length);
  }
  await runStageTasks({
    nodeId: params.nodeId,
    stage: 'fetch',
    handler: createFetchHandler({
      nodeId: params.nodeId,
      buildConfig: params.buildConfig,
      dataSource: params.dataSource,
      recyclingByFeatureId: params.recyclingByFeatureId,
      abortSignal,
    }),
    waitIfPaused: params.waitIfPaused,
    maxConcurrent: params.buildConfig.fetchConfig.maxConcurrent,
    failureHandling: params.failureHandling,
    abortController: params.abortController,
  });
};

const resolveFetchPayloads = (
  params: ShapeFetchStageParams,
  metadata: CountryMetadata[],
): FetchTaskPayload[] => {
  if (params.downloadTaskPayloads && params.downloadTaskPayloads.length > 0) {
    return params.downloadTaskPayloads;
  }
  return generateDownloadTaskPayloadsFromSelection(
    params.dataSource,
    params.selectedArrayByCountries,
    metadata,
  );
};

const reconcileFetchTasks = async (
  params: ShapeFetchStageParams,
  existingTasks: TaskQueueRecord[],
  desiredTasks: TaskQueueRecord[],
  resumeExistingTasks: boolean,
): Promise<void> => {
  if (!resumeExistingTasks) {
    await putTasks(params.taskQueue, desiredTasks);
    return;
  }
  const { missingTasks, obsoleteTaskIds } = reconcileStageTasksByMetadata(desiredTasks, existingTasks);
  if (obsoleteTaskIds.length > 0) {
    await deleteTasksByIds(params.taskQueue, obsoleteTaskIds);
  }
  if (missingTasks.length > 0) {
    await putTasks(params.taskQueue, missingTasks);
  }
};
