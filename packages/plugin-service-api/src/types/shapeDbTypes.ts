import type { NodeId } from '@hierarchidb/common-types';
import type { ShapeBatchProgressSummary, ShapeTileLayerInfo } from './shapeTypes.js';

export interface ShapeBatchSessionRecord<
  Config = unknown,
  Progress = ShapeBatchProgressSummary,
  StageMap = Record<string, unknown>,
  ResourceUsage = Record<string, unknown>
> {
  nodeId: NodeId;
  draftId?: NodeId;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  config: Config;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  progress: Progress;
  stages: StageMap;
  resourceUsage?: ResourceUsage;
  canResume?: boolean;
  lastActivity?: number;
  expiresAt?: number;
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
  tileId: string;
  bufferId: string;
  createdAt: number;
}

export interface ShapeGeojsonVtIndexRecord {
  id: string;
  nodeId: NodeId;
  bufferId: string;
  index: Record<string, unknown>;
  options: {
    extent: number;
    buffer: number;
    indexMaxZoom: number;
    promoteId: string;
  };
  createdAt: number;
}

export interface ShapeEphemeralSessionRecord {
  nodeId: NodeId;
  status?: string;
  stage?: string;
  startTime?: number;
}
