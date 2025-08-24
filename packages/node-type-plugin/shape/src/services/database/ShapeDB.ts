/**
 * ShapeDB - Main database for shape plugin using Dexie
 * 
 * Manages all persistent data for the shapes plugin including:
 * - Shape entities and metadata
 * - Batch sessions and tasks
 * - Feature indices and buffers
 * - Vector tiles and cache
 */

import Dexie, { Table } from 'dexie';
import type { NodeId, EntityId } from '@hierarchidb/common-core';
import type {
  // Core entity types
  ShapeEntity,
  DataSourceName,
  
  // Batch processing types
  BatchSession,
  BatchTask,
  TaskStatus,
  ProcessingStage,
  
  // Feature storage types
  Feature,
  FeatureIndex,
  
  // Tile storage types
  VectorTileEntity,
  
  // Cache types
  CacheStatistics,
} from '../../types';

// Database schema interfaces
export interface ShapeEntityRecord extends ShapeEntity {
  id: EntityId;
  nodeId: NodeId;
  name: string;
  description?: string;
  dataSourceName: DataSourceName;
  processingConfig: any;
  status: 'draft' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface BatchSessionRecord extends BatchSession {
  sessionId: string;
  nodeId: NodeId;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  config: any;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  progress: any;
  stages: Record<ProcessingStage, any>;
  resourceUsage?: any;
}

export interface BatchTaskRecord {
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
  inputData?: any;
  outputData?: any;
  errorMessage?: string;
}

export interface FeatureRecord extends Feature {
  id: number;
  nodeId: NodeId;
  properties: Record<string, any>;
  geometry: any; // GeoJSON.Geometry
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

export interface FeatureIndexRecord extends FeatureIndex {
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
  data: Uint8Array;
  format: 'geojson' | 'topojson' | 'geobuf';
  featureCount: number;
  byteSize: number;
  compression?: string;
  createdAt: number;
  metadata?: any;
}

export interface VectorTileRecord extends VectorTileEntity {
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

export interface TileBufferRecord {
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

export interface CacheEntryRecord {
  cacheKey: string;
  nodeId?: NodeId;
  cacheType: 'features' | 'tiles' | 'buffers' | 'metadata';
  data: any;
  size: number;
  hits: number;
  lastHit: number;
  createdAt: number;
  expiresAt?: number;
}

export class ShapeDB extends Dexie {
  // Core entity tables
  shapeEntities!: Table<ShapeEntityRecord, EntityId>;
  
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
    super('ShapeDB');
    
    this.version(1).stores({
      // Core entities - indexed by nodeId for tree integration
      shapeEntities: '&id, nodeId, status, dataSourceName, createdAt, updatedAt',
      
      // Batch processing - indexed for session and task management
      batchSessions: '&sessionId, nodeId, status, startedAt, updatedAt',
      batchTasks: '&taskId, sessionId, [sessionId+status], [sessionId+type], [sessionId+index], status, type, startedAt',
      
      // Features - spatial and attribute indexing
      features: '++id, nodeId, [nodeId+adminLevel], [nodeId+countryCode], mortonCode, adminLevel, countryCode, name, createdAt',
      featureIndices: '&indexId, featureId, mortonCode, [mortonCode+adminLevel], adminLevel, countryCode, area, complexity',
      featureBuffers: '&bufferId, nodeId, [nodeId+stage], stage, createdAt, byteSize',
      
      // Vector tiles - spatial tile indexing
      vectorTiles: '&tileId, nodeId, [nodeId+z+x+y], [z+x+y], z, generatedAt, lastAccessed, size',
      tileBuffers: '&bufferId, nodeId, [nodeId+z+x+y], [z+x+y], z, stage, createdAt',
      
      // Cache - LRU and size-based management
      cache: '&cacheKey, nodeId, cacheType, [cacheType+lastHit], lastHit, createdAt, size, hits'
    });
  }

  // Batch Session Management
  async createBatchSession(session: Omit<BatchSessionRecord, 'sessionId'>): Promise<BatchSessionRecord> {
    const sessionId = crypto.randomUUID();
    const fullSession: BatchSessionRecord = {
      ...session,
      sessionId,
    };
    
    await this.batchSessions.add(fullSession);
    return fullSession;
  }

  async getBatchSession(sessionId: string): Promise<BatchSessionRecord | undefined> {
    return await this.batchSessions.get(sessionId);
  }

  async updateBatchSession(sessionId: string, updates: Partial<BatchSessionRecord>): Promise<void> {
    await this.batchSessions.update(sessionId, {
      ...updates,
      updatedAt: Date.now()
    });
  }

  async getActiveBatchSessions(nodeId: NodeId): Promise<BatchSessionRecord[]> {
    return await this.batchSessions
      .where('nodeId')
      .equals(nodeId)
      .and(session => 
        session.status === 'running' || session.status === 'paused'
      )
      .toArray();
  }

  // Batch Task Management
  async createBatchTask(task: Omit<BatchTaskRecord, 'taskId'>): Promise<BatchTaskRecord> {
    const taskId = crypto.randomUUID();
    const fullTask: BatchTaskRecord = {
      ...task,
      taskId,
    };
    
    await this.batchTasks.add(fullTask);
    return fullTask;
  }

  async updateBatchTask(taskId: string, updates: Partial<BatchTaskRecord>): Promise<void> {
    await this.batchTasks.update(taskId, updates);
  }

  async getBatchTasks(sessionId: string): Promise<BatchTaskRecord[]> {
    return await this.batchTasks
      .where('sessionId')
      .equals(sessionId)
      .sortBy('index');
  }

  async getTasksByStatus(sessionId: string, status: TaskStatus): Promise<BatchTaskRecord[]> {
    return await this.batchTasks
      .where('[sessionId+status]')
      .equals([sessionId, status])
      .toArray();
  }

  // Feature Management
  async storeFeature(feature: Omit<FeatureRecord, 'id'>): Promise<number> {
    return await this.features.add({
      ...feature,
      createdAt: Date.now(),
      updatedAt: Date.now()
    } as FeatureRecord);
  }

  async storeFeatures(features: Omit<FeatureRecord, 'id'>[]): Promise<number[]> {
    const now = Date.now();
    const featuresWithTimestamps = features.map(feature => ({
      ...feature,
      createdAt: now,
      updatedAt: now
    } as FeatureRecord));
    
    return await this.features.bulkAdd(featuresWithTimestamps, { allKeys: true });
  }

  async getFeaturesInBbox(
    nodeId: NodeId, 
    bbox: [number, number, number, number],
    adminLevel?: number
  ): Promise<FeatureRecord[]> {
    let query = this.features.where('nodeId').equals(nodeId);
    
    if (adminLevel !== undefined) {
      query = this.features.where('[nodeId+adminLevel]').equals([nodeId, adminLevel]);
    }
    
    return await query
      .filter(feature => {
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
    limit: number = 50
  ): Promise<FeatureRecord[]> {
    const searchTerm = query.toLowerCase();
    
    return await this.features
      .where('nodeId')
      .equals(nodeId)
      .filter(feature => 
        feature.name?.toLowerCase().includes(searchTerm) ||
        feature.nameEn?.toLowerCase().includes(searchTerm) ||
        Object.values(feature.properties).some(value => 
          typeof value === 'string' && value.toLowerCase().includes(searchTerm)
        )
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
    return await this.featureBuffers
      .where('[nodeId+stage]')
      .equals([nodeId, stage])
      .toArray();
  }

  // Vector Tile Management
  async storeVectorTile(tile: VectorTileRecord): Promise<void> {
    await this.vectorTiles.put(tile);
  }

  async getVectorTile(nodeId: NodeId, z: number, x: number, y: number): Promise<VectorTileRecord | undefined> {
    const tile = await this.vectorTiles
      .where('[nodeId+z+x+y]')
      .equals([nodeId, z, x, y])
      .first();
    
    if (tile) {
      // Update last accessed time
      await this.vectorTiles.update(tile.tileId, {
        lastAccessed: Date.now()
      });
    }
    
    return tile;
  }

  async getTilesInZoomRange(nodeId: NodeId, minZ: number, maxZ: number): Promise<VectorTileRecord[]> {
    return await this.vectorTiles
      .where('nodeId')
      .equals(nodeId)
      .filter(tile => tile.z >= minZ && tile.z <= maxZ)
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
        lastHit: Date.now()
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
      query = query.filter(entry => entry.cacheType === cacheType);
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
    
    const byType: Record<string, any> = {};
    for (const type of ['features', 'tiles', 'buffers', 'all']) {
      const entries = type === 'all' ? allEntries : allEntries.filter(e => e.cacheType === type);
      const size = entries.reduce((sum, entry) => sum + entry.size, 0);
      const count = entries.length;
      const hits = entries.reduce((sum, entry) => sum + entry.hits, 0);
      
      byType[type] = {
        size,
        count,
        hits,
        misses: Math.max(hits * 0.1, 0), // Estimate
        evictions: 0, // Would need separate tracking
        averageSize: count > 0 ? size / count : 0
      };
    }
    
    return {
      totalSize,
      totalItems,
      byType,
      hitRate: totalHits > 0 ? totalHits / (totalHits * 1.1) : 0,
      missRate: totalHits > 0 ? (totalHits * 0.1) / (totalHits * 1.1) : 0,
      evictionCount: 0,
      oldestItem: allEntries.length > 0 ? Math.min(...allEntries.map(e => e.createdAt)) : Date.now(),
      newestItem: allEntries.length > 0 ? Math.max(...allEntries.map(e => e.createdAt)) : Date.now()
    };
  }

  // Cleanup and Maintenance
  async cleanupExpiredCache(): Promise<number> {
    const now = Date.now();
    const expired = await this.cache
      .where('expiresAt')
      .below(now)
      .toArray();
    
    if (expired.length > 0) {
      await this.cache.bulkDelete(expired.map(e => e.cacheKey));
    }
    
    return expired.length;
  }

  async getStorageUsage(): Promise<{ totalSize: number; breakdown: Record<string, number> }> {
    const [
      shapesSize,
      sessionsSize,
      tasksSize,
      featuresSize,
      buffersSize,
      tilesSize,
      cacheSize
    ] = await Promise.all([
      this.shapeEntities.toArray().then((items: any[]) => items.length * 1000), // Estimate
      this.batchSessions.toArray().then((items: any[]) => items.length * 2000),
      this.batchTasks.toArray().then((items: any[]) => items.length * 1000),
      this.features.toArray().then((items: any[]) => items.reduce((sum: number, f: any) => sum + JSON.stringify(f).length, 0)),
      this.featureBuffers.toArray().then((items: any[]) => items.reduce((sum: number, b: any) => sum + b.byteSize, 0)),
      this.vectorTiles.toArray().then((items: any[]) => items.reduce((sum: number, t: any) => sum + t.size, 0)),
      this.cache.toArray().then((items: any[]) => items.reduce((sum: number, c: any) => sum + c.size, 0))
    ]);
    
    return {
      totalSize: shapesSize + sessionsSize + tasksSize + featuresSize + buffersSize + tilesSize + cacheSize,
      breakdown: {
        shapes: shapesSize,
        sessions: sessionsSize,
        tasks: tasksSize,
        features: featuresSize,
        buffers: buffersSize,
        tiles: tilesSize,
        cache: cacheSize
      }
    };
  }
}

// Singleton instance
export const shapeDB = new ShapeDB();