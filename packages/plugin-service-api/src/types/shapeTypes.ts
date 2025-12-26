import type { NodeId } from '@hierarchidb/common-types';

export type ShapeProcessingState =
  | 'idle'
  | 'processing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

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

export interface ShapeBatchProgressSummary {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
  currentStage?: string;
  currentTask?: string;
}

export interface ShapeBatchSessionSummary {
  sessionId: string;
  nodeId: NodeId;
  status: ShapeProcessingState;
  startedAt?: number;
  updatedAt?: number;
  completedAt?: number;
  progress?: ShapeBatchProgressSummary;
}

export interface ShapeBatchTaskSummary {
  taskId: string;
  sessionId: string;
  taskType: string;
  status: string;
  index: number;
  progress: number;
  message?: string;
  startedAt?: number;
  completedAt?: number;
  errorMessage?: string;
}
