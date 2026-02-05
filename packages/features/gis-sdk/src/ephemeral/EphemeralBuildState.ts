import type { NodeId } from '@hierarchidb/core-types';

export type EphemeralDomainType = 'shape' | 'route' | 'vt';

export type BuildStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export type StopReason = 'route-leave' | 'user-pause' | 'failed' | 'completed' | 'unknown';

export type BuildStage = 'fetch' | 'transform' | 'vt';

export type BuildTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'regression';

export interface EphemeralBuildSessionRecord {
  nodeId: NodeId;
  domainType?: EphemeralDomainType;
  status: BuildStatus;
  stopReason?: StopReason;
  stage?: BuildStage;
  progress?: number;
  startedAt?: number;
  updatedAt?: number;
  completedAt?: number;
  canResume?: boolean;
  lastActivity?: number;
  expiresAt?: number;
  tableId?: string;
}

export interface EphemeralBuildTaskRecord {
  taskId: string;
  nodeId: NodeId;
  domainType?: EphemeralDomainType;
  taskType: BuildStage;
  status: BuildTaskStatus;
  index?: number;
  stagePriority?: number;
  progress?: number;
  message?: string;
  errorMessage?: string;
  createdAt?: number;
  updatedAt?: number;
  sequence?: number;
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
  domainType?: EphemeralDomainType;
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

export interface EphemeralTransformErrorRecord {
  id: string;
  nodeId: NodeId;
  domainType?: EphemeralDomainType;
  stage?: BuildStage;
  message?: string;
  createdAt?: number;
}

export interface EphemeralTileIdToBufferRelation {
  id: string;
  nodeId: NodeId;
  domainType?: EphemeralDomainType;
  bandIndex: number;
  tileId: string;
  bufferId: string;
  createdAt: number;
}

export const EPHEMERAL_DB_SCHEMA: Record<string, string> = {
  sessions:
    '&nodeId, domainType, status, updatedAt'
    + ', [domainType+status], [domainType+updatedAt]',
  buildTasks:
    '&taskId, nodeId, domainType, taskType, status, index, stagePriority, sequence'
    + ', [nodeId+status], [nodeId+taskType], [nodeId+taskType+status], [nodeId+taskType+stagePriority]'
    + ', [domainType+status]',
  fetchCache:
    '&id, nodeId, domainType, [nodeId+sourceKey], [nodeId+countryCode+adminLevel]',
  transformCache:
    '&id, nodeId, domainType, [nodeId+bandIndex], [nodeId+countryCode+adminLevel]',
  transformErrors:
    '&id, nodeId, domainType',
  tileIdToBufferRelations:
    '&id, nodeId, domainType, bufferId, [nodeId+bandIndex], [nodeId+bandIndex+tileId]',
  vtTaskQueue:
    '&taskId, nodeId, domainType, stage, status, index, stagePriority, sequence'
    + ', [nodeId+stage], [nodeId+status], [nodeId+stage+status], [nodeId+stage+stagePriority]',
};
