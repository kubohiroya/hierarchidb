import type { NodeId } from '@hierarchidb/core-types';
import type {
  ShapeBuildProgressSummary,
  ShapeTransformErrorRecord,
} from '@hierarchidb/shape-api';

export type EphemeralDomainType = 'shape' | 'route' | 'vt';

export type BuildStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export type StopReason = 'route-leave' | 'user-pause' | 'failed' | 'completed' | 'unknown';

export type BuildStage = 'fetch' | 'transform' | 'vt';

export type BuildTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'recycled';

export type TaskDisplayKind = 'phase' | 'summary' | 'skip' | 'error' | 'info';

export type TaskDisplayMetric = {
  input: number;
  output: number;
};

export type TaskDisplayPayload = {
  kind: TaskDisplayKind;
  key?: string;
  params?: Record<string, string | number | boolean>;
  phaseCode?: string;
  phaseState?: 'start' | 'progress' | 'done';
  metrics?: Partial<Record<'features' | 'polygons' | 'vertices', TaskDisplayMetric>>;
};

export interface EphemeralStageStatus {
  status: BuildTaskStatus;
  progress: number;
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  message?: string;
}

export interface EphemeralBuildSessionRecord {
  nodeId: NodeId;
  domainType?: EphemeralDomainType;
  status: BuildStatus;
  stopReason?: StopReason;
  stage?: BuildStage;
  progress?: ShapeBuildProgressSummary | number;
  selectedArrayByCountries?: Record<string, boolean[]>;
  stages?: Record<BuildStage, EphemeralStageStatus>;
  resourceUsage?: unknown;
  startedAt?: number;
  updatedAt?: number;
  completedAt?: number;
  canResume?: boolean;
  lastActivity?: number;
  expiresAt?: number;
  inactiveMs?: number;
  lastHeartbeatAt?: number;
  stageInactiveMs?: number;
  stageStartedAt?: number;
  stageHeartbeatAt?: number;
  stageId?: string;
  elapsedMs?: number;
  elapsedByStage?: Record<string, number>;
}

export interface EphemeralBuildTaskRecord<TInput = unknown, TOutput = unknown> {
  taskId: string;
  nodeId: NodeId;
  domainType?: EphemeralDomainType;
  status: BuildTaskStatus;
  index: number;
  stage: BuildStage;
  stagePriority?: number;
  progress: number;
  display?: TaskDisplayPayload;
  message?: string;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
  createdAt?: number;
  updatedAt?: number;
  inputData?: TInput;
  outputData?: TOutput;
  retryCount?: number;
  startedAt?: number;
  completedAt?: number;
}

export interface EphemeralFetchCacheRecord {
  id: string;
  nodeId: NodeId;
  domainType?: EphemeralDomainType;
  sourceKey: string;
  countryCode?: string;
  adminLevel?: number;
  data: ArrayBuffer;
  format?: 'flatgeobuf' | 'topojson';
  compression?: 'gzip' | 'none';
  featureCount: number;
  inputFeatureCount?: number;
  bbox: [number, number, number, number];
  downloadTime: number;
  size: number;
  contentHash?: string;
  vertexCount?: number;
  polygonCount?: number;
  inputVertexCount?: number;
  inputPolygonCount?: number;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export type EphemeralFetchCacheMetaRecord = Omit<EphemeralFetchCacheRecord, 'data'>;

export interface EphemeralTransformCacheRecord {
  id: string;
  nodeId: NodeId;
  domainType: 'shape' | 'route';
  bandIndex: number;
  sourceKey: string;
  countryCode?: string;
  adminLevel?: number;
  data: ArrayBuffer;
  featureCount: number;
  vertexCount: number;
  polygonCount: number;
  extractionRatio: number;
  tolerance: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface EphemeralTransformCacheMetaRecord {
  id: string;
  nodeId: NodeId;
  domainType: 'shape' | 'route';
  bandIndex: number;
  sourceKey: string;
  countryCode?: string;
  adminLevel?: number;
  featureCount?: number;
  vertexCount?: number;
  polygonCount?: number;
  extractionRatio?: number;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface EphemeralTransformErrorRecord extends ShapeTransformErrorRecord {
  domainType?: EphemeralDomainType;
}

export interface EphemeralTileIdToBufferRelation {
  id: string;
  nodeId: NodeId;
  domainType?: 'shape' | 'route';
  bandIndex: number;
  tileId: string;
  bufferId: string;
  featureCount?: number;
  cacheTimestamp?: number;
  createdAt: number;
}

export const EPHEMERAL_DB_SCHEMA: Record<string, string> = {
  sessions:
    '&nodeId',
  buildTasks:
    '&taskId, nodeId, status, index, stagePriority'
    + ', [nodeId+status], [nodeId+stage]'
    + ', [nodeId+index], [nodeId+status+index], [nodeId+stage+index], [nodeId+stage+status+index]',
  fetchCache:
    '&id, nodeId, [nodeId+sourceKey], [nodeId+countryCode+adminLevel]',
  fetchCacheMeta:
    '&id, nodeId, [nodeId+sourceKey], [nodeId+countryCode+adminLevel]',
  transformCache:
    '&id, nodeId, [nodeId+bandIndex], [nodeId+countryCode+adminLevel], [nodeId+timestamp]',
  transformCacheMeta:
    '&id, nodeId, [nodeId+bandIndex], [nodeId+countryCode+adminLevel], [nodeId+timestamp]',
  transformErrors:
    '&id, nodeId',
  tileIdToBufferRelations:
    '&id, nodeId, bufferId, [nodeId+bandIndex], [nodeId+bandIndex+tileId]',
};

export const EPHEMERAL_DB_SCHEMA_V1: Record<string, string> = {
  sessions:
    '&nodeId, status, updatedAt',
  buildTasks:
    '&taskId, nodeId, status, index, stagePriority, sequence'
    + ', [nodeId+status], [nodeId+stage]'
    + ', [nodeId+index], [nodeId+status+index], [nodeId+stage+index], [nodeId+stage+status+index]',
  fetchCache:
    '&id, nodeId, [nodeId+sourceKey], [nodeId+countryCode+adminLevel]',
  fetchCacheMeta:
    '&id, nodeId, [nodeId+sourceKey], [nodeId+countryCode+adminLevel]',
  transformCache:
    '&id, nodeId, [nodeId+bandIndex], [nodeId+countryCode+adminLevel], [nodeId+timestamp]',
  transformCacheMeta:
    '&id, nodeId, [nodeId+bandIndex], [nodeId+countryCode+adminLevel], [nodeId+timestamp]',
  transformErrors:
    '&id, nodeId',
  tileIdToBufferRelations:
    '&id, nodeId, bufferId, [nodeId+bandIndex], [nodeId+bandIndex+tileId]',
};

export const EPHEMERAL_DB_SCHEMA_V2: Record<string, string> = {
  sessions:
    '&nodeId',
  buildTasks:
    '&taskId, nodeId, status, index, stagePriority, sequence'
    + ', [nodeId+status], [nodeId+stage]'
    + ', [nodeId+index], [nodeId+status+index], [nodeId+stage+index], [nodeId+stage+status+index]',
  fetchCache:
    '&id, nodeId, [nodeId+sourceKey], [nodeId+countryCode+adminLevel]',
  fetchCacheMeta:
    '&id, nodeId, [nodeId+sourceKey], [nodeId+countryCode+adminLevel]',
  transformCache:
    '&id, nodeId, [nodeId+bandIndex], [nodeId+countryCode+adminLevel], [nodeId+timestamp]',
  transformCacheMeta:
    '&id, nodeId, [nodeId+bandIndex], [nodeId+countryCode+adminLevel], [nodeId+timestamp]',
  transformErrors:
    '&id, nodeId',
  tileIdToBufferRelations:
    '&id, nodeId, bufferId, [nodeId+bandIndex], [nodeId+bandIndex+tileId]',
};
