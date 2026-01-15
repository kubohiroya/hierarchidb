import type { NodeId } from '@hierarchidb/common-types';
import type {
  ExtractionMode as CommonExtractionMode,
  FetchConfig as CommonFetchConfig,
  FeatureFilterMethod as CommonFeatureFilterMethod,
  HybridFilterConfig as CommonHybridFilterConfig,
  TransformByBandConfig as CommonTransformByBandConfig,
  TransformByZoomConfig as CommonTransformByZoomConfig,
  VTConfig as CommonVTConfig,
} from '@hierarchidb/gis-sdk';
export type ZIP_TYPE = 'gzip' | 'bz';
export type VECTOR_TILE_FORMAT = 'mvt' | 'pbf';
export type BuildTaskType = 'fetch' | 'transform-by-band' | 'transform-by-zoom' | 'vt';
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
export type BuildTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'regression';
export interface BuildTaskBase {
  taskId: string;
  type: BuildTaskType;
  nodeId: NodeId;
  stage: BuildTaskResultType|undefined;
  status: BuildTaskStatus;
  index: number;
  progress?: number;
  retryCount?: number;
  error?: string;
  message?: string;
}
export interface FetchTaskInput<DataSourceName> {
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

export interface FetchTask<DataSourceName> extends BuildTaskBase {
  url?: string;
  type: 'fetch';
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
  fetchConfig?: FetchConfig;
  transformByBandConfig?: TransformByBandConfig;
  transformByZoomConfig?: TransformByZoomConfig;
  vtConfig?: VTConfig;
  cleanupConfig?: CleanupBatchConfig;
  // source?: string;
}*/

export type FetchConfig = CommonFetchConfig;
export type FeatureFilterMethod = CommonFeatureFilterMethod;
export type HybridFilterConfig = CommonHybridFilterConfig;
export type ExtractionMode = CommonExtractionMode;
export type TransformByBandConfig = CommonTransformByBandConfig;
export type TransformByZoomConfig = CommonTransformByZoomConfig;
export type VTConfig = CommonVTConfig;

export interface CleanupBatchConfig {
  deleteFetchCeche?: boolean;
  deleteTransformByBandCache?: boolean;
  deleteTransformByZoomCache?: boolean;
}
