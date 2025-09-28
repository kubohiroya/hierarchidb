/**
 * Shape plugin shared types
 */

// Local minimal type aliases to decouple from common-type DTS export quirks
export type NodeId = string;
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

import type { BBox, Geometry } from 'geojson';

// ================================
// Core Entity Types
// ================================

export type ShapeEntity = Partial<PeerEntity & {
  // Basic Information (Step 1)
  name: string;
  description?: string;

  // Map Position
  zxy?: [number, number, number]; // [zoom, x(longitude), y(latitude)] for initial position

  // Data Source (Step 2)
  dataSourceName: DataSourceName;

  // License Agreement (Step 3)
  licenseAgreement: boolean;
  licenseAgreedAt?: string;

  // Processing Configuration (Step 4)
  processingConfig?: ProcessingConfig;

  // Country & Admin Selection (Step 5)
  checkboxState: boolean[][] | string; // Serializable matrix
  selectedCountries: string[];
  adminLevels: number[];
  urlMetadata: UrlMetadata[];

  // Processing Status
  batchSessionId?: string;
  processingStatus?: 'idle' | 'processing' | 'completed' | 'failed';

  // Metadata
  createdAt: number;
  updatedAt: number;
  version: number;
}>

// ShapeWorkingCopy extends the entity with working copy properties
// To satisfy the WorkingCopy constraint, we need TreeNode properties
export type ShapeWorkingCopy = ShapeEntity & Partial<{
  // TreeNode required properties (from NodeBase)
  id: NodeId; // NodeId instead of EntityId to match TreeNode
  parentId: NodeId;
  nodeType: NodeType;
  nodeId: NodeId;
  name: string;
  depth: number;

  // WorkingCopyProperties
  originalNodeId?: NodeId;
  copiedAt: number;
  hasEntityCopy?: boolean;
  entityWorkingCopyId?: NodeId;
  originalVersion?: number;
  hasGroupEntityCopy?: Record<string, boolean>;

  // Shape-specific working copy metadata
  isDraft?: boolean;
  downloadedMatrix?: boolean[][]; // Cache status
}>;

export interface StepProps {
  workingCopy: Partial<ShapeWorkingCopy> & { selectedAdminLevels?: number[] };
  onUpdate: (updates: Partial<ShapeWorkingCopy> & { selectedAdminLevels?: number[] }) => void;
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

export interface BatchTask {
  taskId: string;
  taskType: BatchTaskType;
  stage: BatchTaskStage;
  progress?: number;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  metadata?: Record<string, any>;
}

export type BatchTaskType = 'download' | 'simplify1' | 'simplify2' | 'vectortile';

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
    currentStage?: string;
    currentTask?: string;
  };

  //  Direct link recovery metadata
  canResume: boolean;
  lastActivity: number;
  expiresAt: number;
  stages: Record<string, any>;
  resourceUsage?: any;
}

// Lightweight task views for UI/console components
export interface DownloadTask extends BatchTask {
  taskType: 'download';
}

export interface SimplifyTask extends BatchTask {
  taskType: 'simplify1' | 'simplify2';
}

export interface VectorTileTask extends BatchTask {
  taskType: 'vectortile';
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
  currentStage?: string;
  currentTask?: string;
}

export interface StageStatus {
  status: 'waiting' | 'running' | 'completed' | 'failed';
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

export type ProcessingStage = 'download' | 'simplify1' | 'simplify2' | 'vectortile';

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
