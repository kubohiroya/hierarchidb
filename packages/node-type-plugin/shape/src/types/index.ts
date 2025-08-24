import type { NodeId, PeerEntity, EntityId } from "@hierarchidb/common-core";
import type { Geometry, BBox } from "geojson";

// Types are imported from shared/types.ts via shared/openstreetmap-type.ts

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
  processingStatus?: "idle" | "processing" | "completed" | "failed";

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

export type DataSourceName =
  | "naturalearth"
  | "geoboundaries"
  | "gadm"
  | "openstreetmap";

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

export type FeatureFilterMethod = "bbox_only" | "polygon_only" | "hybrid";

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
  dataQuality?: "high" | "medium" | "low";
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
  | "preparing"
  | "downloading"
  | "processing"
  | "generating"
  | "completed"
  | "error"
  | "cancelled";

export const BatchTaskStage = {
  WAIT: "wait",
  PROCESS: "process",
  SUCCESS: "success",
  ERROR: "error",
  PAUSE: "pause",
  CANCEL: "cancel",
} as const;

export type BatchTaskStage =
  (typeof BatchTaskStage)[keyof typeof BatchTaskStage];

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

export type BatchTaskType =
  | "download"
  | "simplify1"
  | "simplify2"
  | "vectortile";

export interface DownloadTask extends BatchTask {
  taskType: "download";
  url: string;
  countryCode: string;
  adminLevel: number;
  fileSize?: number;
  downloadedBytes?: number;
}

export interface SimplifyTask extends BatchTask {
  taskType: "simplify1" | "simplify2";
  countryCode: string;
  adminLevel: number;
  featureCount?: number;
  processedFeatures?: number;
}

export interface VectorTileTask extends BatchTask {
  taskType: "vectortile";
  countryCode: string;
  adminLevel: number;
  zoomLevel: number;
  tileCount?: number;
  generatedTiles?: number;
}

// ================================
// UI State Types
// ================================

export interface ShapeDialogProps {
  mode: "create" | "edit";
  nodeId?: NodeId;
  parentNodeId?: NodeId;
  open: boolean;
  onClose: () => void;
}

export interface BatchMonitorDialogProps {
  open: boolean;
  onClose: () => void;
  nodeId: NodeId;
  config: ProcessingConfig;
  urlMetadata: UrlMetadata[];
  onBatchCompleted: () => void;
}

export interface StepProps<T = ShapeWorkingCopy> {
  workingCopy: T;
  onUpdate: (updates: Partial<T>) => void;
  disabled?: boolean;
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
// Additional Types for Database
// ================================

export interface ShapeEntityMetadata {
  totalFeatures?: number;
  totalSize?: number;
  lastProcessedAt?: number;
}

export interface BatchSession {
  sessionId: string;
  nodeId: NodeId;
  status: "running" | "paused" | "completed" | "failed" | "cancelled";
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
  stages: Record<string, any>;
  resourceUsage?: any;
}

export type TaskStatus =
  | "waiting"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
export type ProcessingStage =
  | "download"
  | "simplify1"
  | "simplify2"
  | "vectortile";

export interface Feature {
  type: "Feature"; // GeoJSON標準のtypeプロパティ
  id: number; // Dexie.js内部管理用ID（自動インクリメント）
  originalId?: string | number; // GeoJSON由来の元ID（保持用）
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

export interface FeatureIndex {
  indexId: string;
  featureId: string;
  mortonCode: number;
  bbox: [number, number, number, number];
  centroid: [number, number];
  area: number;
  complexity: number;
}

export interface FeatureBuffer {
  bufferId: string;
  nodeId: NodeId;
  stage: ProcessingStage;
  data: Uint8Array;
  format: "geojson" | "topojson" | "geobuf";
  featureCount: number;
  byteSize: number;
  compression?: string;
  createdAt: number;
  metadata?: any;
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
  contentEncoding?: "gzip" | "br";
  version: number;
}

export interface TileBuffer {
  bufferId: string;
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
  stage: ProcessingStage;
  data: Uint8Array;
  featureCount: number;
  byteSize: number;
  createdAt: number;
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
  layers: any[];
  generatedAt: number;
  lastAccessed?: number;
  contentHash: string;
  contentEncoding?: "gzip" | "br";
  version: number;
}

export interface CacheEntry {
  cacheKey: string;
  nodeId?: NodeId;
  cacheType: "features" | "tiles" | "buffers" | "metadata";
  data: any;
  size: number;
  hits: number;
  lastHit: number;
  createdAt: number;
  expiresAt?: number;
}

export interface CacheStatistics {
  totalSize: number;
  totalItems: number;
  byType: Record<string, any>;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  oldestItem: number;
  newestItem: number;
  lastCleanup?: number;
}

// ================================
// Batch Processing Support Types
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
  status: "waiting" | "running" | "completed" | "failed";
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

export interface ResourceUsage {
  memoryUsed: number;
  memoryPeak: number;
  cpuPercent: number;
  storageUsed: number;
  networkBytesReceived: number;
  networkBytesSent: number;
}

// ================================
// Constants
// ================================

export const DEFAULT_PROCESSING_CONFIG: ProcessingConfig = {
  concurrentDownloads: 2,
  corsProxyBaseURL: "",
  enableFeatureFiltering: false,
  featureFilterMethod: "hybrid",
  featureAreaThreshold: 0.1,
  concurrentProcesses: 2,
  maxZoomLevel: 12,
  tileBufferSize: 256,
  simplificationTolerance: 0.01,
};

export const SHAPE_LEVELS = [
  { level: 0, label: "Country", icon: "🌍" },
  { level: 1, label: "State/Province", icon: "🏛️" },
  { level: 2, label: "County/District", icon: "🏘️" },
  { level: 3, label: "Municipality", icon: "🏢" },
  { level: 4, label: "Ward/Borough", icon: "🏠" },
  { level: 5, label: "Neighborhood", icon: "📍" },
] as const;
