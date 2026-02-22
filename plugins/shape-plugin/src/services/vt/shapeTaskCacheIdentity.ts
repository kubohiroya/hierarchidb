import type { TaskQueueRecord } from '../../../../../packages/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import { buildStableSignature } from './taskSignatures.ts';

export type ShapeStage = 'fetch' | 'transform' | 'vt';
export type ShapeCacheNamespaceMode = 'node' | 'global';

export type ShapeStageCacheNamespacePolicy = {
  fetch: ShapeCacheNamespaceMode;
  transform: ShapeCacheNamespaceMode;
  vt: ShapeCacheNamespaceMode;
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
const SHAPE_FETCH_PIPELINE_VERSION = 'fetch-v1';
const SHAPE_TRANSFORM_PIPELINE_VERSION = 'transform-v1';
const SHAPE_VT_PIPELINE_VERSION = 'vt-v1';

const DEFAULT_STAGE_CACHE_NAMESPACE_POLICY: ShapeStageCacheNamespacePolicy = {
  fetch: 'global',
  transform: 'node',
  vt: 'node',
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

export const buildFetchTaskCacheIdentity = (params: {
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
    resolveNamespaceMode('fetch', params.namespacePolicy),
  );
  const dataSource = normalizeString(params.dataSource) || 'unknown';
  const sourceKey = normalizeString(params.sourceKey) || 'unknown:0';
  const endpointId = encodeURIComponent(normalizeEndpointId(params.url));
  const cacheKey = `${namespacePrefix}:shape:fetch:${SHAPE_CACHE_KEY_VERSION}:${dataSource}:${sourceKey}:${endpointId}`;
  const inputHash = buildStableSignature({
    upstreamRevision: normalizeString(params.upstreamRevision) || null,
    fetchOutputShapingSignature: normalizeString(params.configSignature) || null,
    pipelineVersion: SHAPE_FETCH_PIPELINE_VERSION,
  });
  return { cacheKey, inputHash };
};

export const buildTransformTaskCacheIdentity = (params: {
  nodeId: NodeId;
  sourceKey: string;
  bandIndex: number;
  fetchArtifactHash: string;
  bandMinZoom?: number;
  bandMaxZoom?: number;
  configSignature?: string;
  namespacePolicy?: Partial<ShapeStageCacheNamespacePolicy>;
}): ShapeTaskCacheIdentity => {
  const namespacePrefix = resolveNamespacePrefix(
    params.nodeId,
    resolveNamespaceMode('transform', params.namespacePolicy),
  );
  const sourceKey = normalizeString(params.sourceKey) || 'unknown:0';
  const bandIndex = normalizeInteger(params.bandIndex, 0);
  const cacheKey = `${namespacePrefix}:shape:transform:${SHAPE_CACHE_KEY_VERSION}:${sourceKey}:band${bandIndex}`;
  const inputHash = buildStableSignature({
    fetchArtifactHash: normalizeString(params.fetchArtifactHash),
    bandMinZoom: normalizeInteger(params.bandMinZoom, 0),
    bandMaxZoom: normalizeInteger(params.bandMaxZoom, 0),
    transformConfigSignature: normalizeString(params.configSignature) || null,
    pipelineVersion: SHAPE_TRANSFORM_PIPELINE_VERSION,
  });
  return { cacheKey, inputHash };
};

export const buildVtTaskCacheIdentity = (params: {
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
    resolveNamespaceMode('vt', params.namespacePolicy),
  );
  const bandIndex = normalizeInteger(params.bandIndex, 0);
  const zBase = normalizeInteger(params.zBase, 0);
  const tileId = normalizeInteger(params.tileId, 0);
  const cacheKey = `${namespacePrefix}:shape:vt:${SHAPE_CACHE_KEY_VERSION}:band${bandIndex}:z${zBase}:tile${tileId}`;
  const transformArtifactSet = normalizeBufferIds(params.bufferIds);
  const inputHash = buildStableSignature({
    transformArtifactSet,
    bandMinZoom: normalizeInteger(params.bandMinZoom, 0),
    bandMaxZoom: normalizeInteger(params.bandMaxZoom, 0),
    vtConfigSignature: normalizeString(params.configSignature) || null,
    pipelineVersion: SHAPE_VT_PIPELINE_VERSION,
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
  if (stage === 'fetch') {
    return buildFetchTaskCacheIdentity({
      nodeId: task.nodeId,
      dataSource: normalizeString(input.dataSource) || 'unknown',
      sourceKey: normalizeString(input.sourceKey) || `${normalizeCountryCode(input.countryCode)}:${normalizeInteger(input.adminLevel, 0)}`,
      url: normalizeString(input.url),
      upstreamRevision: normalizeString(input.upstreamRevision) || undefined,
      configSignature: normalizeString(input.configSignature) || undefined,
      namespacePolicy,
    });
  }
  if (stage === 'transform') {
    return buildTransformTaskCacheIdentity({
      nodeId: task.nodeId,
      sourceKey: normalizeString(input.sourceKey) || `${normalizeCountryCode(input.countryCode)}:${normalizeInteger(input.adminLevel, 0)}`,
      bandIndex: normalizeInteger(input.bandIndex, 0),
      fetchArtifactHash: normalizeString(input.fetchArtifactHash),
      bandMinZoom: normalizeInteger(input.bandMinZoom, 0),
      bandMaxZoom: normalizeInteger(input.bandMaxZoom, 0),
      configSignature: normalizeString(input.configSignature) || undefined,
      namespacePolicy,
    });
  }
  if (stage === 'vt') {
    return buildVtTaskCacheIdentity({
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
