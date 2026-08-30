import type { NodeId } from '@hierarchidb/core-types';
import type {
  ExtractionMode as CommonExtractionMode,
  FeatureFilterMethod as CommonFeatureFilterMethod,
  GeometryConfig as CommonGeometryConfig,
  HybridFilterConfig as CommonHybridFilterConfig,
  SourceConfig as CommonSourceConfig,
  TileEmitConfig as CommonTileEmitConfig,
} from '@hierarchidb/gis-sdk';
export type ZIP_TYPE = 'gzip' | 'bz';
export type VECTOR_TILE_FORMAT = 'mvt' | 'pbf';
export type BuildTaskType = 'source' | 'geometry' | 'tileEmit';
export type FILTER_OPERATOR = 'eq' | 'ne' | 'exists' | 'not_exists';
export const BuildTaskResult = {
  WAIT: 'wait',
  PROCESS: 'process',
  SUCCESS: 'success',
  ERROR: 'error',
  PAUSE: 'pause',
  CANCEL: 'cancel',
} as const;
export type BuildTaskResultType = (typeof BuildTaskResult)[keyof typeof BuildTaskResult];
export type BuildTaskStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'recycled';
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
export interface SourceTaskInput<DataSourceName> {
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
        operator?: FILTER_OPERATOR;
        includeNodes?: boolean;
      }
  >;
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface SourceTask<DataSourceName> extends BuildTaskBase {
  url?: string;
  type: 'source';
  dataSourceName?: DataSourceName;
  countryCode?: string;
  adminLevel?: number;
  fileSize?: number;
  downloadedBytes?: number;
}

export interface StageStatus {
  status: BuildTaskStatus;
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
  stage: BuildTaskType;
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
/*
export interface BatchConfig<DataSourceName> {
  dataSource?: DataSourceName;
  sourceConfig?: SourceConfig;
  geometryConfig?: GeometryConfig;
  tileEmitConfig?: TileEmitConfig;
  cleanupConfig?: CleanupBatchConfig;
  // source?: string;
}*/

export type SourceConfig = CommonSourceConfig;
export type FeatureFilterMethod = CommonFeatureFilterMethod;
export type HybridFilterConfig = CommonHybridFilterConfig;
export type ExtractionMode = CommonExtractionMode;
export type GeometryConfig = CommonGeometryConfig;
export type TileEmitConfig = CommonTileEmitConfig;

export interface CleanupBatchConfig {
  deleteSourceApiCache?: boolean;
  deleteSourceFilteredCache?: boolean;
  deleteGeometryCache?: boolean;
  deleteTileEmitCache?: boolean;
}
