import type { TaskQueueRecord } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import { buildStableJsonSignature } from '@hierarchidb/gis-sdk';
import type { DataSourceName } from '~/common/types/index';

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

export class ShapeTaskCacheIdentityContractError extends Error {
  readonly code = 'SHAPE_TASK_CACHE_IDENTITY_CONTRACT_VIOLATION';

  constructor(
    readonly field: string,
    expectation: string
  ) {
    super(`[shape-cache-identity] ${field} ${expectation}`);
    this.name = 'ShapeTaskCacheIdentityContractError';
  }
}

const SHAPE_CACHE_KEY_VERSION = 'v1';
const SHAPE_SOURCE_PIPELINE_VERSION = 'source-v1';
const SHAPE_GEOMETRY_PIPELINE_VERSION = 'geometry-v1';
const SHAPE_TILE_EMIT_PIPELINE_VERSION = 'tile-emit-v1';

const DEFAULT_STAGE_CACHE_NAMESPACE_POLICY: ShapeStageCacheNamespacePolicy = {
  source: 'global',
  geometry: 'node',
  tileEmit: 'node',
};

const DATA_SOURCE_NAMES = new Set<DataSourceName>([
  'naturalearth',
  'geoboundaries',
  'geoboundaries-topojson',
  'gadm',
]);

const contractViolation = (field: string, expectation: string): never => {
  throw new ShapeTaskCacheIdentityContractError(field, expectation);
};

const requireNonEmptyString = (field: string, value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    return contractViolation(field, 'must be a non-empty string without surrounding whitespace');
  }
  return value;
};

const requireOptionalNonEmptyString = (field: string, value: unknown): string | undefined => {
  if (value === undefined) return undefined;
  return requireNonEmptyString(field, value);
};

const requireNodeId = (value: unknown): NodeId => requireNonEmptyString('nodeId', value) as NodeId;

const requireDataSourceName = (value: unknown): DataSourceName => {
  const dataSource = requireNonEmptyString('dataSource', value) as DataSourceName;
  if (!DATA_SOURCE_NAMES.has(dataSource)) {
    return contractViolation('dataSource', 'must be a canonical Shape data source name');
  }
  return dataSource;
};

const requireSourceKey = (value: unknown): string => {
  const sourceKey = requireNonEmptyString('sourceKey', value);
  if (!/^[A-Z]{2}:(0|[1-9]\d*)$/.test(sourceKey)) {
    return contractViolation('sourceKey', 'must use canonical ISO2:adminLevel form');
  }
  return sourceKey;
};

const requireInteger = (
  field: string,
  value: unknown,
  options: { min: number; max?: number }
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    return contractViolation(field, 'must be a finite integer');
  }
  if (value < options.min || (options.max !== undefined && value > options.max)) {
    return contractViolation(
      field,
      options.max === undefined
        ? `must be greater than or equal to ${options.min}`
        : `must be in the inclusive range ${options.min}..${options.max}`
    );
  }
  return value;
};

const requireFiniteNonNegative = (field: string, value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return contractViolation(field, 'must be a finite non-negative number');
  }
  return value;
};

export const requireShapeSourceBaseTolerance = (value: unknown): number =>
  requireFiniteNonNegative('sourceBaseTolerance', value);

const requireZoomRange = (
  bandMinZoomValue: unknown,
  bandMaxZoomValue: unknown
): { bandMinZoom: number; bandMaxZoom: number } => {
  const bandMinZoom = requireInteger('bandMinZoom', bandMinZoomValue, { min: 0 });
  const bandMaxZoom = requireInteger('bandMaxZoom', bandMaxZoomValue, { min: 0 });
  if (bandMinZoom > bandMaxZoom) {
    return contractViolation('bandMinZoom/bandMaxZoom', 'must satisfy bandMinZoom <= bandMaxZoom');
  }
  return { bandMinZoom, bandMaxZoom };
};

const requireSourceUrl = (value: unknown): { endpointId: string; requestSignature: string } => {
  const sourceUrl = requireNonEmptyString('url', value);
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return contractViolation('url', 'must be an absolute URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return contractViolation('url', 'must use the http or https protocol');
  }
  parsed.hash = '';
  return {
    endpointId: `${parsed.origin}${parsed.pathname}`,
    requestSignature: parsed.href,
  };
};

const resolveNamespacePrefix = (nodeIdValue: NodeId, mode: ShapeCacheNamespaceMode): string => {
  const nodeId = requireNodeId(nodeIdValue);
  return mode === 'global' ? 'global' : `node:${String(nodeId)}`;
};

const resolveNamespaceMode = (
  stage: ShapeStage,
  namespacePolicy?: Partial<ShapeStageCacheNamespacePolicy>
): ShapeCacheNamespaceMode => {
  const override = namespacePolicy?.[stage];
  if (override === undefined) {
    return DEFAULT_STAGE_CACHE_NAMESPACE_POLICY[stage];
  }
  if (override !== 'node' && override !== 'global') {
    return contractViolation(`namespacePolicy.${stage}`, 'must be node or global');
  }
  return override;
};

const normalizeBufferIds = (bufferIds: unknown): string[] => {
  if (!Array.isArray(bufferIds)) {
    return contractViolation('bufferIds', 'must be an explicitly present array');
  }
  const validated = bufferIds.map((value, index) =>
    requireNonEmptyString(`bufferIds[${index}]`, value)
  );
  return Array.from(new Set(validated)).sort((a, b) => a.localeCompare(b));
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readPersistedIdentity = (inputData: unknown): ShapeTaskCacheIdentity => {
  const envelope = asRecord(inputData) as CacheIdentityEnvelope | null;
  if (!envelope) {
    return contractViolation('inputData', 'must be an object containing cacheKey and inputHash');
  }
  if (!Object.hasOwn(envelope, 'cacheKey') || !Object.hasOwn(envelope, 'inputHash')) {
    return contractViolation(
      'inputData.cacheKey/inputHash',
      'must be persisted as a complete pair'
    );
  }
  const cacheKey = requireNonEmptyString('inputData.cacheKey', envelope.cacheKey);
  const inputHash = requireNonEmptyString('inputData.inputHash', envelope.inputHash);
  return { cacheKey, inputHash };
};

export const buildSourceTaskCacheIdentity = (params: {
  nodeId: NodeId;
  dataSource: DataSourceName;
  sourceKey: string;
  url: string;
  upstreamRevision?: string;
  configSignature: string;
  namespacePolicy?: Partial<ShapeStageCacheNamespacePolicy>;
}): ShapeTaskCacheIdentity => {
  const namespacePrefix = resolveNamespacePrefix(
    params.nodeId,
    resolveNamespaceMode('source', params.namespacePolicy)
  );
  const dataSource = requireDataSourceName(params.dataSource);
  const sourceKey = requireSourceKey(params.sourceKey);
  const { endpointId: endpoint, requestSignature } = requireSourceUrl(params.url);
  const endpointId = encodeURIComponent(endpoint);
  const upstreamRevision = requireOptionalNonEmptyString(
    'upstreamRevision',
    params.upstreamRevision
  );
  const configSignature = requireNonEmptyString('configSignature', params.configSignature);
  const cacheKey = `${namespacePrefix}:shape:source:${SHAPE_CACHE_KEY_VERSION}:${dataSource}:${sourceKey}:${endpointId}`;
  const inputHash = buildStableJsonSignature({
    requestSignature,
    upstreamRevision: upstreamRevision ?? null,
    fetchOutputShapingSignature: configSignature,
    pipelineVersion: SHAPE_SOURCE_PIPELINE_VERSION,
  });
  return { cacheKey, inputHash };
};

export const buildGeometryTaskCacheIdentity = (params: {
  nodeId: NodeId;
  sourceKey: string;
  bandIndex: number;
  sourceArtifactHash: string;
  sourceBaseTolerance: number;
  bandMinZoom: number;
  bandMaxZoom: number;
  configSignature: string;
  namespacePolicy?: Partial<ShapeStageCacheNamespacePolicy>;
}): ShapeTaskCacheIdentity => {
  const namespacePrefix = resolveNamespacePrefix(
    params.nodeId,
    resolveNamespaceMode('geometry', params.namespacePolicy)
  );
  const sourceKey = requireSourceKey(params.sourceKey);
  const bandIndex = requireInteger('bandIndex', params.bandIndex, { min: 0 });
  const sourceArtifactHash = requireNonEmptyString('sourceArtifactHash', params.sourceArtifactHash);
  const sourceBaseTolerance = requireFiniteNonNegative(
    'sourceBaseTolerance',
    params.sourceBaseTolerance
  );
  const { bandMinZoom, bandMaxZoom } = requireZoomRange(params.bandMinZoom, params.bandMaxZoom);
  const configSignature = requireNonEmptyString('configSignature', params.configSignature);
  const cacheKey = `${namespacePrefix}:shape:geometry:${SHAPE_CACHE_KEY_VERSION}:${sourceKey}:band${bandIndex}`;
  const inputHash = buildStableJsonSignature({
    sourceArtifactHash,
    sourceBaseTolerance,
    bandMinZoom,
    bandMaxZoom,
    geometryConfigSignature: configSignature,
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
  bandMinZoom: number;
  bandMaxZoom: number;
  configSignature: string;
  namespacePolicy?: Partial<ShapeStageCacheNamespacePolicy>;
}): ShapeTaskCacheIdentity => {
  const namespacePrefix = resolveNamespacePrefix(
    params.nodeId,
    resolveNamespaceMode('tileEmit', params.namespacePolicy)
  );
  const bandIndex = requireInteger('bandIndex', params.bandIndex, { min: 0 });
  const zBase = requireInteger('zBase', params.zBase, { min: 0 });
  const tileId = requireInteger('tileId', params.tileId, { min: 0 });
  const { bandMinZoom, bandMaxZoom } = requireZoomRange(params.bandMinZoom, params.bandMaxZoom);
  if (zBase < bandMinZoom || zBase > bandMaxZoom) {
    return contractViolation('zBase', 'must be inside bandMinZoom..bandMaxZoom');
  }
  const configSignature = requireNonEmptyString('configSignature', params.configSignature);
  const cacheKey = `${namespacePrefix}:shape:tileEmit:${SHAPE_CACHE_KEY_VERSION}:band${bandIndex}:z${zBase}:tile${tileId}`;
  const transformArtifactSet = normalizeBufferIds(params.bufferIds);
  const inputHash = buildStableJsonSignature({
    transformArtifactSet,
    bandMinZoom,
    bandMaxZoom,
    tileEmitConfigSignature: configSignature,
    pipelineVersion: SHAPE_TILE_EMIT_PIPELINE_VERSION,
  });
  return { cacheKey, inputHash };
};

export const resolveTaskCacheIdentity = (task: TaskQueueRecord): ShapeTaskCacheIdentity => {
  requireNodeId(task.nodeId);
  if (task.stage !== 'source' && task.stage !== 'geometry' && task.stage !== 'tileEmit') {
    return contractViolation('stage', 'must be source, geometry, or tileEmit');
  }
  return readPersistedIdentity(task.inputData);
};
