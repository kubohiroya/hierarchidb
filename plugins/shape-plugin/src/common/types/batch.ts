import type { NodeId } from '@hierarchidb/common-types';
import type { BatchConfig, HybridFilterConfig } from './BatchConfig.js';
import type { ProcessingConfig } from './processing.js';
import type { FeatureFilterMethod } from './processing.js';

export interface BatchStatus {
  session: BatchSession;
  currentTasks: BatchTask[];
  queuedTasks: number;
  errors: ErrorInfo[];
  warnings: string[];
  estimatedTimeRemaining?: number;
  throughput?: {
    tasksPerSecond: number;
    bytesPerSecond: number;
  };
}

export const BatchTaskStage = {
  WAIT: 'wait',
  PROCESS: 'process',
  SUCCESS: 'success',
  ERROR: 'error',
  PAUSE: 'pause',
  CANCEL: 'cancel',
} as const;

export type BatchTaskStageType = (typeof BatchTaskStage)[keyof typeof BatchTaskStage];

export type TaskStatus = 'waiting' | 'running' | 'completed' | 'failed' | 'cancelled';

export type BatchTaskType = 'download' | 'simplify1' | 'simplify2' | 'vectortile';
export type ProcessingStage = BatchTaskType;

export interface BatchTaskBase {
  taskId: string;
  taskType: BatchTaskType;
  nodeId?: NodeId;
  sessionId?: string;
  stage?: BatchTaskStageType;
  status?: TaskStatus;
  type?: string;
  index?: number;
  progress?: number;
  startedAt?: number;
  completedAt?: number;
  retryCount?: number;
  metadata?: Record<string, unknown>;
  config?: unknown;
  error?: string;
}

export type BatchTask = BatchTaskBase;

export interface DownloadTaskConfig {
  url?: string;
  dataSource?: string;
  inputBufferId?: string;
  country?: string;
  adminLevel?: number;
  endpoint?: string;
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface DownloadTask extends BatchTaskBase {
  taskType: 'download';
  url?: string;
  countryCode?: string;
  adminLevel?: number;
  fileSize?: number;
  downloadedBytes?: number;
  config?: DownloadTaskConfig;
}

export interface SimplifyTaskConfig {
  inputBufferId?: string;
  tolerance?: number;
  minimumArea?: number;
  zoomLevels?: number[];
  tileSize?: number;
  quantize?: number;
  featureFilterMethod?: FeatureFilterMethod;
  minVertexCountForAreaFilter?: number;
  aspectRatioThreshold?: number;
  hybridFilterConfig?: HybridFilterConfig;
  enablePerFeatureSimplification?: boolean;
}

export interface SimplifyTask extends BatchTaskBase {
  taskType: 'simplify1' | 'simplify2';
  countryCode?: string;
  adminLevel?: number;
  inputBufferId?: string;
  tolerance?: number;
  minArea?: number;
  zoomLevels?: number[];
  tileSize?: number;
  config?: SimplifyTaskConfig;
}

export interface Simplify1Task extends SimplifyTask {
  taskType: 'simplify1';
}

export interface Simplify2Task extends SimplifyTask {
  taskType: 'simplify2';
}

export interface VectorTileTaskConfig {
  inputBufferId?: string;
  minZoom?: number;
  maxZoom?: number;
  tileSize?: number;
  buffer?: number;
  compression?: boolean;
  format?: 'mvt' | 'pbf';
  outputBufferId?: string;
  metadataEnabled?: boolean;
  metadataReplace?: boolean;
  metadataContext?: {
    dataSource?: string;
    countryCode?: string;
    countryName?: string;
    adminLevel?: number;
  };
}

export interface VectorTileTask extends BatchTaskBase {
  taskType: 'vectortile';
  countryCode?: string;
  adminLevel?: number;
  zoomLevel?: number;
  tileCount?: number;
  generatedTiles?: number;
  config?: VectorTileTaskConfig;
}

export interface BatchSession {
  sessionId: string;
  nodeId: NodeId;
  draftId?: NodeId;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  config: BatchConfig | ProcessingConfig;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  progress: {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
    percentage: number;
    currentStage?: ProcessingStage | 'processing';
    currentTask?: string;
  };
  canResume?: boolean;
  lastActivity?: number;
  expiresAt?: number;
  stages?: Partial<Record<ProcessingStage, StageStatus>>;
  resourceUsage?: ResourceUsage;
}

export interface ProgressInfo {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
  currentStage?: ProcessingStage | 'processing';
  currentTask?: string;
}

export type ShapeBatchCommandMap = {
  'session/pause': { sessionId: NodeId };
  'session/resume': { sessionId: NodeId };
  'session/cancel': { sessionId: NodeId };
  'stage/pause': { sessionId: NodeId; stage: ProcessingStage };
  'stage/resume': { sessionId: NodeId; stage: ProcessingStage };
};

export type ShapeBatchCommand = keyof ShapeBatchCommandMap;

export type ShapeBatchCommandPayload<K extends ShapeBatchCommand> = ShapeBatchCommandMap[K];

export interface StageStatus {
  status: TaskStatus;
  progress: number;
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  message?: string;
}

export interface ErrorInfo {
  taskId: string;
  sessionId: string;
  error: string;
  timestamp: number;
  stage: ProcessingStage;
  retryable: boolean;
}

export interface ResourceUsage {
  memoryUsed: number;
  memoryPeak: number;
  cpuPercent: number;
  storageUsed: number;
  networkBytesReceived: number;
  networkBytesSent: number;
}

export type BoundingBox = [number, number, number, number];

export interface LayerConfig {
  name: string;
  fields?: string[];
  minZoom?: number;
  maxZoom?: number;
  properties?: string[];
  simplificationLevel?: number;
}

export interface LayerInfo {
  name: string;
  featureCount: number;
  minZoom: number;
  maxZoom: number;
  fields: string[];
}

export interface TileMetadata {
  exists: boolean;
  nodeId: NodeId;
  tileKey: string;
  z: number;
  x: number;
  y: number;
  size: number;
  features: number;
  layers: LayerInfo[];
  generatedAt: number;
  lastAccessed?: number;
  contentHash: string;
  contentEncoding?: 'gzip' | 'br';
  version: number;
}

export interface CacheStatistics {
  hits: number;
  misses: number;
  sizeBytes?: number;
  totalSize?: number;
  totalItems?: number;
  byType?: Record<string, { totalSize: number; count: number; averageSize: number }>;
  hitRate?: number;
  missRate?: number;
  evictionCount?: number;
  oldestItem?: number;
  newestItem?: number;
}

// Backward compatibility aliases
export type TileSimplifyConfig = SimplifyTaskConfig;
