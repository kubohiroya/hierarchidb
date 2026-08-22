import type { NodeId } from '@hierarchidb/core-types';

export type ShapeBuildStopReason =
  | 'route-leave'
  | 'user-pause'
  | 'auth-required'
  | 'failed'
  | 'completed'
  | 'unknown';

import type { ShapeBuildProgressSummary, ShapeTileLayerInfo } from './shapeTypes.js';

export interface ShapeSourceStageMaxima {
  featureMax: number;
  polygonMax: number;
  maxPolygonVertexCount?: number;
  baseTolerance?: number;
  vertexLimit?: number;
}

export interface ShapeBuildSessionRecord<
  Progress = ShapeBuildProgressSummary,
  StageMap = Record<string, unknown>,
  ResourceUsage = Record<string, unknown>
> {
  nodeId: NodeId;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  selectedArrayByCountries?: Record<string, boolean[]>;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  progress: Progress;
  stages: StageMap;
  resourceUsage?: ResourceUsage;
  stopReason?: ShapeBuildStopReason;
  canResume?: boolean;
  lastActivity?: number;
  expiresAt?: number;
  inactiveMs?: number;
  lastHeartbeatAt?: number;
  stageInactiveMs?: number;
  stageStartedAt?: number;
  stageHeartbeatAt?: number;
  stageId?: string;
  sourceStageMaxima?: ShapeSourceStageMaxima;
}

export interface ShapeFeatureRecord {
  id: number;
  nodeId: NodeId;
  properties: Record<string, unknown>;
  geometry: unknown;
  bbox?: [number, number, number, number];
  mortonCode?: bigint;
  adminLevel?: number;
  countryCode?: string;
  name?: string;
  nameEn?: string;
  population?: number;
  area?: number;
  extractionLevel?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ShapeVectorTileRecord {
  tileId: string;
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
  data_Uint8Array: Uint8Array;
  size: number;
  features: number;
  layers?: ShapeTileLayerInfo[];
  generatedAt: number;
  lastAccessed?: number;
  contentHash?: string;
  contentEncoding?: string;
  version?: number;
}

export interface ShapeTileIdToBufferRelation {
  id: string;
  nodeId: NodeId;
  bandIndex: number;
  tileId: string;
  bufferId: string;
  featureCount?: number;
  cacheTimestamp?: number;
  createdAt: number;
}

export interface ShapeEphemeralSessionRecord {
  nodeId: NodeId;
  status?: string;
  stage?: string;
  startTime?: number;
}
