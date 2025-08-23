/**
 * Type definitions for Shape plugin services
 */

import { NodeId } from '@hierarchidb/00-core';
import type { Feature } from '../types';


// === API Method Signatures ===

export interface ShapesAPIMethods extends Record<string, any> {
  // Batch processing
  startBatchProcess(nodeId: NodeId, config: BatchProcessConfig): Promise<BatchSession>;
  pauseBatchProcess(sessionId: string): Promise<void>;
  resumeBatchProcess(sessionId: string): Promise<void>;
  cancelBatchProcess(sessionId: string): Promise<void>;
  getBatchStatus(sessionId: string): Promise<BatchStatus>;
  
  // Data sources
  getAvailableDataSources(): Promise<DataSourceInfo[]>;
  getCountryMetadata(dataSource: string, countryCode?: string): Promise<CountryMetadata[]>;
  validateDataSource(dataSource: string, config: DataSourceConfig): Promise<ValidationResult>;
  
  // Vector tiles
  getTile(nodeId: NodeId, z: number, x: number, y: number): Promise<Uint8Array>;
  getTileMetadata(nodeId: NodeId, z: number, x: number, y: number): Promise<TileMetadata>;
  clearTileCache(nodeId: NodeId): Promise<void>;
  
  // Feature queries
  searchFeatures(nodeId: NodeId, query: string, options?: SearchOptions): Promise<Feature[]>;
  getFeatureById(nodeId: NodeId, featureId: number): Promise<Feature | null>;
  getFeaturesByBbox(nodeId: NodeId, bbox: BoundingBox, options?: BboxQueryOptions): Promise<Feature[]>;
  
  // Cache management
  getCacheStatistics(nodeId?: NodeId): Promise<CacheStatistics>;
  clearCache(nodeId: NodeId, cacheType?: CacheType): Promise<void>;
  optimizeStorage(nodeId: NodeId): Promise<OptimizationResult>;
}

// === Data Types ===

export type BoundingBox = [number, number, number, number]; // [minX, minY, maxX, maxY]

export type DataSourceName = 
  | 'NaturalEarth'
  | 'GeoBoundaries' 
  | 'GADM'
  | 'OpenStreetMap';

export type ProcessingStage = 
  | 'download'
  | 'simplify1'
  | 'simplify2'
  | 'vectortile';

export type TaskStatus = 
  | 'waiting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type CacheType = 
  | 'features'
  | 'tiles'
  | 'buffers'
  | 'all';

// === Configuration Types ===

export interface BatchProcessConfig {
  dataSource: DataSourceName;
  countryCode: string;
  adminLevels: number[];
  workerPoolSize?: number;
  enableFeatureExtraction?: boolean;
  simplificationLevels?: number[];
  tileZoomRange?: [number, number];
  corsProxy?: string;
  cacheStrategy?: CacheStrategy;
}

export interface CacheStrategy {
  enableCache: boolean;
  ttl?: number; // Time to live in seconds
  maxSize?: number; // Max cache size in bytes
  compressionLevel?: number; // 0-9
}

export interface DataSourceConfig {
  countryCode: string;
  adminLevels: number[];
  filterRules?: FilterRule[];
  bbox?: BoundingBox;
}

export interface FilterRule {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains' | 'regex';
  value: any;
  caseSensitive?: boolean;
}

// === Session & Status Types ===

export interface BatchSession {
  sessionId: string;
  nodeId: NodeId;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  config: BatchProcessConfig;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  progress: ProgressInfo;
  stages: Record<ProcessingStage, StageStatus>;
  resourceUsage?: ResourceUsage;
}

export interface BatchStatus {
  session: BatchSession;
  currentTasks: TaskInfo[];
  queuedTasks: number;
  errors: ErrorInfo[];
  warnings: string[];
  estimatedTimeRemaining?: number;
  throughput?: {
    tasksPerSecond: number;
    bytesPerSecond: number;
  };
}

export interface ProgressInfo {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
  currentStage?: ProcessingStage;
  currentTask?: string;
}

export interface StageStatus {
  status: TaskStatus;
  startedAt?: number;
  completedAt?: number;
  progress: number;
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  message?: string;
  lastError?: string;
}

export interface TaskInfo {
  taskId: string;
  sessionId: string;
  type: ProcessingStage;
  status: TaskStatus;
  index: number;
  progress: number;
  message?: string;
  startedAt?: number;
  completedAt?: number;
  retryCount?: number;
}

export interface ErrorInfo {
  taskId: string;
  sessionId: string;
  error: string;
  stack?: string;
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

// === Data Source Types ===

export interface DataSourceInfo {
  name: DataSourceName;
  displayName: string;
  description: string;
  license: string;
  licenseUrl?: string;
  attribution: string;
  website?: string;
  availableCountries: string[];
  maxAdminLevel: number;
  dataFormat: 'geojson' | 'topojson' | 'shapefile' | 'pbf';
  updateFrequency: string;
  lastUpdated?: string;
  estimatedSize?: number;
  features: string[];
}

export interface CountryMetadata {
  countryCode: string;
  countryName: string;
  countryNameLocal?: string;
  adminLevels: AdminLevelInfo[];
  bbox: BoundingBox;
  center: [number, number];
  featureCount: number;
  dataSize?: number;
  lastUpdated: string;
  available: boolean;
}

export interface AdminLevelInfo {
  level: number;
  name: string;
  localName?: string;
  description?: string;
  featureCount: number;
  averageVertices?: number;
  available: boolean;
  dataSize?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{type: string; message: string; severity: 'error' | 'warning'}>;
  warnings: string[];
  metadata: Record<string, string | number | boolean>;
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  suggestion?: string;
}

// === Tile Types ===

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
  contentEncoding?: 'gzip' | 'br';
  version: number;
}

export interface LayerInfo {
  name: string;
  featureCount: number;
  minZoom: number;
  maxZoom: number;
  fields: string[];
}

// === Feature Types ===

// Feature type is imported from '../types'
export type { Feature } from '../types';

export interface SearchOptions {
  limit?: number;
  offset?: number;
  adminLevel?: number;
  countryCode?: string;
  fuzzy?: boolean;
  sortBy?: 'name' | 'population' | 'area' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}

export interface BboxQueryOptions {
  limit?: number;
  offset?: number;
  adminLevel?: number;
  simplificationLevel?: number;
  includeProperties?: boolean;
  clip?: boolean;
}

// === Cache Types ===

export interface CacheStatistics {
  totalSize: number;
  totalItems: number;
  byType: Record<CacheType, CacheTypeStats>;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  oldestItem: number;
  newestItem: number;
  lastCleanup?: number;
}

export interface CacheTypeStats {
  size: number;
  count: number;
  hits: number;
  misses: number;
  evictions: number;
  averageSize: number;
}

export interface OptimizationResult {
  freedSpace: number;
  removedItems: number;
  compactedItems: number;
  duration: number;
  errors: string[];
  suggestions: string[];
}

// === Worker Pool Types ===

export interface WorkerPoolConfig {
  downloadWorkers: number;
  simplify1Workers: number;
  simplify2Workers: number;
  vectorTileWorkers: number;
  workerOptions: WorkerOptions;
}

export interface WorkerOptions {
  timeout: number;                // Timeout per task in milliseconds
  retries: number;                // Max retry attempts
  maxMemoryPerWorker: number;     // Memory limit per worker in bytes
  restartThreshold: number;       // Restart worker after N errors
}

// === Task Types for Workers ===

export interface DownloadTask extends TaskInfo {
  taskType: 'download';
  nodeId: NodeId;
  config: DownloadTaskConfig;
}

export interface DownloadTaskConfig {
  dataSource: DataSourceName;
  country: string;
  adminLevel: number;
  url: string;
  timeout: number;
  retryDelay: number;
  expectedFormat: 'geojson' | 'shapefile' | 'topojson';
  validateSSL: boolean;
}

export interface DownloadResult {
  taskId: string;
  status: 'completed' | 'failed';
  outputBufferId: string;
  featureCount: number;
  downloadTime: number;
  downloadSize: number;
  compressionRatio: number;
  spatialIndices: FeatureIndex[];
  errorMessage?: string;
}

export interface Simplify1Task extends TaskInfo {
  taskType: 'simplify1';
  inputBufferId: string;
  config: SimplifyTaskConfig;
}

export interface SimplifyTaskConfig {
  algorithm: 'douglas-peucker' | 'visvalingam';
  tolerance: number;
  preserveTopology: boolean;
  minimumArea?: number;
  maxVertices?: number;
}

export interface Simplify1Result {
  taskId: string;
  status: 'completed' | 'failed';
  outputBufferId: string;
  originalFeatureCount: number;
  simplifiedFeatureCount: number;
  reductionRatio: number;
  qualityMetrics: QualityMetrics;
  errorMessage?: string;
}

export interface Simplify2Task extends TaskInfo {
  taskType: 'simplify2';
  inputBufferId: string;
  config: TileSimplifyConfig;
}

export interface TileSimplifyConfig extends SimplifyTaskConfig {
  zoomLevel: number;
  preserveSharedBoundaries: boolean;
  quantization: number;
  coordinatePrecision: number;
}

export interface Simplify2Result {
  taskId: string;
  status: 'completed' | 'failed';
  tileBufferIds: string[];
  tilesGenerated: number;
  topologyPreserved: boolean;
  errorMessage?: string;
}

export interface VectorTileTask extends TaskInfo {
  taskType: 'vectorTile';
  tileBufferId: string;
  config: VectorTileTaskConfig;
}

export interface VectorTileTaskConfig {
  zoomLevel: number;
  tileX: number;
  tileY: number;
  extent: number;
  buffer: number;
  layers: LayerConfig[];
  format: 'mvt';
  compression: boolean;
}

export interface VectorTileResult {
  taskId: string;
  status: 'completed' | 'failed';
  tileId: string;
  mvtSize: number;
  featureCount: number;
  compressionRatio?: number;
  qualityScore: number;
  errorMessage?: string;
}

// === Worker API Interfaces ===

export interface DownloadWorkerAPI {
  processDownload(task: DownloadTask): Promise<DownloadResult>;
  validateData(data: ArrayBuffer): Promise<ValidationResult>;
  cacheData(key: string, data: ArrayBuffer): Promise<void>;
  getCachedData(key: string): Promise<ArrayBuffer | null>;
}

export interface SimplifyWorker1API {
  processSimplification(task: Simplify1Task): Promise<Simplify1Result>;
  validateGeometry(geometry: any): Promise<boolean>;
  calculateComplexity(geometry: any): Promise<number>;
  optimizeFeatures(features: Feature[]): Promise<Feature[]>;
}

export interface SimplifyWorker2API {
  processTileSimplification(task: Simplify2Task): Promise<Simplify2Result>;
  processTopoJSON(features: Feature[], config: TileSimplifyConfig): Promise<TopoJSONResult>;
  validateTopology(features: Feature[]): Promise<TopologyValidationResult>;
}

export interface VectorTileWorkerAPI {
  generateVectorTile(task: VectorTileTask): Promise<VectorTileResult>;
  optimizeTile(tile: ArrayBuffer): Promise<ArrayBuffer>;
  validateTile(tile: ArrayBuffer): Promise<ValidationResult>;
  getTileMetadata(tile: ArrayBuffer): Promise<TileMetadata>;
}

// === Supporting Types ===

export interface FeatureIndex {
  indexId: string;
  featureId: string;
  mortonCode: number;
  bbox: [number, number, number, number];
  centroid: [number, number];
  area: number;
  complexity: number;
}

export interface QualityMetrics {
  geometricAccuracy: number;
  topologicalIntegrity: number;
  visualQuality: number;
  compressionEfficiency: number;
}

export interface LayerConfig {
  name: string;
  minZoom: number;
  maxZoom: number;
  properties: string[];
  simplificationLevel: number;
}

export interface TopoJSONTopology {
  type: 'Topology';
  arcs: number[][][];
  objects: Record<string, TopoJSONObject>;
  transform?: {
    scale: [number, number];
    translate: [number, number];
  };
}

export interface TopoJSONObject {
  type: 'GeometryCollection';
  geometries: TopoJSONGeometry[];
}

export interface TopoJSONGeometry {
  type: string;
  properties?: Record<string, string | number | boolean | null>;
  id?: string | number;
  arcs?: number[][];
}

export interface TopoJSONResult {
  topology: TopoJSONTopology;
  objects: Record<string, TopoJSONObject>;
  transform?: {
    scale: [number, number];
    translate: [number, number];
  };
  quantization: number;
}

export interface TopologyValidationResult {
  isValid: boolean;
  sharedBoundariesPreserved: boolean;
  selfIntersections: number;
  invalidGeometries: string[];
  topologyErrors: string[];
}

// === Worker Message Types ===

export interface WorkerMessage<T = any> {
  type: 'request' | 'response' | 'progress' | 'error' | 'cancel';
  id: string;
  method?: string;
  params?: T;
  result?: any;
  error?: WorkerError;
  progress?: WorkerProgress;
}

export interface WorkerError {
  code: string;
  message: string;
  stack?: string;
  data?: any;
}

export interface WorkerProgress {
  taskId: string;
  stage: ProcessingStage;
  current: number;
  total: number;
  message?: string;
  subProgress?: {
    current: number;
    total: number;
    message: string;
  };
}

// === Feature Data Types ===

export interface FeatureData {
  id: string;
  geometry: GeoJSON.Geometry;
  properties: Record<string, string | number | boolean | null>;
  metadata: FeatureMetadata;
}

export interface FeatureMetadata {
  originalId: string;
  dataSource: string;
  downloadedAt: number;
  simplificationLevel: number;
  qualityScore: number;
  bbox: [number, number, number, number];
}