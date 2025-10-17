/**
 * Shape plugin shared types
 */

// Local minimal type aliases to decouple from common-type DTS export quirks
import type { NodeId as CommonNodeId } from '@hierarchidb/common-types';
export type NodeId = CommonNodeId;
export type NodeType = string;

export interface PeerEntity {
  id: NodeId;
  nodeId: NodeId;
  createdAt: number;
  updatedAt: number;
  version: number;
  dialogMode?: 'normal' | 'full';
  resumeStep?: number;
  mapParams?: { zoom: number; lng: number; lat: number };
  disabled?: boolean;
}

import type { WorkingCopyDraft } from '@hierarchidb/plugin-api';
import type { BBox, Geometry } from 'geojson';

// ================================
// Core Entity Types
// ================================

export interface ShapeEntity extends Partial<PeerEntity> {
  // Basic Information (Step 1)
  name?: string;
  description?: string;

  // Map Position
  zxy?: [number, number, number]; // [zoom, x(longitude), y(latitude)] for initial position

  // Data Source (Step 2)
  dataSourceName?: DataSourceName;

  // License Agreement (Step 3)
  licenseAgreement?: boolean;
  licenseAgreedAt?: string;

  // Processing Configuration (Step 4)
  processingConfig?: ProcessingConfig;

  // Country & Admin Selection (Step 5)
  checkboxState?: boolean[][] | string; // Serializable matrix
  selectedCountries?: string[];
  adminLevels?: number[];
  urlMetadata?: UrlMetadata[];

  // Processing Status
  batchSessionId?: string;
  processingStatus?: 'idle' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';
}

// ShapeWorkingCopy extends the entity with working copy properties but keeps wizard-derived
// values (selectedCountries/adminLevels/urlMetadata) out of the persisted draft. Those values
// must be derived from `checkboxState` by UI or batch pipelines.
export type ShapeWorkingCopy = WorkingCopyDraft<ShapeEntity> &
  Omit<ShapeEntity, 'selectedCountries' | 'adminLevels' | 'urlMetadata'> &
  Partial<{
    // TreeNode required properties (from NodeBase)
    id: NodeId; // Legacy compatibility: TreeNode identifier
    parentId: NodeId;
    nodeType: NodeType;
    nodeId: NodeId;
    name: string;
    depth: number;

    // Working copy metadata compatible with legacy handlers
    originalNodeId?: NodeId;
    copiedAt: number;
    hasEntityCopy?: boolean;
    entityWorkingCopyId?: NodeId;
    hasGroupEntityCopy?: Record<string, boolean>;

    // Shape-specific working copy metadata
    isDraft?: boolean;
    downloadedMatrix?: boolean[][]; // Cache status
    resumeStep?: number;
    selectedCountries?: string[];
    selectedAdminLevels?: number[];
    checkboxState?: boolean[][] | string;
    urlMetadata?: UrlMetadata[];
  }>;

export interface StepProps {
  workingCopy: Partial<ShapeWorkingCopy>;
  onUpdate: (updates: Partial<ShapeWorkingCopy>) => void;
  disabled?: boolean;
}

// ================================
// Data Source Types
// ================================

export type DataSourceName = 'naturalearth' | 'geoboundaries' | 'gadm' | 'openstreetmap';

export interface DataSourceConfig {
  name: DataSourceName;
  displayName: string;
  description: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  color: string;
  icon: string;
  maxAdminLevel: number;
  supportedCountries?: string[];
}

// ================================
// Processing Configuration
// ================================

export interface ProcessingConfig {
  // Download settings
  concurrentDownloads: number;
  corsProxyBaseURL?: string;

  // Feature processing settings
  enableFeatureFiltering: boolean;
  featureFilterMethod: FeatureFilterMethod;
  featureAreaThreshold: number;

  // Vector tile settings
  concurrentProcesses: number;
  maxZoomLevel: number;
  tileBufferSize?: number;
  simplificationTolerance?: number;

  // Additional settings
  workerPoolSize?: number;
  simplificationLevels?: number[];
  tileZoomRange?: [number, number];
}

export type FeatureFilterMethod = 'bbox_only' | 'polygon_only' | 'hybrid';

// ================================
// Country & Admin Level Types
// ================================

export interface CountryMetadata {
  countryCode: string;
  countryName: string;
  continent: string;
  availableAdminLevels: number[];
  population?: number;
  area?: number;
  dataQuality?: 'high' | 'medium' | 'low';
}

export interface UrlMetadata {
  url: string;
  countryCode: string;
  adminLevel: number;
  continent: string;
  dataSource?: string;
  country?: string;
  estimatedSize?: number;
  lastUpdated?: string;
}

// ================================
// Batch Processing Types
// ================================

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

export type BatchTaskStage = (typeof BatchTaskStage)[keyof typeof BatchTaskStage];

export type TaskStatus = 'waiting' | 'running' | 'completed' | 'failed' | 'cancelled';

export type BatchTaskType = 'download' | 'simplify1' | 'simplify2' | 'vectortile';
export type ProcessingStage = BatchTaskType;

export interface BatchTaskBase {
  taskId: string;
  taskType: BatchTaskType;
  sessionId?: NodeId;
  stage?: BatchTaskStage;
  status?: TaskStatus;
  type?: string; // legacy compatibility for Dexie records
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
  dataSource?: string;
  country?: string;
  adminLevel?: number;
  url?: string;
  timeout?: number;
  retryDelay?: number;
  expectedFormat?: string;
  validateSSL?: boolean;
}

export interface DownloadTask extends BatchTaskBase {
  taskType: 'download';
  url?: string;
  config?: DownloadTaskConfig;
  countryCode?: string;
  adminLevel?: number;
  fileSize?: number;
  downloadedBytes?: number;
}

export interface SimplifyTaskConfig {
  algorithm?: 'douglas-peucker' | 'visvalingam';
  tolerance?: number;
  preserveTopology?: boolean;
  minimumArea?: number;
  maxVertices?: number;
  inputBufferId?: string;
}

export interface Simplify1Task extends BatchTaskBase {
  taskType: 'simplify1';
  inputBufferId?: string;
  tolerance?: number;
  minArea?: number;
  config?: SimplifyTaskConfig;
  countryCode?: string;
  adminLevel?: number;
  featureCount?: number;
  processedFeatures?: number;
}

export interface TileSimplifyConfig extends SimplifyTaskConfig {
  zoomLevel?: number;
  preserveSharedBoundaries?: boolean;
  quantization?: number;
  coordinatePrecision?: number;
  zoomLevels?: number[];
  tileSize?: number;
}

export interface Simplify2Task extends BatchTaskBase {
  taskType: 'simplify2';
  inputBufferId?: string;
  zoomLevels?: number[];
  tileSize?: number;
  config?: TileSimplifyConfig;
}

export type SimplifyTask = Simplify1Task | Simplify2Task;

export interface VectorTileTaskConfig {
  format?: 'mvt';
  compression?: boolean;
  tileSize?: number;
  zoomLevel?: number;
  tileX?: number;
  tileY?: number;
  extent?: number;
  buffer?: number;
  layers?: Array<{ name: string; featureCount?: number } | Record<string, unknown>>;
  tileBufferId?: string;
  inputBufferId?: string;
}

export interface VectorTileTask extends BatchTaskBase {
  taskType: 'vectortile';
  inputBufferId?: string;
  tileBufferId?: string;
  compression?: boolean;
  outputFormat?: string;
  config?: VectorTileTaskConfig;
  countryCode?: string;
  adminLevel?: number;
  zoomLevel?: number;
  tileCount?: number;
  generatedTiles?: number;
}

export interface BatchSession {
  sessionId: string;
  workingCopyId: NodeId; // WorkingCopyTypes-based processing now keyed by NodeId
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

  //  Direct link recovery metadata
  canResume: boolean;
  lastActivity: number;
  expiresAt: number;
  stages: Record<string, any>;
  resourceUsage?: any;
}

// ================================
// Validation Types
// ================================

export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface SelectionStats {
  totalSelected: number;
  countriesWithSelection: number;
  levelCounts: number[];
  estimatedSize: number;
  estimatedFeatures: number;
  estimatedProcessingTime: number;
}

// ================================
// Progress and Status Types
// ================================

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

// ================================
// Feature Data Types
// ================================

export interface Feature {
  type: 'Feature'; //  GeoJSONtype
  id: number; //  Dexie.jsID
  originalId?: string | number; //  GeoJSONID
  nodeId: NodeId;
  properties: Record<string, any>;
  geometry: Geometry;
  bbox?: BBox;
  mortonCode?: bigint;
  adminLevel?: number;
  countryCode?: string;
  name?: string;
  nameEn?: string;
  population?: number;
  area?: number;
}

export interface VectorTileEntity {
  tileId: string;
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
  data_Uint8Array: Uint8Array;
  size: number;
  features: number;
  layers: any[];
  generatedAt: number;
  lastAccessed?: number;
  contentHash: string;
  contentEncoding?: 'gzip' | 'br';
  version: number;
}

// ================================
// Create/Update Data Types
// ================================

/**
 * Create shape-plugin data structure
 */
export interface CreateShapeData {
  name: string;
  description?: string;
  dataSourceName: DataSourceName;
  processingConfig: ProcessingConfig;
}

/**
 * Update shape-plugin data structure
 */
export interface UpdateShapeData {
  name?: string;
  description?: string;
  processingConfig?: ProcessingConfig;
  checkboxState?: boolean[][] | string;
  selectedCountries?: string[];
  adminLevels?: number[];
  urlMetadata?: UrlMetadata[];
}
