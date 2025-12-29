/**
 * ShapeDB - Main database for shape-plugin plugin using Dexie
 *
 * Manages all persistent data for the shapes plugin including:
 * - Shape entities and metadata
 * - Batch sessions and tasks
 * - Feature indices and buffers
 * - Vector tiles and cache
 */

import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type { Geometry } from 'geojson';
type CacheEntryData = Record<string, unknown> | string | number | boolean | null;

export type DataSourceName = 'naturalearth' | 'geoboundaries' | 'gadm' | 'openstreetmap';
export type FeatureFilterMethod = 'bbox_only' | 'polygon_only' | 'hybrid';

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

export interface SimplifySession1Config {
  concurrentProcesses: number;
  enableFeatureFiltering: boolean;
  featureAreaThreshold: number;
  minVertexCountForAreaFilter: number;
  aspectRatioThreshold: number;
  featureFilterMethod: FeatureFilterMethod;
  hybridFilterConfig?: HybridFilterConfig;
  deleteOnComplete?: boolean;
}

export interface SimplifySession2Config {
  concurrentProcesses: number;
  quantize: number;
  simplify: number;
  tolerance: number;
  enablePerFeatureSimplification: boolean;
  deleteOnComplete?: boolean;
}

export interface GenerateVectorTilesConfig {
  concurrentProcesses: number;
  minZoom: number;
  maxZoom: number;
  bufferSize?: number;
  tileSize?: number;
}

export interface BatchSessionConfig extends CommonSessionConfig {
  download: DownloadSessionConfig;
  simplify1: SimplifySession1Config;
  simplify2: SimplifySession2Config;
  vectorTiles: GenerateVectorTilesConfig;
  concurrentDownloads?: number;
  concurrentProcesses?: number;
  quantize?: number;
  simplify?: number;
  tolerance?: number;
  maxZoom?: number;
  minZoom?: number;
  featureAreaThreshold?: number;
  minVertexCountForAreaFilter?: number;
  enableFeatureFiltering?: boolean;
  enablePerFeatureSimplification?: boolean;
  aspectRatioThreshold?: number;
  featureFilterMethod?: FeatureFilterMethod;
  hybridFilterConfig?: HybridFilterConfig;
  deleteDownloadCacheOnComplete?: boolean;
  deleteSimplify1CacheOnComplete?: boolean;
  deleteSimplify2CacheOnComplete?: boolean;
}

export type BatchProcessConfig = BatchSessionConfig;
export type BatchTaskType = 'download' | 'simplify1' | 'simplify2' | 'vectortile';
export type ProcessingStage = BatchTaskType;
export type TaskStatus = 'waiting' | 'running' | 'completed' | 'failed' | 'cancelled';

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
  sessionId: string;
  nodeId: NodeId;
  draftId?: NodeId;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
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

export interface BatchTaskRecord {
  taskId: string;
  sessionId: string;
  taskType: BatchTaskType;
  status: TaskStatus;
  index: number;
  progress: number;
  message?: string;
  startedAt?: number;
  completedAt?: number;
  retryCount?: number;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
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
  simplificationLevel?: number;
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

export class ShapeDB extends Dexie {

  // Batch processing tables
  batchSessions!: Table<BatchSessionRecord, string>;
  batchTasks!: Table<BatchTaskRecord, string>;

  // Feature storage tables
  features!: Table<FeatureRecord, number>;
  featureIndices!: Table<FeatureIndexRecord, string>;
  featureBuffers!: Table<FeatureBufferRecord, string>;

  // Tile storage tables
  vectorTiles!: Table<VectorTileRecord, string>;
  tileBuffers!: Table<TileBufferRecord, string>;

  // Cache tables
  cache!: Table<CacheEntryRecord, string>;

  constructor() {
    super(getDBName('shape'));

    this.version(1).stores({

      // Batch processing - indexed for session and task management
      batchSessions: '&sessionId, nodeId, status, startedAt, updatedAt',
      batchTasks:
        '&taskId, sessionId, [sessionId+status], [sessionId+type], [sessionId+index], status, type, startedAt',

      // Features - spatial and attribute indexing
      features:
        '++id, nodeId, [nodeId+adminLevel], [nodeId+countryCode], mortonCode, adminLevel, countryCode, name, createdAt',
      featureIndices:
        '&indexId, featureId, mortonCode, [mortonCode+adminLevel], adminLevel, countryCode, area, complexity',
      featureBuffers: '&bufferId, nodeId, [nodeId+stage], stage, createdAt, byteSize',

      // Vector tiles - spatial tile indexing
      vectorTiles: '&tileId, nodeId, [nodeId+z+x+y], [z+x+y], z, generatedAt, lastAccessed, size',
      tileBuffers: '&bufferId, nodeId, [nodeId+z+x+y], [z+x+y], z, stage, createdAt',

      // Cache - LRU and size-based management
      cache:
        '&cacheKey, nodeId, cacheType, [cacheType+lastHit], lastHit, createdAt, size, hits, expiresAt',
    });
  }

  // Batch Session Management
  async createBatchSession(
    session: Omit<BatchSessionRecord, 'sessionId'> & { sessionId?: string },
  ): Promise<BatchSessionRecord> {
    const sessionId = session.sessionId ?? String(session.nodeId ?? crypto.randomUUID());
    const fullSession: BatchSessionRecord = {
      ...session,
      sessionId,
    };

    await this.batchSessions.put(fullSession);
    return fullSession;
  }

  async getBatchSession(sessionId: string): Promise<BatchSessionRecord | undefined> {
    return await this.batchSessions.get(sessionId);
  }

  async updateBatchSession(sessionId: string, updates: Partial<BatchSessionRecord>): Promise<void> {
    await this.batchSessions.update(sessionId, {
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
  async createBatchTask(
    task: Omit<BatchTaskRecord, 'taskId'> & { taskId?: string },
  ): Promise<BatchTaskRecord> {
    const taskId = task.taskId ?? crypto.randomUUID();
    const fullTask: BatchTaskRecord = {
      ...task,
      taskId,
    };

    await this.batchTasks.put(fullTask);
    return fullTask;
  }

  async updateBatchTask(taskId: string, updates: Partial<BatchTaskRecord>): Promise<void> {
    await this.batchTasks.update(taskId, updates);
  }

  async getBatchTasks(sessionId: string): Promise<BatchTaskRecord[]> {
    return await this.batchTasks.where('sessionId').equals(sessionId).sortBy('index');
  }

  async getTasksByStatus(sessionId: string, status: TaskStatus): Promise<BatchTaskRecord[]> {
    return await this.batchTasks.where('[sessionId+status]').equals([sessionId, status]).toArray();
  }

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

  // Feature Buffer Management
  async storeFeatureBuffer(buffer: FeatureBufferRecord): Promise<void> {
    await this.featureBuffers.put(buffer);
  }

  async getFeatureBuffer(bufferId: string): Promise<FeatureBufferRecord | undefined> {
    return await this.featureBuffers.get(bufferId);
  }

  async getBuffersByStage(nodeId: NodeId, stage: ProcessingStage): Promise<FeatureBufferRecord[]> {
    return await this.featureBuffers.where('[nodeId+stage]').equals([nodeId, stage]).toArray();
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

  // Cache Management
  async setCacheEntry(entry: CacheEntryRecord): Promise<void> {
    await this.cache.put(entry);
  }

  async getCacheEntry(cacheKey: string): Promise<CacheEntryRecord | undefined> {
    const entry = await this.cache.get(cacheKey);
    if (entry) {
      // Update hit count and last hit time
      await this.cache.update(cacheKey, {
        hits: entry.hits + 1,
        lastHit: Date.now(),
      });
    }
    return entry;
  }

  async clearCache(nodeId?: NodeId, cacheType?: string): Promise<number> {
    let query = this.cache.toCollection();

    if (nodeId) {
      query = this.cache.where('nodeId').equals(nodeId);
    }

    if (cacheType) {
      query = query.filter((entry) => entry.cacheType === cacheType);
    }

    const count = await query.count();
    await query.delete();
    return count;
  }

  async getCacheStatistics(): Promise<CacheStatistics> {
    const allEntries = await this.cache.toArray();

    const totalSize = allEntries.reduce((sum, entry) => sum + entry.size, 0);
    const totalItems = allEntries.length;
    const totalHits = allEntries.reduce((sum, entry) => sum + entry.hits, 0);
    const totalMisses = Math.max(totalHits * 0.1, 0);
    const totalRequests = totalHits + totalMisses;

    const byType: Record<string, { totalSize: number; count: number; averageSize: number }> = {};
    for (const type of ['features', 'tiles', 'buffers', 'all']) {
      const entries = type === 'all' ? allEntries : allEntries.filter((e) => e.cacheType === type);
      const size = entries.reduce((sum, entry) => sum + entry.size, 0);
      const count = entries.length;
      // const hits = entries.reduce((sum, entry) => sum + entry.hits, 0);

      byType[type] = {
        totalSize: size,
        count,
        averageSize: count > 0 ? size / count : 0,
      };
    }

    return {
      hits: totalHits,
      misses: totalMisses,
      totalSize,
      totalItems,
      byType,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      missRate: totalRequests > 0 ? totalMisses / totalRequests : 0,
      evictionCount: 0,
      oldestItem:
        allEntries.length > 0 ? Math.min(...allEntries.map((e) => e.createdAt)) : Date.now(),
      newestItem:
        allEntries.length > 0 ? Math.max(...allEntries.map((e) => e.createdAt)) : Date.now(),
    };
  }

  // Cleanup and Maintenance
  async cleanupExpiredCache(): Promise<number> {
    const now = Date.now();
    const expired = await this.cache.where('expiresAt').below(now).toArray();

    if (expired.length > 0) {
      await this.cache.bulkDelete(expired.map((e) => e.cacheKey));
    }

    return expired.length;
  }

  async getStorageUsage(): Promise<{ totalSize: number; breakdown: Record<string, number> }> {
    const [ sessionsSize, tasksSize, featuresSize, buffersSize, tilesSize, cacheSize] =
      await Promise.all([
        this.batchSessions.toArray().then((items: BatchSessionRecord[]) => items.length * 2000),
        this.batchTasks.toArray().then((items: BatchTaskRecord[]) => items.length * 1000),
        this.features
          .toArray()
          .then((items: FeatureRecord[]) =>
            items.reduce((sum: number, f: FeatureRecord) => sum + JSON.stringify(f).length, 0),
          ),
        this.featureBuffers
          .toArray()
          .then((items: FeatureBufferRecord[]) =>
            items.reduce((sum: number, b: FeatureBufferRecord) => sum + b.byteSize, 0),
          ),
        this.vectorTiles
          .toArray()
          .then((items: VectorTileRecord[]) =>
            items.reduce((sum: number, t: VectorTileRecord) => sum + t.size, 0),
          ),
        this.cache
          .toArray()
          .then((items: CacheEntryRecord[]) =>
            items.reduce((sum: number, c: CacheEntryRecord) => sum + c.size, 0),
          ),
      ]);

    return {
      totalSize:
        sessionsSize + tasksSize + featuresSize + buffersSize + tilesSize + cacheSize,
      breakdown: {
        sessions: sessionsSize,
        tasks: tasksSize,
        features: featuresSize,
        buffers: buffersSize,
        tiles: tilesSize,
        cache: cacheSize,
      },
    };
  }
}

// Aligned alias for cross-plugin naming consistency.
export { ShapeDB as ShapeDatabase };

// Singleton instance
export const shapeDB = new ShapeDB();
