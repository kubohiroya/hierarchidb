import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildStage } from './shapeBuildTypes.js';

export type ShapeProcessingState = 'idle' | 'processing' | 'paused' | 'completed' | 'failed';

export interface ShapeProcessingStatus {
  status: ShapeProcessingState;
  lastProcessed?: number;
  totalFeatures?: number;
  totalVectorTiles?: number;
  storageUsed?: number;
  hasErrors: boolean;
  errorMessages: string[];
  stage?: string;
  progress?: number;
  lastUpdated?: number;
  error?: string;
}

export interface ShapeTileLayerInfo {
  name: string;
  featureCount?: number;
  geometryType?: string;
}

export interface ShapeTileInfo {
  exists: boolean;
  size: number;
  features: number;
  layers: ShapeTileLayerInfo[];
  generatedAt: number;
  lastAccessed?: number;
}

export interface ShapeTileSummary {
  tiles: number;
  totalBytes: number;
  zoomMin?: number;
  zoomMax?: number;
}

export interface ShapeTileSummaryEntry {
  z: number;
  x: number;
  y: number;
  size: number;
  timestamp: number;
}

export interface ShapeBuildProgressSummary {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
  stage?: ShapeBuildStage;
}

export interface ShapeBuildSessionSummary {
  nodeId: NodeId;
  status: ShapeProcessingState;
  startedAt?: number;
  updatedAt?: number;
  completedAt?: number;
  progress?: ShapeBuildProgressSummary;
}

export interface ShapeBuildTaskSummary {
  taskId: string;
  version: number;
  nodeId: NodeId;
  stage: ShapeBuildStage;
  stageId?: string;
  status: string;
  index: number;
  progress: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  retryAttempt?: number;
}
