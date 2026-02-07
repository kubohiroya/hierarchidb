import type { NodeId } from '@hierarchidb/core-types';
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
import type {
  BuildProcessConfig,
  BuildSessionRecord,
  BuildTaskType,
  ProgressInfo,
  ResourceUsage,
  ShapeDB,
  StageStatus,
} from '@hierarchidb/shape-store';
import {
  hidbEphemeralDB as ephemeralShapeDB,
  type EphemeralBuildSessionRecord,
} from '@hierarchidb/gis-sdk';
import { SingletonMixin } from '@hierarchidb/util';
import {
  countFetchDataDataSourceBuffersForNode,
  listRawDataDataSourceMetadataForNode,
  readRawDataDataSourceBuffer,
} from './shapeChunkStore.js';

const toBuildStage = (stage?: string): ProgressInfo['taskType'] => {
  if (stage === 'processing') return stage;
  if (stage === 'fetch' || stage === 'transform' || stage === 'vt') return stage;
  return undefined;
};

const toProgressInfo = (progress: ShapeBuildProgressSummary): ProgressInfo => ({
  total: progress.total,
  completed: progress.completed,
  failed: progress.failed,
  skipped: progress.skipped,
  percentage: progress.percentage,
  taskType: toBuildStage(progress.taskType),
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
    progress: toProgressInfo(session.progress),
    stages,
    resourceUsage,
    stopReason: session.stopReason,
    canResume: session.canResume,
    lastActivity: session.lastActivity,
    expiresAt: session.expiresAt,
    inactiveMs: session.inactiveMs,
    lastHeartbeatAt: session.lastHeartbeatAt,
    stageInactiveMs: session.stageInactiveMs,
    stageStartedAt: session.stageStartedAt,
    stageHeartbeatAt: session.stageHeartbeatAt,
    stageId: session.stageId,
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

const toTaskSummary = (task: ShapeBuildTaskRecord): ShapeBuildTaskSummary => ({
  taskId: task.taskId,
  nodeId: task.nodeId,
  taskType: task.taskType,
  status: task.status,
  index: task.index,
  progress: task.progress,
  message: task.message,
  errorMessage: task.errorMessage,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isTaskStatus = (value: unknown): value is StageStatus['status'] =>
  value === 'queued'
  || value === 'running'
  || value === 'completed'
  || value === 'failed'
  || value === 'regression';

const isStageStatus = (value: unknown): value is StageStatus => {
  if (!isRecord(value)) return false;
  return isTaskStatus(value.status)
    && isNumber(value.progress)
    && isNumber(value.tasksTotal)
    && isNumber(value.tasksCompleted)
    && isNumber(value.tasksFailed)
    && (value.message === undefined || typeof value.message === 'string');
};

const isBuildProcessConfig = (value: unknown): value is BuildProcessConfig => {
  if (!isRecord(value)) return false;
  return isRecord(value.download)
    && isRecord(value.extract1)
    && isRecord(value.extract2)
    && isRecord(value.vectorTiles);
};

const isProgressSummary = (value: unknown): value is ShapeBuildProgressSummary => {
  if (!isRecord(value)) return false;
  return isNumber(value.total)
    && isNumber(value.completed)
    && isNumber(value.failed)
    && isNumber(value.skipped)
    && isNumber(value.percentage)
    && (value.taskType === undefined || typeof value.taskType === 'string');
};

const readStageMap = (value: unknown): Record<BuildTaskType, StageStatus> | null => {
  if (!isRecord(value)) return null;
  const fetch = value.fetch;
  const transform = value.transform;
  const vt = value.vt;
  if (!isStageStatus(fetch) || !isStageStatus(transform) || !isStageStatus(vt)) return null;
  return { fetch, transform, vt };
};

const readResourceUsage = (value: unknown): ResourceUsage | undefined => {
  if (!isRecord(value)) return undefined;
  if (!isNumber(value.memoryUsed)
    || !isNumber(value.memoryPeak)
    || !isNumber(value.cpuPercent)
    || !isNumber(value.storageUsed)
    || !isNumber(value.networkBytesReceived)
    || !isNumber(value.networkBytesSent)) {
    return undefined;
  }
  return {
    memoryUsed: value.memoryUsed,
    memoryPeak: value.memoryPeak,
    cpuPercent: value.cpuPercent,
    storageUsed: value.storageUsed,
    networkBytesReceived: value.networkBytesReceived,
    networkBytesSent: value.networkBytesSent,
  };
};

const toBuildSessionRecordFromEphemeral = (
  session: EphemeralBuildSessionRecord
): BuildSessionRecord | null => {
  if (!isBuildProcessConfig(session.config)) return null;
  if (!isProgressSummary(session.progress)) return null;
  const stages = readStageMap(session.stages);
  if (!stages) return null;
  if (!isNumber(session.startedAt) || !isNumber(session.updatedAt)) return null;
  return {
    nodeId: session.nodeId,
    draftId: session.draftId,
    status: session.status,
    config: session.config,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    completedAt: session.completedAt,
    progress: toProgressInfo(session.progress),
    stages,
    resourceUsage: readResourceUsage(session.resourceUsage),
    stopReason: session.stopReason,
    canResume: session.canResume,
    lastActivity: session.lastActivity,
    expiresAt: session.expiresAt,
    inactiveMs: session.inactiveMs,
    lastHeartbeatAt: session.lastHeartbeatAt,
    stageInactiveMs: session.stageInactiveMs,
    stageStartedAt: session.stageStartedAt,
    stageHeartbeatAt: session.stageHeartbeatAt,
    stageId: session.stageId,
  };
};

const isNonNull = <T>(value: T | null): value is T => value !== null;

export class ShapeQueryService implements ShapeQueryAPI {
  static async getSingleton(db: ShapeDB): Promise<ShapeQueryService> {
    return SingletonMixin.getSingleton('ShapeQueryService', async () => new ShapeQueryService(db));
  }

  constructor(private db: ShapeDB) {}

  private async ensureOpen(): Promise<void> {
    await this.db.open?.();
  }

  private async ensureEphemeralOpen(): Promise<void> {
    await ephemeralShapeDB.open?.();
  }

  async listBuildSessions(nodeId: NodeId): Promise<ShapeBuildSessionSummary[]> {
    await this.ensureOpen();
    await this.ensureEphemeralOpen();
    const sessions = await ephemeralShapeDB.sessions.where('nodeId').equals(nodeId).toArray();
    const records = sessions.map(toBuildSessionRecordFromEphemeral).filter(isNonNull);
    return records.map(toSessionSummary);
  }

  async getBuildSession(nodeId: NodeId): Promise<ShapeBuildSessionSummary | null> {
    await this.ensureOpen();
    await this.ensureEphemeralOpen();
    const session = await ephemeralShapeDB.sessions.get(nodeId);
    const record = session ? toBuildSessionRecordFromEphemeral(session) : null;
    return record ? toSessionSummary(record) : null;
  }

  async listBuildSessionRecords(nodeId: NodeId): Promise<ShapeBuildSessionRecord[]> {
    await this.ensureOpen();
    await this.ensureEphemeralOpen();
    const sessions = await ephemeralShapeDB.sessions.where('nodeId').equals(nodeId).toArray();
    const records = sessions.map(toBuildSessionRecordFromEphemeral).filter(isNonNull);
    return records.map(toShapeBuildSessionRecord);
  }

  async getBuildSessionRecord(nodeId: NodeId): Promise<ShapeBuildSessionRecord | null> {
    await this.ensureOpen();
    await this.ensureEphemeralOpen();
    const session = await ephemeralShapeDB.sessions.get(nodeId);
    const record = session ? toBuildSessionRecordFromEphemeral(session) : null;
    return record ? toShapeBuildSessionRecord(record) : null;
  }

  async listBuildSessionRecordsByStatus(
    statuses: Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'>
  ): Promise<ShapeBuildSessionRecord[]> {
    await this.ensureOpen();
    await this.ensureEphemeralOpen();
    const sessions = await ephemeralShapeDB.sessions.toArray();
    const filtered = sessions.filter((session) => statuses.includes(session.status));
    const records = filtered.map(toBuildSessionRecordFromEphemeral).filter(isNonNull);
    return records.map(toShapeBuildSessionRecord);
  }

  async listBuildTasks(nodeId: NodeId): Promise<ShapeBuildTaskSummary[]> {
    await this.ensureOpen();
    const tasks = await ephemeralShapeDB.buildTasks.where('nodeId').equals(nodeId).toArray();
    return tasks.map((task) => toTaskSummary(task));
  }

  async listBuildTaskRecords(nodeId: NodeId): Promise<ShapeBuildTaskRecord[]> {
    await this.ensureOpen();
    return ephemeralShapeDB.buildTasks.where('nodeId').equals(nodeId).toArray();
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
    await this.ensureEphemeralOpen();
    const sessions = await ephemeralShapeDB.sessions.where('nodeId').equals(nodeId).toArray();
    const latest = sessions.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
    if (!latest) {
      return {
        status: 'idle',
        hasErrors: false,
        errorMessages: [],
      };
    }
    const latestSession = toBuildSessionRecordFromEphemeral(latest);
    if (!latestSession) {
      return {
        status: 'idle',
        hasErrors: false,
        errorMessages: [],
      };
    }
    const totalFeatures = await this.getProcessedFeatureCount(nodeId);
    const totalVectorTiles = await this.db.vectorTiles.where('nodeId').equals(nodeId).count();
    return {
      status: mapStatus(latestSession.status),
      lastProcessed: latestSession.completedAt ?? latestSession.updatedAt,
      totalFeatures,
      totalVectorTiles,
      hasErrors: latestSession.status === 'failed',
      errorMessages: latestSession.status === 'failed' ? ['Build processing failed'] : [],
      stage: latestSession.progress?.taskType,
      progress: latestSession.progress?.percentage,
      lastUpdated: latestSession.updatedAt,
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
    const summary = await this.db.getVectorTileSummary(nodeId);
    if (!summary) {
      return { tiles: 0, totalBytes: 0 };
    }
    return {
      tiles: summary.tiles,
      totalBytes: summary.totalBytes,
      zoomMin: summary.zoomMin,
      zoomMax: summary.zoomMax,
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
    return ephemeralShapeDB.transformErrors.where('nodeId').equals(nodeId).toArray();
  }
}
