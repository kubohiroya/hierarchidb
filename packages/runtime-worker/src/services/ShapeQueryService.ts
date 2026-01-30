import type { NodeId } from '@hierarchidb/common-types';
import type {
  ShapeBuildProgressSummary,
  ShapeBuildSessionRecord,
  ShapeBuildSessionSummary,
  ShapeBuildStage,
  ShapeBuildTaskRecord,
  ShapeBuildTaskSummary,
  ShapeFeatureMetadata,
  ShapeFeatureRecord,
  ShapeFetchCache,
  ShapeProcessingStatus,
  ShapeQueryAPI,
  ShapeSourceMetadata,
  ShapeTileInfo,
  ShapeTileSummary,
  ShapeTileSummaryEntry,
  ShapeTransformCache,
  ShapeTransformErrorRecord,
  ShapeVectorTileRecord,
  ShapeVTMetadata,
} from '@hierarchidb/shape-api';
import {
  type BuildSessionRecord,
  type BuildTaskRecord,
  ephemeralShapeDB,
  type ProgressInfo,
  type ShapeDB,
} from '@hierarchidb/shape-store';
import { SingletonMixin } from '@hierarchidb/util';
import {
  countFetchDataDataSourceBuffersForNode,
  listRawDataDataSourceMetadataForNode,
  readRawDataDataSourceBuffer,
} from './shapeChunkStore.js';

const toProgressSummary = (progress: ProgressInfo): ShapeBuildProgressSummary => ({
  total: progress.total,
  completed: progress.completed,
  failed: progress.failed,
  skipped: progress.skipped,
  percentage: progress.percentage,
  taskType: progress.taskType,
});

const toShapeBuildSessionRecord = (session: BuildSessionRecord): ShapeBuildSessionRecord => {
  const resourceUsage: Record<string, unknown> | undefined = session.resourceUsage
    ? { ...session.resourceUsage }
    : undefined;
  const stages: Record<string, unknown> = { ...session.stages };
  return {
    nodeId: session.nodeId,
    draftId: session.draftId,
    status: session.status,
    config: session.config,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    completedAt: session.completedAt,
    progress: toProgressSummary(session.progress),
    stages,
    resourceUsage,
    canResume: session.canResume,
    lastActivity: session.lastActivity,
    expiresAt: session.expiresAt,
  };
};

const mapStatus = (status: BuildSessionRecord['status']): ShapeProcessingStatus['status'] => {
  if (status === 'running') return 'processing';
  if (status === 'idle') return 'idle';
  return status;
};

const toSessionSummary = (session: BuildSessionRecord): ShapeBuildSessionSummary => ({
  nodeId: session.nodeId,
  status: mapStatus(session.status),
  startedAt: session.startedAt,
  updatedAt: session.updatedAt,
  completedAt: session.completedAt,
  progress: session.progress,
});

const toTaskSummary = (task: BuildTaskRecord): ShapeBuildTaskSummary => ({
  taskId: task.taskId,
  nodeId: task.nodeId,
  taskType: task.taskType,
  status: task.status,
  index: task.index,
  progress: task.progress,
  message: task.message,
  errorMessage: task.errorMessage,
});

export class ShapeQueryService implements ShapeQueryAPI {
  static async getSingleton(db: ShapeDB): Promise<ShapeQueryService> {
    return SingletonMixin.getSingleton('ShapeQueryService', async () => new ShapeQueryService(db));
  }

  constructor(private db: ShapeDB) {}

  private async ensureOpen(): Promise<void> {
    await this.db.open?.();
  }

  async listBuildSessions(nodeId: NodeId): Promise<ShapeBuildSessionSummary[]> {
    await this.ensureOpen();
    const sessions = await this.db.buildSessions.where('nodeId').equals(nodeId).toArray();
    return sessions.map(toSessionSummary);
  }

  async getBuildSession(nodeId: NodeId): Promise<ShapeBuildSessionSummary | null> {
    await this.ensureOpen();
    const session = await this.db.buildSessions.get(nodeId);
    return session ? toSessionSummary(session) : null;
  }

  async listBuildSessionRecords(nodeId: NodeId): Promise<ShapeBuildSessionRecord[]> {
    await this.ensureOpen();
    const sessions = await this.db.buildSessions.where('nodeId').equals(nodeId).toArray();
    return sessions.map(toShapeBuildSessionRecord);
  }

  async getBuildSessionRecord(nodeId: NodeId): Promise<ShapeBuildSessionRecord | null> {
    await this.ensureOpen();
    const session = await this.db.getBuildSession(nodeId);
    return session ? toShapeBuildSessionRecord(session) : null;
  }

  async listBuildSessionRecordsByStatus(
    statuses: Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'>
  ): Promise<ShapeBuildSessionRecord[]> {
    await this.ensureOpen();
    const sessions = await this.db.buildSessions.where('status').anyOf(statuses).toArray();
    return sessions.map(toShapeBuildSessionRecord);
  }

  async listBuildTasks(nodeId: NodeId): Promise<ShapeBuildTaskSummary[]> {
    await this.ensureOpen();
    const tasks = await ephemeralShapeDB.buildTasks.where('nodeId').equals(nodeId).toArray();
    return tasks.map(toTaskSummary);
  }

  async listBuildTaskRecords(nodeId: NodeId): Promise<ShapeBuildTaskRecord[]> {
    await this.ensureOpen();
    return ephemeralShapeDB.buildTasks.where('nodeId').equals(nodeId).toArray() as Promise<
      ShapeBuildTaskRecord[]
    >;
  }

  async listBuildTaskRecordsByStage(
    nodeId: NodeId,
    stage: ShapeBuildStage
  ): Promise<ShapeBuildTaskRecord[]> {
    const tasks = await this.listBuildTaskRecords(nodeId);
    return tasks.filter((task) => task.taskType === stage);
  }

  async getBuildTaskRecord(taskId: string): Promise<ShapeBuildTaskRecord | null> {
    await this.ensureOpen();
    const task = await ephemeralShapeDB.buildTasks.get?.(taskId);
    return task ?? null;
  }

  async getProcessingStatus(nodeId: NodeId): Promise<ShapeProcessingStatus | null> {
    await this.ensureOpen();
    const sessions = await this.db.buildSessions.where('nodeId').equals(nodeId).toArray();
    const latest = sessions.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
    if (!latest) {
      return {
        status: 'idle',
        hasErrors: false,
        errorMessages: [],
      };
    }
    const totalFeatures = await this.getProcessedFeatureCount(nodeId);
    const totalVectorTiles = await this.db.vectorTiles.where('nodeId').equals(nodeId).count();
    return {
      status: mapStatus(latest.status),
      lastProcessed: latest.completedAt ?? latest.updatedAt,
      totalFeatures,
      totalVectorTiles,
      hasErrors: latest.status === 'failed',
      errorMessages: latest.status === 'failed' ? ['Build processing failed'] : [],
      stage: latest.progress?.taskType,
      progress: latest.progress?.percentage,
      lastUpdated: latest.updatedAt,
    };
  }

  async getProcessedFeatureCount(nodeId: NodeId): Promise<number> {
    await this.ensureOpen();
    return this.db.features.where('nodeId').equals(nodeId).count();
  }

  async getVectorTileInfo(
    nodeId: NodeId,
    z: number,
    x: number,
    y: number
  ): Promise<ShapeTileInfo | null> {
    await this.ensureOpen();
    const tile =
      (await this.db.getVectorTile?.(nodeId, z, x, y)) ??
      (await this.db.vectorTiles.where('[nodeId+z+x+y]').equals([nodeId, z, x, y]).toArray())[0];
    if (!tile) return null;
    return {
      exists: true,
      size: tile.size,
      features: tile.features,
      layers: tile.layers ?? [],
      generatedAt: tile.generatedAt,
      lastAccessed: tile.lastAccessed,
    };
  }

  async getVectorTileRecord(
    nodeId: NodeId,
    z: number,
    x: number,
    y: number
  ): Promise<ShapeVectorTileRecord | null> {
    await this.ensureOpen();
    const tile =
      (await this.db.getVectorTile?.(nodeId, z, x, y)) ??
      (await this.db.vectorTiles.where('[nodeId+z+x+y]').equals([nodeId, z, x, y]).toArray())[0];
    return (tile as ShapeVectorTileRecord | undefined) ?? null;
  }

  async getVectorTile(nodeId: NodeId, z: number, x: number, y: number): Promise<Uint8Array | null> {
    await this.ensureOpen();
    const tile =
      (await this.db.getVectorTile?.(nodeId, z, x, y)) ??
      (await this.db.vectorTiles.where('[nodeId+z+x+y]').equals([nodeId, z, x, y]).toArray())[0];
    if (!tile) return null;
    const data = tile.data_Uint8Array;
    if (data instanceof Uint8Array) return data;
    return new Uint8Array(data);
  }

  async listVectorTiles(nodeId: NodeId): Promise<ShapeTileSummaryEntry[]> {
    await this.ensureOpen();
    const tiles = await this.db.vectorTiles.where('nodeId').equals(nodeId).toArray();
    return tiles.map((tile) => ({
      z: tile.z,
      x: tile.x,
      y: tile.y,
      size: tile.size,
      timestamp: tile.generatedAt,
    }));
  }

  async getVectorTileSummary(nodeId: NodeId): Promise<ShapeTileSummary> {
    await this.ensureOpen();
    const tiles = await this.db.vectorTiles.where('nodeId').equals(nodeId).toArray();
    if (tiles.length === 0) {
      return { tiles: 0, totalBytes: 0 };
    }
    const totalBytes = tiles.reduce((sum, tile) => sum + tile.size, 0);
    const zoomLevels = tiles.map((tile) => tile.z);
    return {
      tiles: tiles.length,
      totalBytes,
      zoomMin: Math.min(...zoomLevels),
      zoomMax: Math.max(...zoomLevels),
    };
  }

  async listFeatures(nodeId: NodeId): Promise<ShapeFeatureRecord[]> {
    await this.ensureOpen();
    return this.db.features.where('nodeId').equals(nodeId).toArray() as Promise<
      ShapeFeatureRecord[]
    >;
  }

  async listFeaturesInBbox(
    nodeId: NodeId,
    bbox: [number, number, number, number],
    adminLevel?: number
  ): Promise<ShapeFeatureRecord[]> {
    await this.ensureOpen();
    return this.db.getFeaturesInBbox(nodeId, bbox, adminLevel) as Promise<ShapeFeatureRecord[]>;
  }

  async listFetchCaches(nodeId: NodeId): Promise<ShapeFetchCache[]> {
    const metadata = await listRawDataDataSourceMetadataForNode(nodeId);
    const records = await Promise.all(
      metadata.map(async (entry) => {
        const cacheKey = entry.cacheKey;
        if (!cacheKey) return null;
        const data = await readRawDataDataSourceBuffer(nodeId, cacheKey);
        if (!data) return null;
        return {
          id: cacheKey,
          nodeId,
          data,
          featureCount: 0,
          bbox: [0, 0, 0, 0],
          downloadTime: entry.fetchedAt ?? entry.createdAt ?? Date.now(),
          size: entry.sizeBytes ?? data.byteLength,
          timestamp: entry.updatedAt ?? entry.createdAt ?? Date.now(),
        };
      })
    );
    return records.filter(Boolean) as ShapeFetchCache[];
  }

  async getFetchCache(nodeId: NodeId, bufferId: string): Promise<ShapeFetchCache | null> {
    const data = await readRawDataDataSourceBuffer(nodeId, bufferId);
    if (!data) return null;
    return {
      id: bufferId,
      nodeId,
      data,
      featureCount: 0,
      bbox: [0, 0, 0, 0],
      downloadTime: Date.now(),
      size: data.byteLength,
      timestamp: Date.now(),
    };
  }

  async countFetchCaches(nodeId: NodeId): Promise<number> {
    return countFetchDataDataSourceBuffersForNode(nodeId);
  }

  async listTransformCaches(nodeId: NodeId): Promise<ShapeTransformCache[]> {
    return await ephemeralShapeDB.transaction('r', ephemeralShapeDB.transformCache, async () => {
      const records = await ephemeralShapeDB.transformCache
        .where('nodeId')
        .equals(nodeId)
        .toArray();
      return records.filter((record) => record.timestamp > 0);
    });
  }

  async getTransformCache(bufferId: string): Promise<ShapeTransformCache | null> {
    return await ephemeralShapeDB.transaction('r', ephemeralShapeDB.transformCache, async () => {
      const record = await ephemeralShapeDB.transformCache.get(bufferId);
      if (!record || record.timestamp <= 0) return null;
      return record;
    });
  }

  async listVTMetadata(nodeId: NodeId): Promise<ShapeVTMetadata[]> {
    const rows = await this.db.vectorTiles.where('nodeId').equals(nodeId).toArray();
    return rows.map((row) => ({
      key: row.tileId,
      nodeId: String(nodeId),
      z: row.z,
      x: row.x,
      y: row.y,
      size: row.size,
      contentType: 'application/vnd.mapbox-vector-tile',
      timestamp: row.generatedAt,
    }));
  }

  async listSourceMetadata(nodeId: NodeId): Promise<ShapeSourceMetadata[]> {
    return this.db.sourceMetadata.where('nodeId').equals(String(nodeId)).toArray() as Promise<
      ShapeSourceMetadata[]
    >;
  }

  async listFeatureMetadata(nodeId: NodeId): Promise<ShapeFeatureMetadata[]> {
    return this.db.featureMetadata.where('nodeId').equals(String(nodeId)).toArray() as Promise<
      ShapeFeatureMetadata[]
    >;
  }

  async listTransformErrorRecords(nodeId: NodeId): Promise<ShapeTransformErrorRecord[]> {
    return ephemeralShapeDB.transformErrors.where('nodeId').equals(nodeId).toArray() as Promise<
      ShapeTransformErrorRecord[]
    >;
  }
}
