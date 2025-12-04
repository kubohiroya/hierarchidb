import type { NodeId } from './core.js';
import type { ProcessingConfig } from './processing.js';

export type BatchStatus =
  | 'preparing'
  | 'downloading'
  | 'processing'
  | 'generating'
  | 'completed'
  | 'error'
  | 'cancelled';

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
  sessionId?: NodeId;
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
  zoomLevels?: number[];
  tileSize?: number;
  compression?: boolean;
  format?: 'mvt' | 'pbf';
  outputBufferId?: string;
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
  draftId: NodeId;
  nodeId: NodeId;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  config: ProcessingConfig;
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
  canResume: boolean;
  lastActivity: number;
  expiresAt: number;
  stages: Record<string, any>;
  resourceUsage?: any;
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

// Backward compatibility aliases
export type TileSimplifyConfig = SimplifyTaskConfig;
