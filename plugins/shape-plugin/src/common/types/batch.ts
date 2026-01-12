import type { NodeId } from '@hierarchidb/common-types';
import type { HybridFilterConfig } from './BatchConfig.js';
import type { BuildSessionConfig } from './BatchConfig.js';
import type { DataSourceName } from './data-source.js';
import type { FeatureFilterMethod, Extract2ExtractionMode } from './processing.js';

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

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'regression';

export type BuildTaskType = 'fetch' | 'transform-by-band' | 'transform-by-zoom' | 'vt';
export type ProcessingStage = BuildTaskType;

export interface BatchTaskBase {
  taskId: string;
  type: BuildTaskType;
  nodeId: NodeId;
  stage: BatchTaskStageType|undefined;
  status: TaskStatus;
  index: number;
  progress?: number;
  retryCount?: number;
  error?: string;
  message?: string;
}

export type BatchTask = BatchTaskBase;

export interface DownloadTaskInput {
  url?: string;
  dataSource?: DataSourceName;
  countryCode?: string;
  countryName?: string;
  inputBufferId?: string;
  adminLevel?: number;
  endpoint?: string;
  bbox?: BoundingBox;
  tags?: Array<
    | string
    | {
      key: string;
      value?: string;
      operator?: 'eq' | 'ne' | 'exists' | 'not_exists';
      includeNodes?: boolean;
    }
  >;
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface FetchTask extends BatchTaskBase {
  url?: string;
  type: 'fetch';
  dataSource?: DataSourceName;
  countryCode?: string;
  adminLevel?: number;
  fileSize?: number;
  downloadedBytes?: number;
}

export interface ExtractTaskInput {
  inputBufferId?: string;
  sourceUrl?: string;
  sourceTaskId?: string;
  featureId?: string;
  featureLabel?: string;
  featureGroupId?: string;
  adminCode?: string;
  featureIndex?: number;
  originKey?: string;
  originLabel?: string;
  dataSource?: DataSourceName;
  countryCode?: string;
  adminLevel?: number;
  continent?: string;
  countryName?: string;
  tolerance?: number;
  minimumArea?: number;
  zoomLevels?: number[];
  zoomRange?: [number, number];
  zoomRangeLabel?: string;
  tileSize?: number;
  quantize?: number;
  featureFilterMethod?: FeatureFilterMethod;
  minVertexCountForAreaFilter?: number;
  aspectRatioThreshold?: number;
  hybridFilterConfig?: HybridFilterConfig;
  enableFeatureFiltering?: boolean;
  enablePerFeatureExtraction?: boolean;
  preserveSharedBoundaries?: boolean;
  extractionMode?: Extract2ExtractionMode;
  retry?: number;
}

export interface ExtractTask extends BatchTaskBase {
  taskType: 'extract1' | 'extract2';
  countryCode?: string;
  countryName?: string;
  continent?: string;
  adminLevel?: number;
  adminCode?: string;
  inputBufferId?: string;
}

export interface Extract1Task extends ExtractTask {
  taskType: 'extract1';
}

export interface Extract2Task extends ExtractTask {
  taskType: 'extract2';
}

export interface VectorTileTaskInput {
  inputBufferId?: string;
  tileZ?: number;
  tileX?: number;
  tileY?: number;
  extent?: number;
  tileSize?: number;
  buffer?: number;
  compression?: boolean;
  format?: 'mvt' | 'pbf';
  layers?: unknown[];
  outputBufferId?: string;
  dataSource?: DataSourceName;
  countryCode?: string;
  countryName?: string;
  adminLevel?: number;
  metadataEnabled?: boolean;
  metadataReplace?: boolean;
  retry?: number;
}

export interface VectorTileTask extends BatchTaskBase {
  taskType: 'vectortile';
}

export interface BatchSession {
  nodeId: NodeId;
  draftId?: NodeId;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  config: BuildSessionConfig;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  progress: {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
    percentage: number;
    taskType?: ProcessingStage | 'processing';
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
  taskType?: ProcessingStage | 'processing';
}

export type ShapeBuildCommandMap = {
  'session/pause': { nodeId: NodeId };
  'session/resume': { nodeId: NodeId };
  'stage/pause': { nodeId: NodeId; stage: ProcessingStage };
  'stage/resume': { nodeId: NodeId; stage: ProcessingStage };
};

export type ShapeBuildCommand = keyof ShapeBuildCommandMap;

export type ShapeBuildCommandPayload<K extends ShapeBuildCommand> = ShapeBuildCommandMap[K];

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
  nodeId: NodeId;
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
  extractionLevel?: number;
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
export type TileExtractConfig = ExtractTaskInput;
