import type { TaskStage } from '@hierarchidb/batch-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { BaseBuildConfig, VectorTileFormat } from '@hierarchidb/gis-sdk';
import type { BuildSessionConfig, ResourceUsage, StageStatus } from '@hierarchidb/shape-store';
import type { DataSourceName } from './data-source.js';

//import type { ObsolateBuildConfig, HybridFilterConfig } from './ObsolateBuildConfig.ts';
//import type { ObsolateBuildConfig } from './ObsolateBuildConfig.ts';
//import type { FeatureFilterMethod, ExtractionMode } from './processing.js';

export interface ShapeBuildConfig extends BaseBuildConfig<DataSourceName> {
  dataSourceName: DataSourceName;
}

export type BuildTaskType = TaskStage;
export type BuildTaskStatus = 'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'paused' | 'regression';

export const BuildTaskResult = {
  WAIT: 'wait',
  PROCESS: 'process',
  SUCCESS: 'success',
  ERROR: 'error',
  PAUSE: 'pause',
  CANCEL: 'cancel',
} as const;

export type BuildTaskResultType = (typeof BuildTaskResult)[keyof typeof BuildTaskResult];

export interface BuildTaskBase {
  taskId: string;
  type: BuildTaskType;
  nodeId: NodeId;
  stage: BuildTaskResultType | undefined;
  status: BuildTaskStatus;
  index: number;
  progress?: number;
  retryCount?: number;
  error?: string;
  message?: string;
}

export type BuildTask = BuildTaskBase;

export interface FetchTask extends BuildTaskBase {
  type: 'fetch';
  url?: string;
  countryCode?: string;
  countryName?: string;
  adminLevel?: number;
}

export type ZipType = 'gzip' | 'bz' | 'br';

/*
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
  extractionMode?: ExtractionMode;
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
*/

export interface VtTaskInput {
  inputBufferId?: string;
  tileZ?: number;
  tileX?: number;
  tileY?: number;
  extent?: number;
  tileSize?: number;
  buffer?: number;
  compression?: boolean;
  format?: VectorTileFormat;
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

export interface VtTask extends BuildTaskBase {
  taskType: 'vt';
}

export interface ProgressInfo {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
  taskType?: BuildTaskType | 'processing';
}


export interface BatchSession {
  nodeId: NodeId;
  draftId?: NodeId;
  status: BuildTaskStatus;
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
    taskType?: BuildTaskType | 'processing';
  };
  canResume?: boolean;
  lastActivity?: number;
  expiresAt?: number;
  stages?: Partial<Record<BuildTaskType, StageStatus>>;
  resourceUsage?: ResourceUsage;
}

export type ShapeBuildCommandMap = {
  'session/pause': { nodeId: NodeId };
  'session/resume': { nodeId: NodeId };
  'stage/pause': { nodeId: NodeId; stage: BuildTaskType };
  'stage/resume': { nodeId: NodeId; stage: BuildTaskType };
};

export type ShapeBuildCommand = keyof ShapeBuildCommandMap;
export type ShapeBuildCommandPayload<K extends ShapeBuildCommand> = ShapeBuildCommandMap[K];


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
  contentEncoding?: ZipType;
  version: number;
}

/*
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
 */

// Backward compatibility aliases
//export type TileExtractConfig = ExtractTaskInput;
