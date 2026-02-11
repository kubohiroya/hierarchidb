import type { NodeId } from '@hierarchidb/core-types';
import type {
  ShapeBuildProgressSummary,
  ShapeBuildTaskPayload,
  ShapeBuildTaskResult,
  ShapeTransformErrorRecord,
} from '@hierarchidb/shape-api';

export type EphemeralDomainType = 'shape' | 'route' | 'vt';

export type BuildStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export type StopReason = 'route-leave' | 'user-pause' | 'failed' | 'completed' | 'unknown';

export type BuildStage = 'fetch' | 'transform' | 'vt';

export type BuildTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'regression';

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

export type EphemeralBuildTaskOutput = ShapeBuildTaskResult | {
  processedPolygons: number;
  totalPolygons: number;
};

export interface EphemeralBuildSessionRecord {
  nodeId: NodeId;
  draftId?: NodeId;
  domainType?: EphemeralDomainType;
  status: BuildStatus;
  stopReason?: StopReason;
  stage?: BuildStage;
  progress?: ShapeBuildProgressSummary | number;
  config?: unknown;
  selectedArrayByCountries?: Record<string, boolean[]>;
  stages?: Record<BuildStage, EphemeralStageStatus>;
  resourceUsage?: unknown;
  startedAt?: number;
  updatedAt?: number;
  completedAt?: number;
  canResume?: boolean;
  lastActivity?: number;
  expiresAt?: number;
  tableId?: string;
  inactiveMs?: number;
  lastHeartbeatAt?: number;
  stageInactiveMs?: number;
  stageStartedAt?: number;
  stageHeartbeatAt?: number;
  stageId?: string;
}

export interface EphemeralBuildTaskRecord {
  taskId: string;
  nodeId: NodeId;
  domainType?: EphemeralDomainType;
  taskType: BuildStage;
  status: BuildTaskStatus;
  index: number;
  stagePriority?: number;
  progress: number;
  display?: TaskDisplayPayload;
  message?: string;
  errorMessage?: string;
  createdAt?: number;
  updatedAt?: number;
  sequence?: number;
  stage?: BuildStage;
  inputData?: ShapeBuildTaskPayload;
  outputData?: EphemeralBuildTaskOutput;
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
  vertexCount?: number;
  polygonCount?: number;
  inputVertexCount?: number;
  inputPolygonCount?: number;
  timestamp: number;
}

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
    '&nodeId, domainType, status, updatedAt'
    + ', [domainType+status], [domainType+updatedAt]',
  buildTasks:
    '&taskId, nodeId, domainType, taskType, status, index, stagePriority, sequence'
    + ', [nodeId+status], [nodeId+taskType], [nodeId+stage], [nodeId+taskType+status], [nodeId+taskType+stagePriority]'
    + ', [nodeId+index], [nodeId+status+index], [nodeId+taskType+index], [nodeId+taskType+status+index]'
    + ', [domainType+status]',
  fetchCache:
    '&id, nodeId, domainType, [nodeId+sourceKey], [nodeId+countryCode+adminLevel]',
  transformCache:
    '&id, nodeId, domainType, [nodeId+bandIndex], [nodeId+countryCode+adminLevel]',
  transformErrors:
    '&id, nodeId, domainType',
  tileIdToBufferRelations:
    '&id, nodeId, domainType, bufferId, [nodeId+bandIndex], [nodeId+bandIndex+tileId]',
};
