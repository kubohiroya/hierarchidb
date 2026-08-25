import type { NodeId } from '@hierarchidb/core-types';
import type {
  BorderGeometryConfig,
  FeatureFilterMethod,
  GeometryConfig,
  HybridFilterConfig,
  SourceConfig,
  TileEmitConfig,
} from '@hierarchidb/gis-sdk';
import type { Geometry } from 'geojson';

export type DataSourceName =
  | 'naturalearth'
  | 'geoboundaries'
  | 'geoboundaries-topojson'
  | 'gadm'
  | 'openstreetmap';

export interface CommonSessionConfig {
  dataSource?: DataSourceName;
}

export interface BuildSessionConfig extends CommonSessionConfig {
  sourceConfig: SourceConfig;
  geometryConfig: GeometryConfig;
  vectorTiles: TileEmitConfig;
  borderGeometryConfig?: BorderGeometryConfig;
  quantize?: number;
  extract?: number;
  tolerance?: number;
  featureAreaThreshold?: number;
  minVertexCountForAreaFilter?: number;
  enableFeatureFiltering?: boolean;
  enablePerFeatureExtraction?: boolean;
  aspectRatioThreshold?: number;
  featureFilterMethod?: FeatureFilterMethod;
  hybridFilterConfig?: HybridFilterConfig;
  deleteDownloadCacheOnComplete?: boolean;
  deleteExtract1CacheOnComplete?: boolean;
  deleteExtract2CacheOnComplete?: boolean;
}

export type BuildProcessConfig = BuildSessionConfig;
export type BuildTaskType = 'source' | 'geometry' | 'tileEmit';
export type BuildStage = BuildTaskType;
export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'recycled';
export type TaskDisplayKind = 'phase' | 'summary' | 'skip' | 'error' | 'info';
export type TaskDisplayMetric = {
  input: number;
  output: number;
};
export type TaskDisplayPayload = {
  kind: TaskDisplayKind;
  key?: string;
  params?: Record<string, string | number | boolean>;
  phaseCode?: string;
  phaseState?: 'start' | 'progress' | 'done';
  metrics?: Partial<Record<'features' | 'polygons' | 'vertices', TaskDisplayMetric>>;
};

export interface ProgressInfo {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
  stage?: BuildStage | 'processing';
}

export interface StageStatus {
  status: TaskStatus;
  progress: number;
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  message?: string;
}

export interface ResourceUsage {
  memoryUsed: number;
  memoryPeak: number;
  cpuPercent: number;
  storageUsed: number;
  networkBytesReceived: number;
  networkBytesSent: number;
}

export type BuildStopReason =
  | 'route-leave'
  | 'user-pause'
  | 'auth-required'
  | 'failed'
  | 'completed'
  | 'unknown';

export interface LayerInfo {
  name: string;
  featureCount: number;
  minZoom: number;
  maxZoom: number;
  fields: string[];
}

export interface SourceStageMaxima {
  featureMax: number;
  polygonMax: number;
  maxPolygonVertexCount?: number;
  baseTolerance?: number;
  vertexLimit?: number;
}

/**
 * @deprecated Legacy BuildSessionRecord - kept for migration from version 1 to version 2
 * Use the new four-table structure instead:
 * - BuildSessionRecord (immutable config)
 * - BuildSessionHeartbeat (heartbeat tracking)
 * - BuildSessionStatus (session status)
 * - BuildStageStatus (per-stage tracking)
 */
export interface BuildSessionRecord {
  nodeId: ShapeContainerNodeId;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  selectedArrayByCountries?: Record<string, boolean[]>;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  progress: ProgressInfo;
  stages: Record<BuildStage, StageStatus>;
  resourceUsage?: ResourceUsage;
  stopReason?: BuildStopReason;
  canResume?: boolean;
  lastActivity?: number;
  expiresAt?: number;
  inactiveMs?: number;
  lastHeartbeatAt?: number;
  stageInactiveMs?: number;
  stageStartedAt?: number;
  stageHeartbeatAt?: number;
  stageId?: string;
  sourceStageMaxima?: SourceStageMaxima;
  stage?: BuildStage;
}

export type SourceTaskPayload = {
  url?: string;
  dataSource?: DataSourceName;
  countryCode?: string;
  countryName?: string;
  adminLevel?: number;
  endpoint?: string;
  bbox?: [number, number, number, number];
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
};
export type SourceTaskResult = {
  outputBufferId?: string;
  bytesWritten?: number;
  featureCount?: number;
};
export type TransformByBandTaskPayload = {
  inputBufferId?: string;
  sourceUrl?: string;
  featureId?: string;
  featureLabel?: string;
  featureGroupId?: string;
  featureIndex?: number;
  originKey?: string;
  originLabel?: string;
  adminCode?: string;
  dataSource?: DataSourceName;
  countryCode?: string;
  adminLevel?: number;
  continent?: string;
  countryName?: string;
};
export type TransformByBandTaskResult = {
  outputBufferId?: string;
  featureCount?: number;
  extractionRatio?: number;
};
export type TransormByZoomTaskPayload = {
  inputBufferId?: string;
  sourceTaskId?: string;
  sourceUrl?: string;
  featureId?: string;
  featureLabel?: string;
  featureGroupId?: string;
  featureIndex?: number;
  originKey?: string;
  originLabel?: string;
  adminCode?: string;
  dataSource?: DataSourceName;
  countryCode?: string;
  adminLevel?: number;
  continent?: string;
  countryName?: string;
  zoomLevels?: number[];
  zoomRange?: [number, number];
  zoomRangeLabel?: string;
  tolerance?: number;
};
export type TransformByZoomTaskResult = {
  outputBufferId?: string;
  featureCount?: number;
  extractionRatio?: number;
  retry?: number;
};
export type TileEmitTaskPayload = {
  inputBufferId: string;
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
  metadataContext?: {
    dataSource?: string;
    countryCode?: string;
    countryName?: string;
    adminLevel?: number;
  };
};
export type TileEmitTaskResult = {
  tileId: string;
  tileCount?: number;
  totalBytes?: number;
  retry?: number;
};
export type ShapeBuildTaskPayload =
  | SourceTaskPayload
  | TransformByBandTaskPayload
  | TransormByZoomTaskPayload
  | TileEmitTaskPayload;
export type ShapeBuildTaskResult =
  | SourceTaskResult
  | TransformByBandTaskResult
  | TransformByZoomTaskResult
  | TileEmitTaskResult;

export interface BuildTaskRecord<TInput = ShapeBuildTaskPayload, TOutput = ShapeBuildTaskResult> {
  taskId: string;
  nodeId: ShapeContainerNodeId;
  stage: BuildTaskType;
  status: TaskStatus;
  index: number;
  progress: number;
  taskType?: never;
  display?: TaskDisplayPayload;
  message?: string;
  retryCount?: number;
  inputData?: TInput;
  outputData?: TOutput;
  errorMessage?: string;
}

export type ShapeContainerNodeId = NodeId;

export interface ShapeFeature {
  id: number;
  nodeId: ShapeContainerNodeId;
  properties: Record<string, unknown>;
  geometry: Geometry; // GeoJSON.Geometry
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

export interface ShapeFeatureBuffer {
  bufferId: string;
  nodeId: ShapeContainerNodeId;
  stage: BuildStage;
  data_Uint8Array: Uint8Array;
  format: 'geojson' | 'topojson' | 'geobuf' | 'flatgeobuf';
  featureCount: number;
  byteSize: number;
  compression?: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface VectorTileRecord {
  tileId: string;
  nodeId: ShapeContainerNodeId;
  z: number;
  x: number;
  y: number;
  data_Uint8Array: Uint8Array;
  size: number;
  features: number;
  layers: LayerInfo[];
  generatedAt: number;
  lastAccessed?: number;
  contentHash: string;
  contentEncoding?: 'gzip' | 'br';
  version: number;
}

export interface ShapeTileSummaryRecord {
  nodeId: ShapeContainerNodeId;
  tiles: number;
  totalBytes: number;
  zoomMin?: number;
  zoomMax?: number;
  updatedAt: number;
}
