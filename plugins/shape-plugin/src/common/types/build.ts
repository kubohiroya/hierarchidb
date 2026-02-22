import type { TaskDisplayPayload, TaskStage } from '../../../../../packages/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type {
  BaseBuildConfig,
  CleanupConfig,
  DynamicConcurrencyConfig,
  FetchConfig,
  TransformConfig,
  VectorTileFormat,
  VTConfig,
} from '@hierarchidb/gis-sdk';
import type { BuildSessionConfig, ResourceUsage, StageStatus } from '@hierarchidb/shape-store';
import type { DataSourceName } from './data-source.js';

//import type { ObsolateBuildConfig, HybridFilterConfig } from './ObsolateBuildConfig.ts';
//import type { ObsolateBuildConfig } from './ObsolateBuildConfig.ts';
//import type { FeatureFilterMethod, ExtractionMode } from './processing.js';

export type ShapeBuildFetchConfig = Omit<
  FetchConfig,
  'maxConcurrent' | 'retryAttempts' | 'retryDelay' | 'retryLimit' | 'retryBackoff'
>;
export type ShapeBuildTransformConfig = Omit<TransformConfig, 'maxConcurrent'>;
export type ShapeBuildVtConfig = Omit<VTConfig, 'maxConcurrent' | 'dynamicConcurrency'>;

export type ShapeUrlMatchType = 'default' | 'regexp' | 'prefix';

export interface ShapeBuildUrlRule {
  key?: string;
  matchType: ShapeUrlMatchType;
  pattern?: string;
  buildConfig?: ShapeBuildUrlConfigPatch;
  enabled?: boolean;
}

export type ShapeBuildUrlConfigPatch = Omit<Partial<ShapeBuildConfig>, 'urlBuildConfigRules'>;

export interface ShapeBuildConfig {
  dataSourceName: DataSourceName;
  fetchConfig: ShapeBuildFetchConfig;
  transformConfig: ShapeBuildTransformConfig;
  vtConfig: ShapeBuildVtConfig;
  cleanupConfig?: CleanupConfig;
  urlBuildConfigRules?: ShapeBuildUrlRule[];
}

export interface ShapeProcessingConfig {
  fetch: Pick<
    FetchConfig,
    'maxConcurrent' | 'retryAttempts' | 'retryDelay' | 'retryLimit' | 'retryBackoff'
  >;
  transform: {
    maxConcurrent: number;
  };
  vt: {
    maxConcurrent: number;
    dynamicConcurrency?: DynamicConcurrencyConfig;
  };
}

export type ShapeRuntimeBuildConfig = BaseBuildConfig<DataSourceName>;

export type BuildTaskType = TaskStage;
export type BuildTaskStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'recycled';

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
  display?: TaskDisplayPayload;
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
}

export interface BuildSession {
  nodeId: NodeId;
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
  };
  canResume?: boolean;
  lastActivity?: number;
  expiresAt?: number;
  inactiveMs?: number;
  lastHeartbeatAt?: number;
  stageInactiveMs?: number;
  stageStartedAt?: number;
  stageHeartbeatAt?: number;
  stageId?: string;
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
