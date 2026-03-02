import type { NodeId } from '@hierarchidb/core-types';
import type {
  ShapeBuildProgressSummary,
  ShapeGeometryErrorRecord,
} from '@hierarchidb/shape-api';

export type EphemeralDomainType = 'shape' | 'route' | 'tileEmit';

export type BuildStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export type StopReason = 'route-leave' | 'user-pause' | 'failed' | 'completed' | 'unknown';

export type BuildStage = 'source' | 'geometry' | 'tileEmit';

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

export interface EphemeralSourceStageMaxima {
  featureMax: number;
  polygonMax: number;
}

export interface EphemeralBuildSessionRecord {
  nodeId: NodeId;
  domainType?: EphemeralDomainType;
  status: BuildStatus;
  stopReason?: StopReason;
  stage?: BuildStage;
  progress?: ShapeBuildProgressSummary | number;
  selectedArrayByCountries?: Record<string, boolean[]>;
  selectedArrayVersion?: string;
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
  sourceStageMaxima?: EphemeralSourceStageMaxima;
}

/**
 * BuildSessionRecord - Immutable session configuration
 * Stores configuration data that never changes after session creation.
 * Update frequency: Once at creation, never updated
 */
export interface BuildSessionRecord {
  nodeId: NodeId;
  domainType?: EphemeralDomainType;
  selectedArrayByCountries?: Record<string, boolean[]>;
  selectedArrayVersion?: string;
  startedAt: number;
  sourceStageMaxima?: EphemeralSourceStageMaxima;
}

/**
 * BuildSessionHeartbeat - High-frequency heartbeat tracking
 * Stores only the last heartbeat timestamp, updated every 1 second.
 * Update frequency: Every 1 second during active session
 */
export interface BuildSessionHeartbeat {
  nodeId: NodeId;
  lastHeartbeatAt: number;
}

/**
 * BuildSessionStatus - Session-level status tracking
 * Stores session-level status that changes on state transitions.
 * Update frequency: On state transitions (idle → running → paused/completed/failed)
 */
export interface BuildSessionStatus {
  nodeId: NodeId;
  status: BuildStatus;
  stopReason?: StopReason;
  completedAt?: number;
}

/**
 * BuildStageStatus - Per-stage status tracking with history
 * Stores per-stage status, creating a new record for each stage transition.
 * This preserves historical stage information.
 * Update frequency: On stage transitions and stage completion
 * 
 * Note: The `id` field uses format `${nodeId}:${stage}` for efficient current stage lookup.
 * Historical records can be queried using `[nodeId+startedAt]` compound index.
 */
export interface BuildStageStatus {
  id: string;
  nodeId: NodeId;
  stage: BuildStage;
  status: BuildTaskStatus;
  startedAt: number;
  completedAt?: number;
  inactiveMs?: number;
  stageId?: string;
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

export interface EphemeralGeometryErrorRecord extends ShapeGeometryErrorRecord {
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
  sourceCache:
    '&id, nodeId, [nodeId+sourceKey], [nodeId+countryCode+adminLevel]',
  sourceCacheMeta:
    '&id, nodeId, [nodeId+sourceKey], [nodeId+countryCode+adminLevel]',
  geometryCache:
    '&id, nodeId, [nodeId+bandIndex], [nodeId+countryCode+adminLevel], [nodeId+timestamp]',
  geometryCacheMeta:
    '&id, nodeId, [nodeId+bandIndex], [nodeId+countryCode+adminLevel], [nodeId+timestamp]',
  geometryErrors:
    '&id, nodeId',
  tileEmitBufferRelations:
    '&id, nodeId, bufferId, [nodeId+bandIndex], [nodeId+bandIndex+tileId]',
};

export const EPHEMERAL_DB_SCHEMA_V1: Record<string, string> = {
  sessions:
    '&nodeId, status, updatedAt',
  buildTasks:
    '&taskId, nodeId, status, index, stagePriority, sequence'
    + ', [nodeId+status], [nodeId+stage]'
    + ', [nodeId+index], [nodeId+status+index], [nodeId+stage+index], [nodeId+stage+status+index]',
  sourceCache:
    '&id, nodeId, [nodeId+sourceKey], [nodeId+countryCode+adminLevel]',
  sourceCacheMeta:
    '&id, nodeId, [nodeId+sourceKey], [nodeId+countryCode+adminLevel]',
  geometryCache:
    '&id, nodeId, [nodeId+bandIndex], [nodeId+countryCode+adminLevel], [nodeId+timestamp]',
  geometryCacheMeta:
    '&id, nodeId, [nodeId+bandIndex], [nodeId+countryCode+adminLevel], [nodeId+timestamp]',
  geometryErrors:
    '&id, nodeId',
  tileEmitBufferRelations:
    '&id, nodeId, bufferId, [nodeId+bandIndex], [nodeId+bandIndex+tileId]',
};

export const EPHEMERAL_DB_SCHEMA_V2: Record<string, string> = {
  sessions:
    '&nodeId',
  buildTasks:
    '&taskId, nodeId, status, index, stagePriority, sequence'
    + ', [nodeId+status], [nodeId+stage]'
    + ', [nodeId+index], [nodeId+status+index], [nodeId+stage+index], [nodeId+stage+status+index]',
  sourceCache:
    '&id, nodeId, [nodeId+sourceKey], [nodeId+countryCode+adminLevel]',
  sourceCacheMeta:
    '&id, nodeId, [nodeId+sourceKey], [nodeId+countryCode+adminLevel]',
  geometryCache:
    '&id, nodeId, [nodeId+bandIndex], [nodeId+countryCode+adminLevel], [nodeId+timestamp]',
  geometryCacheMeta:
    '&id, nodeId, [nodeId+bandIndex], [nodeId+countryCode+adminLevel], [nodeId+timestamp]',
  geometryErrors:
    '&id, nodeId',
  tileEmitBufferRelations:
    '&id, nodeId, bufferId, [nodeId+bandIndex], [nodeId+bandIndex+tileId]',
};

/**
 * EPHEMERAL_DB_SCHEMA_V3 - Refactored session schema
 * 
 * Changes from V2:
 * - Removed old `sessions` table
 * - Added `buildSessions` table for immutable session configuration
 * - Added `buildSessionHeartbeats` table for high-frequency heartbeat updates
 * - Added `buildSessionStatuses` table for session-level status tracking
 * - Added `buildStageStatuses` table for per-stage status tracking with history
 * 
 * This refactor eliminates data duplication, removes unused fields, reduces
 * serialization overhead, and preserves historical stage information.
 */
export const EPHEMERAL_DB_SCHEMA_V3: Record<string, string> = {
  buildSessions: '&nodeId',
  buildSessionHeartbeats: '&nodeId',
  buildSessionStatuses: '&nodeId, status',
  buildStageStatuses: '&id, nodeId, [nodeId+stage], [nodeId+startedAt]',
  buildTasks:
    '&taskId, nodeId, status, index, stagePriority, sequence'
    + ', [nodeId+status], [nodeId+stage]'
    + ', [nodeId+index], [nodeId+status+index], [nodeId+stage+index], [nodeId+stage+status+index]',
  sourceCache:
    '&id, nodeId, [nodeId+sourceKey], [nodeId+countryCode+adminLevel]',
  sourceCacheMeta:
    '&id, nodeId, [nodeId+sourceKey], [nodeId+countryCode+adminLevel]',
  geometryCache:
    '&id, nodeId, [nodeId+bandIndex], [nodeId+countryCode+adminLevel], [nodeId+timestamp]',
  geometryCacheMeta:
    '&id, nodeId, [nodeId+bandIndex], [nodeId+countryCode+adminLevel], [nodeId+timestamp]',
  geometryErrors:
    '&id, nodeId',
  tileEmitBufferRelations:
    '&id, nodeId, bufferId, [nodeId+bandIndex], [nodeId+bandIndex+tileId]',
};
