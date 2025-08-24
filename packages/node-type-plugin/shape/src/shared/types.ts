/**
 * Shape plugin shared types
 */

import type { NodeId, EntityId, PeerEntity } from '@hierarchidb/common-core';
import type { Geometry, BBox } from 'geojson';

// ================================
// Core Entity Types
// ================================

export interface ShapeEntity extends PeerEntity {
  // Basic Information (Step 1)
  name: string;
  description?: string;
  
  // Data Source (Step 2)
  dataSourceName: DataSourceName;
  
  // License Agreement (Step 3)
  licenseAgreement: boolean;
  licenseAgreedAt?: string;
  
  // Processing Configuration (Step 4)
  processingConfig: ProcessingConfig;
  
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
}

export interface ShapeWorkingCopy extends ShapeEntity {
  id: EntityId;
  nodeId: NodeId;
  isDraft?: boolean;
  downloadedMatrix?: boolean[][]; // Cache status
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

export type BatchStatus = 'preparing' | 'downloading' | 'processing' | 'generating' | 'completed' | 'error' | 'cancelled';

export const BatchTaskStage = {
  WAIT: 'wait',
  PROCESS: 'process',
  SUCCESS: 'success',
  ERROR: 'error',
  PAUSE: 'pause',
  CANCEL: 'cancel',
} as const;

export type BatchTaskStage = typeof BatchTaskStage[keyof typeof BatchTaskStage];

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
  workingCopyId: EntityId;  // ✅ WorkingCopy-based processing
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
  
  // ✅ Direct link recovery metadata
  canResume: boolean;
  lastActivity: number;
  expiresAt: number;
  stages: Record<string, any>;
  resourceUsage?: any;
};

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
  type: 'Feature';  // GeoJSON標準のtypeプロパティ
  id: number;       // Dexie.js内部管理用ID（自動インクリメント）
  originalId?: string | number;  // GeoJSON由来の元ID（保持用）
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
  data: Uint8Array;
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
 * Create shape data structure
 */
export interface CreateShapeData {
  name: string;
  description?: string;
  dataSourceName: DataSourceName;
  processingConfig: ProcessingConfig;
}

/**
 * Update shape data structure
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