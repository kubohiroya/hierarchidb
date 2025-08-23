# Shape Plugin API Reference

This document provides comprehensive API documentation for the Shape Plugin, including all interfaces, methods, and data types.

## Core Interfaces

### ShapesPluginAPI

Main plugin API that integrates with HierarchiDB's PluginAPI system.

```typescript
export class ShapesPluginAPI implements PluginAPI<ShapesAPIMethods> {
  readonly nodeType: TreeNodeType = 'shape';
  readonly methods: ShapesAPIMethods;
  
  constructor(
    private workerPoolManager: WorkerPoolManager,
    private database: ShapesDatabase
  ) {
    this.methods = new ShapesAPIMethods(workerPoolManager, database);
  }
  
  // Plugin lifecycle methods
  async initialize(): Promise<void>;
  async cleanup(): Promise<void>;
  async getNodeTypeDefinition(): Promise<NodeTypeDefinition<ShapesEntity>>;
}
```

### ShapesAPIMethods

Collection of API methods exposed to the UI layer.

```typescript
export class ShapesAPIMethods {
  // Configuration methods
  async updateShapeConfig(nodeId: NodeId, config: Partial<ShapeConfig>): Promise<void>;
  async getShapeConfig(nodeId: NodeId): Promise<ShapeConfig>;
  
  // Batch processing methods
  async startBatchProcessing(nodeId: NodeId, config: BatchConfig): Promise<string>;
  async pauseBatchProcessing(sessionId: string): Promise<void>;
  async resumeBatchProcessing(sessionId: string): Promise<void>;
  async cancelBatchProcessing(sessionId: string): Promise<void>;
  
  // Progress monitoring methods
  async getBatchProgress(sessionId: string): Promise<BatchProgress>;
  async getBatchTasks(sessionId: string): Promise<BatchTask[]>;
  async getTaskDetails(taskId: string): Promise<TaskDetails>;
  
  // Data access methods
  async getFeatureData(nodeId: NodeId, options?: FeatureQueryOptions): Promise<FeatureData[]>;
  async getVectorTile(nodeId: NodeId, z: number, x: number, y: number): Promise<ArrayBuffer>;
  async getFeatureCount(nodeId: NodeId): Promise<number>;
  
  // Cache management methods
  async clearCache(nodeId: NodeId, cacheType?: CacheType): Promise<void>;
  async getCacheStatus(nodeId: NodeId): Promise<CacheStatus>;
  async optimizeCache(nodeId: NodeId): Promise<void>;
}
```

## Configuration Types

### ShapeConfig

Main configuration object for shape entities.

```typescript
export interface ShapeConfig {
  // Data source configuration
  dataSource: DataSourceConfig;
  
  // Geographic selection
  countries: CountrySelection[];
  adminLevels: AdminLevelConfig;
  
  // Processing options
  simplification: SimplificationConfig;
  vectorTiles: VectorTileConfig;
  
  // Performance settings
  batchSize: number;
  concurrency: ConcurrencyConfig;
  caching: CacheConfig;
}

export interface DataSourceConfig {
  name: DataSourceName;
  baseUrl: string;
  apiKey?: string;
  rateLimit: number;
  timeout: number;
  retries: number;
}

export interface CountrySelection {
  countryCode: string;
  enabled: boolean;
  customBounds?: BoundingBox;
}

export interface AdminLevelConfig {
  level0: boolean; // Country level
  level1: boolean; // State/Province level
  level2: boolean; // County/District level
  level3: boolean; // Municipality level
}
```

### BatchConfig

Configuration for batch processing operations.

```typescript
export interface BatchConfig {
  // Processing stages
  stages: ProcessingStages;
  
  // Worker configuration
  workerConfig: WorkerConfiguration;
  
  // Quality settings
  quality: QualitySettings;
  
  // Output settings
  output: OutputSettings;
}

export interface ProcessingStages {
  download: {
    enabled: boolean;
    skipCache: boolean;
    validateGeometry: boolean;
  };
  simplify1: {
    enabled: boolean;
    algorithm: 'douglas-peucker' | 'visvalingam';
    tolerance: number;
    minArea: number;
  };
  simplify2: {
    enabled: boolean;
    preserveTopology: boolean;
    quantization: number;
    coordinatePrecision: number;
  };
  vectorTiles: {
    enabled: boolean;
    zoomLevels: number[];
    tileSize: number;
    buffer: number;
    compression: boolean;
  };
}

export interface WorkerConfiguration {
  downloadWorkers: number;
  simplifyWorkers: number;
  tileWorkers: number;
  maxMemoryPerWorker: number;
  taskTimeout: number;
}
```

## Data Types

### Feature Data

Types for geographic feature data.

```typescript
export interface FeatureData {
  id: string;
  geometry: GeoJSONGeometry;
  properties: FeatureProperties;
  metadata: FeatureMetadata;
}

export interface FeatureProperties {
  name: string;
  countryCode: string;
  adminLevel: number;
  area: number;
  population?: number;
  [key: string]: any;
}

export interface FeatureMetadata {
  originalId: string;
  dataSource: DataSourceName;
  downloadedAt: Timestamp;
  simplificationLevel: number;
  qualityScore: number;
  bbox: BoundingBox;
}

export interface BoundingBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}
```

### Task Types

Types for batch processing tasks.

```typescript
export interface BatchTask {
  taskId: string;
  sessionId: string;
  nodeId: NodeId;
  taskType: TaskType;
  stage: TaskStage;
  status: TaskStatus;
  priority: number;
  progress: number;
  createdAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  errorMessage?: string;
  retryCount: number;
  config: TaskConfig;
  dependencies: string[];
  outputs: string[];
}

export type TaskType = 'download' | 'simplify1' | 'simplify2' | 'vectorTile';
export type TaskStage = 'queued' | 'assigned' | 'running' | 'completed' | 'failed';
export type TaskStatus = 'pending' | 'active' | 'completed' | 'failed' | 'cancelled';

export interface TaskDetails extends BatchTask {
  inputSize: number;
  outputSize: number;
  processingTime: number;
  memoryUsage: number;
  workerInfo: WorkerInfo;
  performanceMetrics: PerformanceMetrics;
}

export interface WorkerInfo {
  workerId: string;
  workerType: TaskType;
  startTime: Timestamp;
  memoryUsage: number;
  cpuUsage: number;
}
```

### Progress Types

Types for monitoring processing progress.

```typescript
export interface BatchProgress {
  sessionId: string;
  overallProgress: number;
  stageProgress: StageProgress;
  currentStage: ProcessingStage;
  estimatedTimeRemaining: number;
  tasksCompleted: number;
  tasksTotal: number;
  tasksRunning: number;
  tasksFailed: number;
  throughput: number;
  errors: BatchError[];
}

export interface StageProgress {
  download: StageStatus;
  simplify1: StageStatus;
  simplify2: StageStatus;
  vectorTiles: StageStatus;
}

export interface StageStatus {
  progress: number;
  tasksCompleted: number;
  tasksTotal: number;
  averageTimePerTask: number;
  currentTasks: string[];
  errors: number;
}

export interface BatchError {
  taskId: string;
  errorType: ErrorType;
  message: string;
  timestamp: Timestamp;
  retryable: boolean;
  stack?: string;
}

export type ErrorType = 'network' | 'processing' | 'memory' | 'timeout' | 'validation';
```

## Worker Pool Management

### WorkerPoolManager

Central manager for all worker pools.

```typescript
export class WorkerPoolManager {
  // Pool management
  async initializePools(config: WorkerPoolConfig): Promise<void>;
  async destroyPools(): Promise<void>;
  async resizePools(newSizes: PoolSizes): Promise<void>;
  
  // Task execution
  async executeTask(task: BatchTask): Promise<TaskResult>;
  async cancelTask(taskId: string): Promise<void>;
  async getTaskStatus(taskId: string): Promise<TaskStatus>;
  
  // Pool monitoring
  async getPoolStatus(): Promise<PoolStatus>;
  async getWorkerStats(): Promise<WorkerStats[]>;
  async getResourceUsage(): Promise<ResourceUsage>;
}

export interface WorkerPoolConfig {
  poolSizes: PoolSizes;
  workerOptions: WorkerOptions;
  taskQueueConfig: TaskQueueConfig;
}

export interface PoolSizes {
  download: number;
  simplify1: number;
  simplify2: number;
  vectorTile: number;
}

export interface WorkerOptions {
  maxMemory: number;
  timeout: number;
  retries: number;
  restartThreshold: number;
}
```

### Individual Worker APIs

#### DownloadWorker

```typescript
export interface DownloadWorkerAPI {
  async downloadData(config: DownloadConfig): Promise<DownloadResult>;
  async validateData(data: ArrayBuffer): Promise<ValidationResult>;
  async cacheData(key: string, data: ArrayBuffer): Promise<void>;
  async getCachedData(key: string): Promise<ArrayBuffer | null>;
}

export interface DownloadConfig {
  url: string;
  headers?: Record<string, string>;
  timeout: number;
  retries: number;
  validateSSL: boolean;
  expectedFormat: 'geojson' | 'shapefile' | 'topojson';
}

export interface DownloadResult {
  data: ArrayBuffer;
  metadata: DownloadMetadata;
  cacheKey: string;
}

export interface DownloadMetadata {
  contentType: string;
  contentLength: number;
  lastModified?: string;
  etag?: string;
  downloadTime: number;
  compressionRatio: number;
}
```

#### SimplifyWorker

```typescript
export interface SimplifyWorkerAPI {
  async simplifyFeatures(config: SimplifyConfig): Promise<SimplifyResult>;
  async validateGeometry(geometry: GeoJSONGeometry): Promise<boolean>;
  async calculateComplexity(geometry: GeoJSONGeometry): Promise<number>;
  async optimizeFeatures(features: FeatureData[]): Promise<FeatureData[]>;
}

export interface SimplifyConfig {
  features: FeatureData[];
  algorithm: SimplificationAlgorithm;
  tolerance: number;
  preserveTopology: boolean;
  minArea: number;
  maxVertices: number;
}

export interface SimplifyResult {
  simplifiedFeatures: FeatureData[];
  statistics: SimplificationStats;
  qualityMetrics: QualityMetrics;
}

export interface SimplificationStats {
  originalVertices: number;
  simplifiedVertices: number;
  reductionRatio: number;
  processingTime: number;
  memoryUsage: number;
}
```

#### VectorTileWorker

```typescript
export interface VectorTileWorkerAPI {
  async generateTile(config: TileConfig): Promise<TileResult>;
  async optimizeTile(tile: ArrayBuffer): Promise<ArrayBuffer>;
  async validateTile(tile: ArrayBuffer): Promise<ValidationResult>;
  async getTileMetadata(tile: ArrayBuffer): Promise<TileMetadata>;
}

export interface TileConfig {
  features: FeatureData[];
  zoomLevel: number;
  tileX: number;
  tileY: number;
  extent: number;
  buffer: number;
  layers: LayerConfig[];
}

export interface TileResult {
  mvtData: ArrayBuffer;
  metadata: TileMetadata;
  statistics: TileStats;
}

export interface TileMetadata {
  layers: LayerInfo[];
  extent: number;
  version: number;
  compressed: boolean;
  checksum: string;
}
```

## Database Queries

### Feature Queries

```typescript
export interface FeatureQueryOptions {
  bounds?: BoundingBox;
  adminLevel?: number;
  countryCode?: string;
  minArea?: number;
  maxComplexity?: number;
  limit?: number;
  offset?: number;
  orderBy?: 'name' | 'area' | 'complexity' | 'updated';
  includeGeometry?: boolean;
}

// Example usage
const features = await shapesAPI.getFeatureData(nodeId, {
  bounds: { minLon: -10, minLat: 50, maxLon: 10, maxLat: 60 },
  adminLevel: 1,
  orderBy: 'area',
  limit: 100
});
```

### Spatial Queries

```typescript
export interface SpatialQueryAPI {
  async findFeaturesInBounds(bounds: BoundingBox): Promise<FeatureData[]>;
  async findFeaturesNearPoint(point: [number, number], radius: number): Promise<FeatureData[]>;
  async findIntersectingFeatures(geometry: GeoJSONGeometry): Promise<FeatureData[]>;
  async findFeaturesInTile(z: number, x: number, y: number): Promise<FeatureData[]>;
}
```

## Error Handling

### Error Types

```typescript
export class ShapePluginError extends Error {
  constructor(
    message: string,
    public readonly errorType: ErrorType,
    public readonly errorCode: string,
    public readonly retryable: boolean = false,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'ShapePluginError';
  }
}

// Specific error types
export class DownloadError extends ShapePluginError {
  constructor(message: string, public readonly url: string, public readonly statusCode?: number) {
    super(message, 'network', 'DOWNLOAD_FAILED', true, { url, statusCode });
  }
}

export class ProcessingError extends ShapePluginError {
  constructor(message: string, public readonly taskId: string, public readonly stage: string) {
    super(message, 'processing', 'PROCESSING_FAILED', false, { taskId, stage });
  }
}

export class ValidationError extends ShapePluginError {
  constructor(message: string, public readonly invalidData: any) {
    super(message, 'validation', 'VALIDATION_FAILED', false, { invalidData });
  }
}
```

## Events and Subscriptions

### Event Types

```typescript
export interface ShapePluginEvents {
  'batch:started': (event: BatchStartedEvent) => void;
  'batch:progress': (event: BatchProgressEvent) => void;
  'batch:completed': (event: BatchCompletedEvent) => void;
  'batch:failed': (event: BatchFailedEvent) => void;
  'task:started': (event: TaskStartedEvent) => void;
  'task:completed': (event: TaskCompletedEvent) => void;
  'task:failed': (event: TaskFailedEvent) => void;
  'worker:error': (event: WorkerErrorEvent) => void;
  'cache:updated': (event: CacheUpdatedEvent) => void;
}

export interface BatchProgressEvent {
  sessionId: string;
  progress: BatchProgress;
  timestamp: Timestamp;
}

export interface TaskCompletedEvent {
  taskId: string;
  sessionId: string;
  taskType: TaskType;
  result: TaskResult;
  duration: number;
  timestamp: Timestamp;
}
```

### Event Subscription

```typescript
// Subscribe to events
shapesAPI.on('batch:progress', (event) => {
  console.log(`Batch ${event.sessionId} progress: ${event.progress.overallProgress}%`);
});

// Unsubscribe
shapesAPI.off('batch:progress', handler);

// One-time subscription
shapesAPI.once('batch:completed', (event) => {
  console.log('Batch processing completed');
});
```

This API reference provides comprehensive documentation for all public interfaces and methods available in the Shape Plugin, enabling developers to effectively integrate and extend the plugin's functionality.