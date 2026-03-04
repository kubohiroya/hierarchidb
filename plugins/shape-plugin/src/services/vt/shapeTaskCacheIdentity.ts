import type { TaskQueueRecord } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import { buildStableSignature } from './buildStableSignature.ts';

export type ShapeStage = 'source' | 'geometry' | 'tileEmit';
export type ShapeCacheNamespaceMode = 'node' | 'global';

export type ShapeStageCacheNamespacePolicy = {
  source: ShapeCacheNamespaceMode;
  geometry: ShapeCacheNamespaceMode;
  tileEmit: ShapeCacheNamespaceMode;
};

export type ShapeTaskCacheIdentity = {
  cacheKey: string;
  inputHash: string;
};

type CacheIdentityEnvelope = {
  cacheKey?: unknown;
  inputHash?: unknown;
};

const SHAPE_CACHE_KEY_VERSION = 'v1';
const SHAPE_SOURCE_PIPELINE_VERSION = 'source-v1';
const SHAPE_GEOMETRY_PIPELINE_VERSION = 'geometry-v1';
const SHAPE_TILE_EMIT_PIPELINE_VERSION = 'tile-emit-v1';

const DEFAULT_STAGE_CACHE_NAMESPACE_POLICY: ShapeStageCacheNamespacePolicy = {
  source: 'global',
  geometry: 'node',
  tileEmit: 'node',
};

const normalizeString = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

const normalizeCountryCode = (value: unknown): string => {
  const text = normalizeString(value);
  return text.length > 0 ? text.toUpperCase() : 'XX';
};

const normalizeInteger = (value: unknown, fallback: number): number => (
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
);

const normalizeTolerance = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0) return null;
  return Number(value.toFixed(12));
};

const normalizeEndpointId = (urlLike: unknown): string => {
  const value = normalizeString(urlLike);
  if (!value) return 'endpoint';
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`.toLowerCase();
  } catch {
    return value.toLowerCase();
  }
};

const resolveNamespacePrefix = (
  nodeId: NodeId,
  mode: ShapeCacheNamespaceMode,
): string => (mode === 'global' ? 'global' : `node:${String(nodeId)}`);

const resolveNamespaceMode = (
  stage: ShapeStage,
  namespacePolicy?: Partial<ShapeStageCacheNamespacePolicy>,
): ShapeCacheNamespaceMode => {
  const override = namespacePolicy?.[stage];
  if (override === 'node' || override === 'global') {
    return override;
  }
  return DEFAULT_STAGE_CACHE_NAMESPACE_POLICY[stage];
};

const normalizeBufferIds = (bufferIds: unknown): string[] => {
  if (!Array.isArray(bufferIds)) return [];
  const normalized = bufferIds
    .map((value) => normalizeString(value))
    .filter((value) => value.length > 0);
  return Array.from(new Set(normalized)).sort((a, b) => a.localeCompare(b));
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' ? value as Record<string, unknown> : null
);

const readPersistedIdentity = (inputData: unknown): ShapeTaskCacheIdentity | null => {
  const envelope = asRecord(inputData) as CacheIdentityEnvelope | null;
  const cacheKey = normalizeString(envelope?.cacheKey);
  const inputHash = normalizeString(envelope?.inputHash);
  if (!cacheKey || !inputHash) return null;
  return { cacheKey, inputHash };
};

export const buildSourceTaskCacheIdentity = (params: {
  nodeId: NodeId;
  dataSource: string;
  sourceKey: string;
  url: string;
  upstreamRevision?: string;
  configSignature?: string;
  namespacePolicy?: Partial<ShapeStageCacheNamespacePolicy>;
}): ShapeTaskCacheIdentity => {
  const namespacePrefix = resolveNamespacePrefix(
    params.nodeId,
    resolveNamespaceMode('source', params.namespacePolicy),
  );
  const dataSource = normalizeString(params.dataSource) || 'unknown';
  const sourceKey = normalizeString(params.sourceKey) || 'unknown:0';
  const endpointId = encodeURIComponent(normalizeEndpointId(params.url));
  const cacheKey = `${namespacePrefix}:shape:source:${SHAPE_CACHE_KEY_VERSION}:${dataSource}:${sourceKey}:${endpointId}`;
  const inputHash = buildStableSignature({
    upstreamRevision: normalizeString(params.upstreamRevision) || null,
    fetchOutputShapingSignature: normalizeString(params.configSignature) || null,
    pipelineVersion: SHAPE_SOURCE_PIPELINE_VERSION,
  });
  return { cacheKey, inputHash };
};

export const buildGeometryTaskCacheIdentity = (params: {
  nodeId: NodeId;
  sourceKey: string;
  bandIndex: number;
  sourceArtifactHash: string;
  sourceBaseTolerance?: number;
  bandMinZoom?: number;
  bandMaxZoom?: number;
  configSignature?: string;
  namespacePolicy?: Partial<ShapeStageCacheNamespacePolicy>;
}): ShapeTaskCacheIdentity => {
  const namespacePrefix = resolveNamespacePrefix(
    params.nodeId,
    resolveNamespaceMode('geometry', params.namespacePolicy),
  );
  const sourceKey = normalizeString(params.sourceKey) || 'unknown:0';
  const bandIndex = normalizeInteger(params.bandIndex, 0);
  const cacheKey = `${namespacePrefix}:shape:geometry:${SHAPE_CACHE_KEY_VERSION}:${sourceKey}:band${bandIndex}`;
  const inputHash = buildStableSignature({
    sourceArtifactHash: normalizeString(params.sourceArtifactHash),
    sourceBaseTolerance: normalizeTolerance(params.sourceBaseTolerance),
    bandMinZoom: normalizeInteger(params.bandMinZoom, 0),
    bandMaxZoom: normalizeInteger(params.bandMaxZoom, 0),
    geometryConfigSignature: normalizeString(params.configSignature) || null,
    pipelineVersion: SHAPE_GEOMETRY_PIPELINE_VERSION,
  });
  return { cacheKey, inputHash };
};

export const buildTileEmitTaskCacheIdentity = (params: {
  nodeId: NodeId;
  bandIndex: number;
  zBase: number;
  tileId: number;
  bufferIds: string[];
  bandMinZoom?: number;
  bandMaxZoom?: number;
  configSignature?: string;
  namespacePolicy?: Partial<ShapeStageCacheNamespacePolicy>;
}): ShapeTaskCacheIdentity => {
  const namespacePrefix = resolveNamespacePrefix(
    params.nodeId,
    resolveNamespaceMode('tileEmit', params.namespacePolicy),
  );
  const bandIndex = normalizeInteger(params.bandIndex, 0);
  const zBase = normalizeInteger(params.zBase, 0);
  const tileId = normalizeInteger(params.tileId, 0);
  const cacheKey = `${namespacePrefix}:shape:tileEmit:${SHAPE_CACHE_KEY_VERSION}:band${bandIndex}:z${zBase}:tile${tileId}`;
  const transformArtifactSet = normalizeBufferIds(params.bufferIds);
  const inputHash = buildStableSignature({
    transformArtifactSet,
    bandMinZoom: normalizeInteger(params.bandMinZoom, 0),
    bandMaxZoom: normalizeInteger(params.bandMaxZoom, 0),
    tileEmitConfigSignature: normalizeString(params.configSignature) || null,
    pipelineVersion: SHAPE_TILE_EMIT_PIPELINE_VERSION,
  });
  return { cacheKey, inputHash };
};

export const resolveTaskCacheIdentity = (
  task: TaskQueueRecord,
  namespacePolicy?: Partial<ShapeStageCacheNamespacePolicy>,
): ShapeTaskCacheIdentity => {
  const persisted = readPersistedIdentity(task.inputData);
  if (persisted) {
    return persisted;
  }

  const input = asRecord(task.inputData) ?? {};
  const stage = task.stage;
  if (stage === 'source') {
    return buildSourceTaskCacheIdentity({
      nodeId: task.nodeId,
      dataSource: normalizeString(input.dataSource) || 'unknown',
      sourceKey: normalizeString(input.sourceKey) || `${normalizeCountryCode(input.countryCode)}:${normalizeInteger(input.adminLevel, 0)}`,
      url: normalizeString(input.url),
      upstreamRevision: normalizeString(input.upstreamRevision) || undefined,
      configSignature: normalizeString(input.configSignature) || undefined,
      namespacePolicy,
    });
  }
  if (stage === 'geometry') {
    return buildGeometryTaskCacheIdentity({
      nodeId: task.nodeId,
      sourceKey: normalizeString(input.sourceKey) || `${normalizeCountryCode(input.countryCode)}:${normalizeInteger(input.adminLevel, 0)}`,
      bandIndex: normalizeInteger(input.bandIndex, 0),
      sourceArtifactHash: normalizeString(input.sourceArtifactHash),
      sourceBaseTolerance: typeof input.sourceBaseTolerance === 'number' ? input.sourceBaseTolerance : undefined,
      bandMinZoom: normalizeInteger(input.bandMinZoom, 0),
      bandMaxZoom: normalizeInteger(input.bandMaxZoom, 0),
      configSignature: normalizeString(input.configSignature) || undefined,
      namespacePolicy,
    });
  }
  if (stage === 'tileEmit') {
    return buildTileEmitTaskCacheIdentity({
      nodeId: task.nodeId,
      bandIndex: normalizeInteger(input.bandIndex, 0),
      zBase: normalizeInteger(input.zBase, 0),
      tileId: normalizeInteger(input.tileId, 0),
      bufferIds: normalizeBufferIds(input.bufferIds),
      bandMinZoom: normalizeInteger(input.bandMinZoom, 0),
      bandMaxZoom: normalizeInteger(input.bandMaxZoom, 0),
      configSignature: normalizeString(input.configSignature) || undefined,
      namespacePolicy,
    });
  }
  return {
    cacheKey: `node:${String(task.nodeId)}:shape:legacy:${task.taskId}`,
    inputHash: buildStableSignature(input),
  };
};
