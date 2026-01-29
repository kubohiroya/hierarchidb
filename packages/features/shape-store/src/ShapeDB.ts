/**
 * ShapeDB - Main database for shape-plugin plugin using Dexie
 *
 * Manages all persistent data for the shapes plugin including:
 * - Shape entities and metadata
 * - Build sessions and tasks
 * - Feature indices
 * - Vector tiles
 */

import type { Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type { Geometry } from 'geojson';
import { VectorTileDbBase } from '@hierarchidb/vectortile-store';
import type {
  FeatureFilterMethod, FetchConfig,
  HybridFilterConfig, TransformConfig, VTConfig } from '@hierarchidb/gis-sdk';
type CacheEntryData = Record<string, unknown> | string | number | boolean | null;

export type DataSourceName = 'naturalearth' | 'geoboundaries' | 'geoboundaries-topojson' | 'gadm' | 'openstreetmap';

export interface CommonSessionConfig {
  dataSource?: DataSourceName;
}

export interface BuildSessionConfig extends CommonSessionConfig {
  fetchConfig: FetchConfig;
  transformConfig: TransformConfig;
  vectorTiles: VTConfig;
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
export type BuildTaskType = 'fetch' | 'transform' | 'vt';
export type BuildStage = BuildTaskType;
export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'regression';

export interface ProgressInfo {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
  taskType?: BuildStage | 'processing';
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

export interface BuildSessionRecord {
  nodeId: ShapeContainerNodeId;
  draftId?: ShapeContainerNodeId;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  config: BuildProcessConfig;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  progress: ProgressInfo;
  stages: Record<BuildStage, StageStatus>;
  resourceUsage?: ResourceUsage;
  canResume?: boolean;
  lastActivity?: number;
  expiresAt?: number;
}

export type FetchTaskPayload = {
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

export type FetchTaskResult = {
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

export type VTTaskPayload = {
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

export type VTTaskResult = {
  tileId: string;
  tileCount?: number;
  totalBytes?: number;
  retry?: number;
};

export type ShapeBuildTaskPayload =
  | FetchTaskPayload
  | TransformByBandTaskPayload
  | TransormByZoomTaskPayload
  | VTTaskPayload;

export type ShapeBuildTaskResult =
  | FetchTaskResult
  | TransformByBandTaskResult
  | TransformByZoomTaskResult
  | VTTaskResult;

export interface BuildTaskRecord<TInput = ShapeBuildTaskPayload, TOutput = ShapeBuildTaskResult> {
  taskId: string;
  nodeId: ShapeContainerNodeId;
  taskType: BuildTaskType;
  status: TaskStatus;
  index: number;
  progress: number;
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

export interface TileBufferRecord {
  bufferId: string;
  nodeId: ShapeContainerNodeId;
  z: number;
  x: number;
  y: number;
  stage: BuildStage;
  data_Uint8Array: Uint8Array;
  featureCount: number;
  byteSize: number;
  createdAt: number;
}

export interface CacheEntryRecord {
  cacheKey: string;
  nodeId?: ShapeContainerNodeId;
  cacheType: 'features' | 'tiles' | 'buffers' | 'metadata';
  data: CacheEntryData;
  size: number;
  hits: number;
  lastHit: number;
  createdAt: number;
  expiresAt?: number;
}

export class ShapeDB extends VectorTileDbBase {

  // Build processing tables
  buildSessions!: Table<BuildSessionRecord, ShapeContainerNodeId>;

  // Feature storage tables
  features!: Table<ShapeFeature, number>;

  // Tile storage tables
  vectorTiles!: Table<VectorTileRecord, string>;

  constructor() {
    super(getDBName('shape'));

    this.version(5).stores(this.mergeVectorTileStores({
      batchSessions: '&nodeId, status, startedAt, updatedAt',
      features:
        '++id, nodeId, [nodeId+adminLevel], [nodeId+countryCode], mortonCode, adminLevel, countryCode, name, createdAt',
      relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt',
      vectorTiles: '&tileId, nodeId, [nodeId+z+x+y], [z+x+y], z, generatedAt, lastAccessed, size',
    }));
    this.version(6).stores(this.mergeVectorTileStores({
      buildSessions: '&nodeId, status, startedAt, updatedAt',
      features:
        '++id, nodeId, [nodeId+adminLevel], [nodeId+countryCode], mortonCode, adminLevel, countryCode, name, createdAt',
      vectorTiles: '&tileId, nodeId, [nodeId+z+x+y], [z+x+y], z, generatedAt, lastAccessed, size',
    })).upgrade(async (tx) => {
      const previous = await tx.table('batchSessions').toArray();
      if (previous.length > 0) {
        await tx.table('buildSessions').bulkPut(previous);
      }
    });

    this.initVectorTileTables();
    this.buildSessions = this.table('buildSessions');
  }

  // Build Session Management
  async createBuildSession(
    session: BuildSessionRecord,
  ): Promise<BuildSessionRecord> {
    await this.buildSessions.put(session);
    return session;
  }

  async getBuildSession(nodeId: ShapeContainerNodeId): Promise<BuildSessionRecord | undefined> {
    return await this.buildSessions.get(nodeId);
  }

  async updateBuildSession(nodeId: ShapeContainerNodeId, updates: Partial<BuildSessionRecord>): Promise<void> {
    await this.buildSessions.update(nodeId, {
      ...updates,
      updatedAt: Date.now(),
    });
  }

  async getActiveBuildSessions(nodeId: ShapeContainerNodeId): Promise<BuildSessionRecord[]> {
    return await this.buildSessions
      .where('nodeId')
      .equals(nodeId)
      .and((session) => session.status === 'running' || session.status === 'paused')
      .toArray();
  }

  // Build Task Management
  // Feature Management
  async storeFeature(feature: Omit<ShapeFeature, 'id'>): Promise<number> {
    return await this.features.add({
      ...feature,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as ShapeFeature);
  }

  async storeFeatures(features: Omit<ShapeFeature, 'id'>[]): Promise<number[]> {
    const now = Date.now();
    const featuresWithTimestamps = features.map(
      (feature) =>
        ({
          ...feature,
          createdAt: now,
          updatedAt: now,
        }) as ShapeFeature,
    );

    return await this.features.bulkAdd(featuresWithTimestamps, { allKeys: true });
  }

  async getFeaturesInBbox(
    nodeId: ShapeContainerNodeId,
    bbox: [number, number, number, number],
    adminLevel?: number,
  ): Promise<ShapeFeature[]> {
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
    nodeId: ShapeContainerNodeId,
    query: string,
    limit: number = 50,
  ): Promise<ShapeFeature[]> {
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
    nodeId: ShapeContainerNodeId,
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
    nodeId: ShapeContainerNodeId,
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
        this.buildSessions.toArray().then((items: BuildSessionRecord[]) => items.length * 2000),
        this.features
          .toArray()
          .then((items: ShapeFeature[]) =>
            items.reduce((sum: number, f: ShapeFeature) => sum + JSON.stringify(f).length, 0),
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
// export { ShapeDB as ShapeDatabase };

// Singleton instance
export const shapeDB = new ShapeDB();
