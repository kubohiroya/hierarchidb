/**
 * ShapeDB - Main database for shape-plugin plugin using Dexie
 *
 * Manages all persistent data for the shapes plugin including:
 * - Shape entities and metadata
 * - Feature indices
 * - Vector tiles
 */

import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/core-types';
import type { Geometry } from 'geojson';
import { VectorTileDbBase } from '@hierarchidb/vectortile-store';
import type {
  FeatureFilterMethod, FetchConfig,
  HybridFilterConfig, TransformConfig, VTConfig } from '@hierarchidb/gis-sdk';

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

export type TaskDisplayKind = 'phase' | 'summary' | 'skip' | 'error' | 'info';

export type TaskDisplayMetric = {
  input: number;
  output: number;
};

export type TaskDisplayPayload = {
  kind: TaskDisplayKind;
  key?: string;
  params?: Record<string, string | number | boolean>;
  phaseCode?: string;
  phaseState?: 'start' | 'progress' | 'done';
  metrics?: Partial<Record<'features' | 'polygons' | 'vertices', TaskDisplayMetric>>;
};

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

export type BuildStopReason = 'route-leave' | 'user-pause' | 'failed' | 'completed' | 'unknown';

export interface LayerInfo {
  name: string;
  featureCount: number;
  minZoom: number;
  maxZoom: number;
  fields: string[];
}

export interface BuildSessionRecord {
  nodeId: ShapeContainerNodeId;
  draftId?: ShapeContainerNodeId;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  selectedArrayByCountries?: Record<string, boolean[]>;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  progress: ProgressInfo;
  stages: Record<BuildStage, StageStatus>;
  resourceUsage?: ResourceUsage;
  stopReason?: BuildStopReason;
  canResume?: boolean;
  lastActivity?: number;
  expiresAt?: number;
  inactiveMs?: number;
  lastHeartbeatAt?: number;
  stageInactiveMs?: number;
  stageStartedAt?: number;
  stageHeartbeatAt?: number;
  stageId?: string;
  elapsedMs?: number;
  elapsedByStage?: Record<string, number>;
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
  display?: TaskDisplayPayload;
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

export interface ShapeTileSummaryRecord {
  nodeId: ShapeContainerNodeId;
  tiles: number;
  totalBytes: number;
  zoomMin?: number;
  zoomMax?: number;
  updatedAt: number;
}

export class ShapeDB extends VectorTileDbBase {

  // Feature storage tables
  features!: Table<ShapeFeature, number>;

  // Tile storage tables
  vectorTiles!: Table<VectorTileRecord, string>;
  tileSummaries!: Table<ShapeTileSummaryRecord, ShapeContainerNodeId>;

  constructor() {
    super(getDBName('shape'));

    this.version(9).stores(this.mergeVectorTileStores({
      features: '++id, nodeId, [nodeId+adminLevel]',
      vectorTiles: '&tileId, nodeId, [nodeId+z+x+y]',
    }));
    this.version(10).stores(this.mergeVectorTileStores({
      features: '++id, nodeId, [nodeId+adminLevel]',
      vectorTiles: '&tileId, nodeId, [nodeId+z+x+y]',
      tileSummaries: '&nodeId',
    })).upgrade(async (tx) => {
      const tiles = await tx.table('vectorTiles').toArray();
      if (tiles.length === 0) return;
      const summaries = new Map<string, ShapeTileSummaryRecord>();
      const now = Date.now();
      for (const tile of tiles) {
        const nodeKey = String(tile.nodeId);
        const existing = summaries.get(nodeKey);
        if (!existing) {
          summaries.set(nodeKey, {
            nodeId: tile.nodeId,
            tiles: 1,
            totalBytes: tile.size,
            zoomMin: tile.z,
            zoomMax: tile.z,
            updatedAt: now,
          });
          continue;
        }
        existing.tiles += 1;
        existing.totalBytes += tile.size;
        existing.zoomMin = existing.zoomMin === undefined ? tile.z : Math.min(existing.zoomMin, tile.z);
        existing.zoomMax = existing.zoomMax === undefined ? tile.z : Math.max(existing.zoomMax, tile.z);
      }
      const summaryTable = tx.table('tileSummaries');
      await Promise.all(Array.from(summaries.values()).map((summary) => summaryTable.put(summary)));
    });

    this.initVectorTileTables();
    this.tileSummaries = this.table('tileSummaries');
  }

  protected mergeVectorTileStores(stores: Record<string, string>): Record<string, string> {
    return {
      ...stores,
      featureMetadata: '&id, nodeId',
      sourceMetadata: '&id, nodeId',
    };
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
    await this.transaction('rw', [this.vectorTiles, this.tileSummaries], async () => {
      const existing = await this.vectorTiles.get(tile.tileId);
      await this.vectorTiles.put(tile);
      const summary = await this.tileSummaries.get(tile.nodeId);
      const baseTiles = summary?.tiles ?? 0;
      const baseBytes = summary?.totalBytes ?? 0;
      const tiles = existing ? baseTiles : baseTiles + 1;
      const totalBytes = baseBytes - (existing?.size ?? 0) + tile.size;
      const zoomMin = summary?.zoomMin === undefined ? tile.z : Math.min(summary.zoomMin, tile.z);
      const zoomMax = summary?.zoomMax === undefined ? tile.z : Math.max(summary.zoomMax, tile.z);
      await this.tileSummaries.put({
        nodeId: tile.nodeId,
        tiles,
        totalBytes: Math.max(0, totalBytes),
        zoomMin,
        zoomMax,
        updatedAt: Date.now(),
      });
    });
  }

  async deleteVectorTile(tileId: string): Promise<void> {
    await this.transaction('rw', [this.vectorTiles, this.tileSummaries], async () => {
      const existing = await this.vectorTiles.get(tileId);
      if (!existing) return;
      await this.vectorTiles.delete(tileId);
      const summary = await this.tileSummaries.get(existing.nodeId);
      if (!summary) return;
      const nextTiles = Math.max(0, summary.tiles - 1);
      const nextBytes = Math.max(0, summary.totalBytes - existing.size);
      if (nextTiles === 0) {
        await this.tileSummaries.delete(existing.nodeId);
        return;
      }
      let zoomMin = summary.zoomMin;
      let zoomMax = summary.zoomMax;
      if (existing.z === summary.zoomMin || existing.z === summary.zoomMax) {
        const remaining = await this.vectorTiles.where('nodeId').equals(existing.nodeId).toArray();
        const zoomLevels = remaining.map((tile) => tile.z);
        zoomMin = zoomLevels.length > 0 ? Math.min(...zoomLevels) : undefined;
        zoomMax = zoomLevels.length > 0 ? Math.max(...zoomLevels) : undefined;
      }
      await this.tileSummaries.put({
        nodeId: existing.nodeId,
        tiles: nextTiles,
        totalBytes: nextBytes,
        zoomMin,
        zoomMax,
        updatedAt: Date.now(),
      });
    });
  }

  async deleteVectorTilesByNode(nodeId: ShapeContainerNodeId): Promise<void> {
    await this.transaction('rw', [this.vectorTiles, this.tileSummaries], async () => {
      await this.vectorTiles.where('nodeId').equals(nodeId).delete();
      await this.tileSummaries.delete(nodeId);
    });
  }

  async deleteVectorTilesByNodeIds(nodeIds: ShapeContainerNodeId[]): Promise<void> {
    if (nodeIds.length === 0) return;
    await this.transaction('rw', [this.vectorTiles, this.tileSummaries], async () => {
      await this.vectorTiles.where('nodeId').anyOf(nodeIds).delete();
      await this.tileSummaries.where('nodeId').anyOf(nodeIds).delete();
    });
  }

  async getVectorTileSummary(nodeId: ShapeContainerNodeId): Promise<ShapeTileSummaryRecord | undefined> {
    return await this.tileSummaries.get(nodeId);
  }

  async rebuildVectorTileSummary(nodeId: ShapeContainerNodeId): Promise<void> {
    await this.transaction('rw', [this.vectorTiles, this.tileSummaries], async () => {
      const tiles = await this.vectorTiles.where('nodeId').equals(nodeId).toArray();
      if (tiles.length === 0) {
        await this.tileSummaries.delete(nodeId);
        return;
      }
      const totalBytes = tiles.reduce((sum, tile) => sum + tile.size, 0);
      const zoomLevels = tiles.map((tile) => tile.z);
      await this.tileSummaries.put({
        nodeId,
        tiles: tiles.length,
        totalBytes,
        zoomMin: Math.min(...zoomLevels),
        zoomMax: Math.max(...zoomLevels),
        updatedAt: Date.now(),
      });
    });
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

}

// Aligned alias for cross-plugin naming consistency.
// export { ShapeDB as ShapeDatabase };

// Singleton instance
export const shapeDB = new ShapeDB();

export async function clearShapeDatabases(): Promise<void> {
  await Dexie.delete(getDBName('shape'));
  await Dexie.delete(getDBName('shape-ephemeral'));
}
