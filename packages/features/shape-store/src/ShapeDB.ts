/**
 * ShapeDB - Main database for shape-plugin plugin using Dexie
 *
 * Manages all persistent data for the shapes plugin including:
 * - Shape entities and metadata
 * - Batch sessions and tasks
 * - Feature indices
 * - Vector tiles
 */

import type { Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type { Geometry } from 'geojson';
import { VectorTileDbBase } from '@hierarchidb/vectortile-store';
type CacheEntryData = Record<string, unknown> | string | number | boolean | null;

export type DataSourceName = 'naturalearth' | 'geoboundaries' | 'gadm' | 'openstreetmap';
export type FeatureFilterMethod = 'bbox_only' | 'polygon_only' | 'hybrid' | 'none';

export interface HybridFilterConfig {
  quickRejectThreshold: number;
  regularShapeMinRatio: number;
  regularShapeMaxRatio: number;
  simpleShapeVertexThreshold: number;
  elongatedShapeCorrectionFactor: number;
}

export interface CommonSessionConfig {
  dataSource?: DataSourceName;
}

export interface DownloadSessionConfig {
  concurrentDownloads: number;
  deleteOnComplete?: boolean;
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface ExtractSession1Config {
  concurrentProcesses: number;
  enableFeatureFiltering: boolean;
  featureAreaThreshold: number;
  minVertexCountForAreaFilter: number;
  aspectRatioThreshold: number;
  featureFilterMethod: FeatureFilterMethod;
  hybridFilterConfig?: HybridFilterConfig;
  deleteOnComplete?: boolean;
}

export interface ExtractSession2Config {
  concurrentProcesses: number;
  quantize: number;
  extract: number;
  tolerance: number;
  enablePerFeatureExtraction: boolean;
  deleteOnComplete?: boolean;
}

export interface GenerateVectorTilesConfig {
  concurrentProcesses: number;
  minZoom: number;
  maxZoom: number;
  bufferSize?: number;
  tileSize?: number;
  zoomBreakpoints?: number[];
  tileExpandFactor?: number;
  tileExpandMargin?: number;
}

export interface BatchSessionConfig extends CommonSessionConfig {
  download: DownloadSessionConfig;
  extract1: ExtractSession1Config;
  extract2: ExtractSession2Config;
  vectorTiles: GenerateVectorTilesConfig;
  concurrentDownloads?: number;
  concurrentProcesses?: number;
  quantize?: number;
  extract?: number;
  tolerance?: number;
  maxZoom?: number;
  minZoom?: number;
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

export type BatchProcessConfig = BatchSessionConfig;
export type BatchTaskType = 'download' | 'extract1' | 'extract2' | 'vectortile' | 'fetch' | 'transform' | 'vt';
export type ProcessingStage = BatchTaskType;
export type TaskStatus = 'waiting' | 'running' | 'completed' | 'failed' | 'regression';

export interface ProgressInfo {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
  currentStage?: ProcessingStage | 'processing';
  currentTask?: string;
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

export interface LayerInfo {
  name: string;
  featureCount: number;
  minZoom: number;
  maxZoom: number;
  fields: string[];
}

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

export interface BatchSessionRecord {
  nodeId: NodeId;
  draftId?: NodeId;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  config: BatchProcessConfig;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  progress: ProgressInfo;
  stages: Record<ProcessingStage, StageStatus>;
  resourceUsage?: ResourceUsage;
  canResume?: boolean;
  lastActivity?: number;
  expiresAt?: number;
}

export type DownloadTaskInputData = {
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

export type DownloadTaskOutputData = {
  outputBufferId?: string;
  bytesWritten?: number;
  featureCount?: number;
};

export type Extract1TaskInputData = {
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

export type Extract1TaskOutputData = {
  outputBufferId?: string;
  featureCount?: number;
  extractionRatio?: number;
};

export type Extract2TaskInputData = {
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

export type Extract2TaskOutputData = {
  outputBufferId?: string;
  featureCount?: number;
  extractionRatio?: number;
  retry?: number;
};

export type VectorTileTaskInputData = {
  inputBufferId: string;
  minZoom?: number;
  maxZoom?: number;
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

export type VectorTileTaskOutputData = {
  tileId: string;
  tileCount?: number;
  totalBytes?: number;
  retry?: number;
};

export type ShapeBatchTaskInputData =
  | DownloadTaskInputData
  | Extract1TaskInputData
  | Extract2TaskInputData
  | VectorTileTaskInputData;

export type ShapeBatchTaskOutputData =
  | DownloadTaskOutputData
  | Extract1TaskOutputData
  | Extract2TaskOutputData
  | VectorTileTaskOutputData;

export interface BatchTaskRecord<TInput = ShapeBatchTaskInputData, TOutput = ShapeBatchTaskOutputData> {
  taskId: string;
  nodeId: NodeId;
  taskType: BatchTaskType;
  status: TaskStatus;
  index: number;
  progress: number;
  message?: string;
  startedAt?: number;
  completedAt?: number;
  createdAt?: number;
  updatedAt?: number;
  retryCount?: number;
  inputData?: TInput;
  outputData?: TOutput;
  errorMessage?: string;
}

export interface FeatureRecord {
  id: number;
  nodeId: NodeId;
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

export interface FeatureIndexRecord {
  indexId: string;
  featureId: string;
  mortonCode: number;
  bbox: [number, number, number, number];
  centroid: [number, number];
  area: number;
  complexity: number;
  adminLevel?: number;
  countryCode?: string;
}

export interface ShapeRelationRow {
  srcNodeId: NodeId;
  dstNodeId: NodeId;
  type: string;
  meta?: unknown;
  updatedAt?: number;
}

export interface FeatureBufferRecord {
  bufferId: string;
  nodeId: NodeId;
  stage: ProcessingStage;
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
  nodeId: NodeId;
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

export interface TileBufferRecord {
  bufferId: string;
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
  stage: ProcessingStage;
  data_Uint8Array: Uint8Array;
  featureCount: number;
  byteSize: number;
  createdAt: number;
}

export interface CacheEntryRecord {
  cacheKey: string;
  nodeId?: NodeId;
  cacheType: 'features' | 'tiles' | 'buffers' | 'metadata';
  data: CacheEntryData;
  size: number;
  hits: number;
  lastHit: number;
  createdAt: number;
  expiresAt?: number;
}

export class ShapeDB extends VectorTileDbBase {

  // Batch processing tables
  batchSessions!: Table<BatchSessionRecord, NodeId>;

  // Feature storage tables
  features!: Table<FeatureRecord, number>;
  featureIndices!: Table<FeatureIndexRecord, string>;
  relations!: Table<ShapeRelationRow, [NodeId, string, NodeId]>;

  // Tile storage tables
  vectorTiles!: Table<VectorTileRecord, string>;

  constructor() {
    super(getDBName('shape'));

    this.version(1).stores({

      // Batch processing - indexed for session and task management
      batchSessions: '&sessionId, nodeId, status, startedAt, updatedAt',

      // Features - spatial and attribute indexing
      features:
        '++id, nodeId, [nodeId+adminLevel], [nodeId+countryCode], mortonCode, adminLevel, countryCode, name, createdAt',
      featureIndices:
        '&indexId, featureId, mortonCode, [mortonCode+adminLevel], adminLevel, countryCode, area, complexity',
      relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt',

      // Vector tiles - spatial tile indexing
      vectorTiles: '&tileId, nodeId, [nodeId+z+x+y], [z+x+y], z, generatedAt, lastAccessed, size',
    });

    this.version(2)
      .stores({
        // Batch processing - indexed for node-based session and task management
        batchSessions: '&nodeId, status, startedAt, updatedAt',

        // Features - spatial and attribute indexing
        features:
          '++id, nodeId, [nodeId+adminLevel], [nodeId+countryCode], mortonCode, adminLevel, countryCode, name, createdAt',
        featureIndices:
          '&indexId, featureId, mortonCode, [mortonCode+adminLevel], adminLevel, countryCode, area, complexity',
        relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt',

        // Vector tiles - spatial tile indexing
        vectorTiles: '&tileId, nodeId, [nodeId+z+x+y], [z+x+y], z, generatedAt, lastAccessed, size',
      })
      .upgrade(async () => {
        await this.batchSessions.clear();
      });

    this.version(3).stores({
      batchSessions: '&nodeId, status, startedAt, updatedAt',
      features:
        '++id, nodeId, [nodeId+adminLevel], [nodeId+countryCode], mortonCode, adminLevel, countryCode, name, createdAt',
      featureIndices:
        '&indexId, featureId, mortonCode, [mortonCode+adminLevel], adminLevel, countryCode, area, complexity',
      relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt',
      vectorTiles: '&tileId, nodeId, [nodeId+z+x+y], [z+x+y], z, generatedAt, lastAccessed, size',
    });

    this.version(4).stores(this.mergeVectorTileStores({
      batchSessions: '&nodeId, status, startedAt, updatedAt',
      features:
        '++id, nodeId, [nodeId+adminLevel], [nodeId+countryCode], mortonCode, adminLevel, countryCode, name, createdAt',
      featureIndices:
        '&indexId, featureId, mortonCode, [mortonCode+adminLevel], adminLevel, countryCode, area, complexity',
      relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt',
      vectorTiles: '&tileId, nodeId, [nodeId+z+x+y], [z+x+y], z, generatedAt, lastAccessed, size',
    }));

    this.initVectorTileTables();
  }

  // Batch Session Management
  async createBatchSession(
    session: BatchSessionRecord,
  ): Promise<BatchSessionRecord> {
    await this.batchSessions.put(session);
    return session;
  }

  async getBatchSession(nodeId: NodeId): Promise<BatchSessionRecord | undefined> {
    return await this.batchSessions.get(nodeId);
  }

  async updateBatchSession(nodeId: NodeId, updates: Partial<BatchSessionRecord>): Promise<void> {
    await this.batchSessions.update(nodeId, {
      ...updates,
      updatedAt: Date.now(),
    });
  }

  async getActiveBatchSessions(nodeId: NodeId): Promise<BatchSessionRecord[]> {
    return await this.batchSessions
      .where('nodeId')
      .equals(nodeId)
      .and((session) => session.status === 'running' || session.status === 'paused')
      .toArray();
  }

  // Batch Task Management
  // Feature Management
  async storeFeature(feature: Omit<FeatureRecord, 'id'>): Promise<number> {
    return await this.features.add({
      ...feature,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as FeatureRecord);
  }

  async storeFeatures(features: Omit<FeatureRecord, 'id'>[]): Promise<number[]> {
    const now = Date.now();
    const featuresWithTimestamps = features.map(
      (feature) =>
        ({
          ...feature,
          createdAt: now,
          updatedAt: now,
        }) as FeatureRecord,
    );

    return await this.features.bulkAdd(featuresWithTimestamps, { allKeys: true });
  }

  async getFeaturesInBbox(
    nodeId: NodeId,
    bbox: [number, number, number, number],
    adminLevel?: number,
  ): Promise<FeatureRecord[]> {
    let query = this.features.where('nodeId').equals(nodeId);

    if (adminLevel !== undefined) {
      query = this.features.where('[nodeId+adminLevel]').equals([nodeId, adminLevel]);
    }

    return await query
      .filter((feature) => {
        if (!feature.bbox) return false;
        const [minX, minY, maxX, maxY] = feature.bbox;
        const [bMinX, bMinY, bMaxX, bMaxY] = bbox;

        return !(maxX < bMinX || minX > bMaxX || maxY < bMinY || minY > bMaxY);
      })
      .toArray();
  }

  async searchFeatures(
    nodeId: NodeId,
    query: string,
    limit: number = 50,
  ): Promise<FeatureRecord[]> {
    const searchTerm = query.toLowerCase();

    return await this.features
      .where('nodeId')
      .equals(nodeId)
      .filter(
        (feature) =>
          feature.name?.toLowerCase().includes(searchTerm) ||
          feature.nameEn?.toLowerCase().includes(searchTerm) ||
          Object.values(feature.properties).some(
            (value) => typeof value === 'string' && value.toLowerCase().includes(searchTerm),
          ),
      )
      .limit(limit)
      .toArray();
  }

  // Vector Tile Management
  async storeVectorTile(tile: VectorTileRecord): Promise<void> {
    await this.vectorTiles.put(tile);
  }

  async getVectorTile(
    nodeId: NodeId,
    z: number,
    x: number,
    y: number,
  ): Promise<VectorTileRecord | undefined> {
    const tile = await this.vectorTiles.where('[nodeId+z+x+y]').equals([nodeId, z, x, y]).first();

    if (tile) {
      // Update last accessed time
      await this.vectorTiles.update(tile.tileId, {
        lastAccessed: Date.now(),
      });
    }

    return tile;
  }

  async getTilesInZoomRange(
    nodeId: NodeId,
    minZ: number,
    maxZ: number,
  ): Promise<VectorTileRecord[]> {
    return await this.vectorTiles
      .where('nodeId')
      .equals(nodeId)
      .filter((tile) => tile.z >= minZ && tile.z <= maxZ)
      .toArray();
  }

  async getStorageUsage(): Promise<{ totalSize: number; breakdown: Record<string, number> }> {
    const [sessionsSize, featuresSize, tilesSize] =
      await Promise.all([
        this.batchSessions.toArray().then((items: BatchSessionRecord[]) => items.length * 2000),
        this.features
          .toArray()
          .then((items: FeatureRecord[]) =>
            items.reduce((sum: number, f: FeatureRecord) => sum + JSON.stringify(f).length, 0),
          ),
        this.vectorTiles
          .toArray()
          .then((items: VectorTileRecord[]) =>
            items.reduce((sum: number, t: VectorTileRecord) => sum + t.size, 0),
          ),
      ]);

    return {
      totalSize: sessionsSize + featuresSize + tilesSize,
      breakdown: {
        sessions: sessionsSize,
        features: featuresSize,
        tiles: tilesSize,
      },
    };
  }
}

// Aligned alias for cross-plugin naming consistency.
export { ShapeDB as ShapeDatabase };

// Singleton instance
export const shapeDB = new ShapeDB();
