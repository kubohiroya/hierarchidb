import type { NodeId } from '@hierarchidb/core-types';
import type {
  ShapeBuildProgressSummary,
  ShapeBuildSessionRecord,
  ShapeBuildSessionSummary,
  ShapeBuildStage,
  ShapeBuildTaskRecord,
  ShapeBuildTaskSummary,
  ShapeFeatureMetadata,
  ShapeSourceCache,
  ShapeProcessingStatus,
  ShapeQueryAPI,
  ShapeDataSourceMetadata,
  ShapeTileInfo,
  ShapeTileSummary,
  ShapeTileSummaryEntry,
  ShapeGeometryCache,
  ShapeGeometryErrorRecord,
  ShapeVectorTileRecord,
  ShapeTileEmitMetadata,
  ShapeBuildSessionProbeResult,
} from '@hierarchidb/shape-api';
import type {
  BuildSessionRecord,
  BuildTaskType,
  ProgressInfo,
  ResourceUsage,
  ShapeDB,
  StageStatus,
} from '@hierarchidb/shape-store';
import {
  ephemeralDB,
  type EphemeralBuildSessionRecord,
  type EphemeralBuildTaskRecord,
  getSessionWithDetails,
  probeBuildSession as probeEphemeralBuildSession,
} from '@hierarchidb/gis-sdk';
import { SingletonMixin } from '@hierarchidb/util';
import {
  countSourceDataSourceBuffersForNode,
  isRawDataDataSourceCacheKey,
  listRawDataDataSourceMetadataForNode,
  readRawDataDataSourceBuffer,
} from './shapeChunkStoreUtils.js';
import { toCanonicalStageIdFromLegacyStage, toLegacyBuildStage } from './stageAliasConstants.js';

const toBuildStage = (
  stage: ShapeBuildProgressSummary['stage'],
  stageId?: string,
): ProgressInfo['stage'] => {
  return toLegacyBuildStage(stage, stageId);
};

const toProgressInfo = (
  progress: ShapeBuildProgressSummary,
  stageId?: string,
): ProgressInfo => ({
  total: progress.total,
  completed: progress.completed,
  failed: progress.failed,
  skipped: progress.skipped,
  percentage: progress.percentage,
  stage: toBuildStage(progress.stage, stageId),
});

const toShapeBuildStage = (
  stage?: ProgressInfo['stage'],
  stageId?: string,
): ShapeBuildStage | undefined => {
  return toLegacyBuildStage(stage, stageId);
};

const toShapeBuildProgressSummary = (
  progress: ProgressInfo,
  stageId?: string,
): ShapeBuildProgressSummary => ({
  total: progress.total,
  completed: progress.completed,
  failed: progress.failed,
  skipped: progress.skipped,
  percentage: progress.percentage,
  stage: toShapeBuildStage(progress.stage, stageId),
});

const toShapeBuildSessionRecord = (session: BuildSessionRecord): ShapeBuildSessionRecord => {
  const resourceUsage: Record<string, unknown> | undefined = session.resourceUsage
    ? { ...session.resourceUsage }
    : undefined;
  const stages: Record<string, unknown> = { ...session.stages };
  return {
    nodeId: session.nodeId,
    status: session.status,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    completedAt: session.completedAt,
    progress: toShapeBuildProgressSummary(session.progress, session.stageId),
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
  progress: toShapeBuildProgressSummary(session.progress, session.stageId),
});

const toTaskSummary = (task: ShapeBuildTaskRecord): ShapeBuildTaskSummary => ({
  taskId: task.taskId,
  version: task.version,
  nodeId: task.nodeId,
  stage: task.stage,
  stageId: toCanonicalStageIdFromLegacyStage(task.stage),
  status: task.status,
  index: task.index,
  progress: task.progress,
  errorMessage: task.errorMessage,
  metadata: task.metadata,
  retryAttempt: typeof (task.metadata as { retryAttempt?: unknown } | undefined)?.retryAttempt === 'number'
    && Number.isFinite((task.metadata as { retryAttempt?: unknown } | undefined)?.retryAttempt ?? NaN)
      ? Math.max(0, Math.floor((task.metadata as { retryAttempt: number }).retryAttempt))
      : undefined,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isDefined = <T>(value: T | null | undefined): value is T => (
  value !== null && value !== undefined
);

const isTaskStatus = (value: unknown): value is StageStatus['status'] =>
  value === 'queued'
  || value === 'running'
  || value === 'completed'
  || value === 'failed'
  || value === 'recycled';

const isStageStatus = (value: unknown): value is StageStatus => {
  if (!isRecord(value)) return false;
  return isTaskStatus(value.status)
    && isNumber(value.progress)
    && isNumber(value.tasksTotal)
    && isNumber(value.tasksCompleted)
    && isNumber(value.tasksFailed)
    && (value.message === undefined || typeof value.message === 'string');
};

const isProgressSummary = (value: unknown): value is ShapeBuildProgressSummary => {
  if (!isRecord(value)) return false;
  return isNumber(value.total)
    && isNumber(value.completed)
    && isNumber(value.failed)
    && isNumber(value.skipped)
    && isNumber(value.percentage)
    && (value.stage === undefined || value.stage === 'source' || value.stage === 'geometry' || value.stage === 'tileEmit');
};

const readStageMap = (value: unknown): Record<BuildTaskType, StageStatus> | null => {
  if (!isRecord(value)) return null;
  const source = value.source;
  const geometry = value.geometry;
  const tileEmit = value.tileEmit;
  if (!isStageStatus(source) || !isStageStatus(geometry) || !isStageStatus(tileEmit)) return null;
  return { source, geometry, tileEmit };
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
  if (!isProgressSummary(session.progress)) return null;
  const stages = readStageMap(session.stages);
  if (!stages) return null;
  if (!isNumber(session.startedAt) || !isNumber(session.updatedAt)) return null;
  return {
    nodeId: session.nodeId,
    status: session.status,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    completedAt: session.completedAt,
    progress: toProgressInfo(session.progress, session.stageId),
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

const isShapeBuildStage = (value: unknown): value is ShapeBuildStage => {
  return value === 'source' || value === 'geometry' || value === 'tileEmit';
};

const toShapeBuildTaskRecordFromEphemeral = (
  task: EphemeralBuildTaskRecord
): ShapeBuildTaskRecord | null => {
  if (!isShapeBuildStage(task.stage)) return null;
  const rawVersion = (task as unknown as { version?: unknown }).version;
  const version = typeof rawVersion === 'number'
    && Number.isFinite(rawVersion)
    && rawVersion >= 1
    ? Math.floor(rawVersion)
    : 1;
  return {
    taskId: task.taskId,
    nodeId: task.nodeId,
    version,
    stage: task.stage,
    status: task.status,
    index: task.index,
    progress: task.progress,
    retryCount: task.retryCount,
    metadata: task.metadata,
    inputData: task.inputData as ShapeBuildTaskRecord['inputData'],
    outputData: task.outputData as ShapeBuildTaskRecord['outputData'],
    errorMessage: task.errorMessage,
  };
};

const isNonNull = <T>(value: T | null): value is T => value !== null;
const isShapeBuildTaskRecord = (
  value: ShapeBuildTaskRecord | null
): value is ShapeBuildTaskRecord => value !== null;

/**
 * Query session data from EphemeralDB using the unified query interface
 */
async function getEphemeralSessionWithDetails(nodeId: NodeId): Promise<EphemeralBuildSessionRecord | null> {
  return ephemeralDB.transaction(
    'r',
    [
      ephemeralDB.buildSessionConfigs,
      ephemeralDB.buildSessionHeartbeats,
      ephemeralDB.buildSessionStatuses,
      ephemeralDB.buildStageStatuses,
      ephemeralDB.buildTasks,
    ],
    async () => getSessionWithDetails(nodeId, {
      getConfig: async (nodeId) => ephemeralDB.buildSessionConfigs.get(nodeId),
      getHeartbeat: async (nodeId) => ephemeralDB.buildSessionHeartbeats.get(nodeId),
      getStatus: async (nodeId) => ephemeralDB.buildSessionStatuses.get(nodeId),
      getStageStatuses: async (nodeId) => ephemeralDB.buildStageStatuses.where('nodeId').equals(nodeId).toArray(),
      getTasks: async (nodeId) => ephemeralDB.buildTasks.where('nodeId').equals(nodeId).toArray(),
    })
  );
}

async function probeEphemeralSession(nodeId: NodeId): Promise<ShapeBuildSessionProbeResult> {
  return ephemeralDB.transaction(
    'r',
    [
      ephemeralDB.buildSessionConfigs,
      ephemeralDB.buildSessionHeartbeats,
      ephemeralDB.buildSessionStatuses,
      ephemeralDB.buildStageStatuses,
      ephemeralDB.buildTasks,
    ],
    async () =>
      probeEphemeralBuildSession(nodeId, {
        getConfig: async (targetNodeId) => ephemeralDB.buildSessionConfigs.get(targetNodeId),
        getHeartbeat: async (targetNodeId) => ephemeralDB.buildSessionHeartbeats.get(targetNodeId),
        getStatus: async (targetNodeId) => ephemeralDB.buildSessionStatuses.get(targetNodeId),
        getStageStatuses: async (targetNodeId) =>
          ephemeralDB.buildStageStatuses.where('nodeId').equals(targetNodeId).toArray(),
        getTasks: async (targetNodeId) =>
          ephemeralDB.buildTasks.where('nodeId').equals(targetNodeId).toArray(),
      })
  );
}

/**
 * Query session data from ShapeDB using the unified query interface
 */
async function getShapeSessionWithDetails(db: ShapeDB, nodeId: NodeId): Promise<EphemeralBuildSessionRecord | null> {
  return getSessionWithDetails(nodeId, {
    getConfig: async (nodeId) => db.buildSessionConfigs.get(nodeId),
    getHeartbeat: async (nodeId) => db.buildSessionHeartbeats.get(nodeId),
    getStatus: async (nodeId) => db.buildSessionStatuses.get(nodeId),
    getStageStatuses: async (nodeId) => db.buildStageStatuses.where('nodeId').equals(nodeId).toArray(),
    getTasks: async (nodeId) => ephemeralDB.buildTasks.where('nodeId').equals(nodeId).toArray(),
  });
}

export class ShapeQueryService implements ShapeQueryAPI {
  static async getSingleton(
    db: ShapeDB,
    shapeChunkStoreDatabaseName: string
  ): Promise<ShapeQueryService> {
    const instance = await SingletonMixin.getSingleton(
      'ShapeQueryService',
      async () => new ShapeQueryService(db, shapeChunkStoreDatabaseName)
    );
    if (instance.shapeChunkStoreDatabaseName !== shapeChunkStoreDatabaseName) {
      throw new Error('shape-query-chunk-store-database-name-mismatch');
    }
    return instance;
  }

  constructor(
    private db: ShapeDB,
    private readonly shapeChunkStoreDatabaseName: string
  ) {}

  private async ensureOpen(): Promise<void> {
    await this.db.open?.();
  }

  private async ensureEphemeralOpen(): Promise<void> {
    await ephemeralDB.open?.();
  }

  async listBuildSessions(nodeId: NodeId): Promise<ShapeBuildSessionSummary[]> {
    await this.ensureOpen();
    await this.ensureEphemeralOpen();
    
    // Get all session configs for this node
    const configs = await ephemeralDB.buildSessionConfigs.where('nodeId').equals(nodeId).toArray();
    
    // Query each session using unified interface
    const sessions = await Promise.all(
      configs.map(config => getEphemeralSessionWithDetails(config.nodeId))
    );
    
    const records = sessions
      .filter(isNonNull)
      .map(toBuildSessionRecordFromEphemeral)
      .filter(isNonNull);
    
    return records.map(toSessionSummary);
  }

  async getBuildSession(nodeId: NodeId): Promise<ShapeBuildSessionSummary | null> {
    await this.ensureOpen();
    await this.ensureEphemeralOpen();
    
    const session = await getEphemeralSessionWithDetails(nodeId);
    const record = session ? toBuildSessionRecordFromEphemeral(session) : null;
    
    return record ? toSessionSummary(record) : null;
  }

  async probeBuildSession(nodeId: NodeId): Promise<ShapeBuildSessionProbeResult> {
    await this.ensureEphemeralOpen();
    return probeEphemeralSession(nodeId);
  }

  async listBuildSessionRecords(nodeId: NodeId): Promise<ShapeBuildSessionRecord[]> {
    await this.ensureOpen();
    await this.ensureEphemeralOpen();
    
    // Get all session configs for this node
    const configs = await ephemeralDB.buildSessionConfigs.where('nodeId').equals(nodeId).toArray();
    
    // Query each session using unified interface
    const sessions = await Promise.all(
      configs.map(config => getEphemeralSessionWithDetails(config.nodeId))
    );
    
    const records = sessions
      .filter(isNonNull)
      .map(toBuildSessionRecordFromEphemeral)
      .filter(isNonNull);
    
    return records.map(toShapeBuildSessionRecord);
  }

  async getBuildSessionRecord(nodeId: NodeId): Promise<ShapeBuildSessionRecord | null> {
    await this.ensureOpen();
    await this.ensureEphemeralOpen();
    
    const session = await getEphemeralSessionWithDetails(nodeId);
    const record = session ? toBuildSessionRecordFromEphemeral(session) : null;
    
    return record ? toShapeBuildSessionRecord(record) : null;
  }

  async listBuildSessionRecordsByStatus(
    statuses: Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'>
  ): Promise<ShapeBuildSessionRecord[]> {
    await this.ensureOpen();
    await this.ensureEphemeralOpen();
    
    // Query buildSessionStatuses table for matching statuses
    const statusRecords = await ephemeralDB.buildSessionStatuses
      .where('status')
      .anyOf(statuses)
      .toArray();
    
    // Get full session details for each matching status
    const sessions = await Promise.all(
      statusRecords.map(status => getEphemeralSessionWithDetails(status.nodeId))
    );
    
    const records = sessions
      .filter(isNonNull)
      .map(toBuildSessionRecordFromEphemeral)
      .filter(isNonNull);
    
    return records.map(toShapeBuildSessionRecord);
  }

  async listBuildTasks(nodeId: NodeId): Promise<ShapeBuildTaskSummary[]> {
    await this.ensureOpen();
    const tasks = await ephemeralDB.buildTasks.where('nodeId').equals(nodeId).toArray();
    const records = tasks
      .map(toShapeBuildTaskRecordFromEphemeral)
      .filter(isShapeBuildTaskRecord);
    return records.map(toTaskSummary);
  }

  async listBuildTaskRecords(nodeId: NodeId): Promise<ShapeBuildTaskRecord[]> {
    await this.ensureOpen();
    const tasks = await ephemeralDB.buildTasks.where('nodeId').equals(nodeId).toArray();
    return tasks.map(toShapeBuildTaskRecordFromEphemeral).filter(isShapeBuildTaskRecord);
  }

  async listBuildTaskRecordsByStage(
    nodeId: NodeId,
    stage: ShapeBuildStage
  ): Promise<ShapeBuildTaskRecord[]> {
    const tasks = await this.listBuildTaskRecords(nodeId);
    return tasks.filter((task) => task.stage === stage);
  }

  async getBuildTaskRecord(taskId: string): Promise<ShapeBuildTaskRecord | null> {
    await this.ensureOpen();
    const task = await ephemeralDB.buildTasks.get?.(taskId);
    return task ? toShapeBuildTaskRecordFromEphemeral(task) : null;
  }

  async getProcessingStatus(nodeId: NodeId): Promise<ShapeProcessingStatus | null> {
    await this.ensureOpen();
    await this.ensureEphemeralOpen();
    
    // Get all session configs for this node
    const configs = await ephemeralDB.buildSessionConfigs.where('nodeId').equals(nodeId).toArray();
    
    if (configs.length === 0) {
      return {
        status: 'idle',
        hasErrors: false,
        errorMessages: [],
      };
    }
    
    // Query each session using unified interface
    const sessions = await Promise.all(
      configs.map(config => getEphemeralSessionWithDetails(config.nodeId))
    );
    
    // Get latest session by startedAt (from config)
    const latest = sessions
      .filter(isNonNull)
      .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))[0];
    
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
      stage: latestSession.progress?.stage,
      progress: latestSession.progress?.percentage,
      lastUpdated: latestSession.updatedAt,
    };
  }

  async getProcessedFeatureCount(nodeId: NodeId): Promise<number> {
    await this.ensureOpen();
    return this.db.featureMetadata.where('nodeId').equals(String(nodeId)).count();
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

  async listSourceCaches(nodeId: NodeId): Promise<ShapeSourceCache[]> {
    const metadata = await listRawDataDataSourceMetadataForNode(
      this.shapeChunkStoreDatabaseName,
      nodeId
    );
    const records = await Promise.all(
      metadata
        .filter((entry) => isRawDataDataSourceCacheKey(entry.cacheKey))
        .map(async (entry) => {
          const cacheKey = entry.cacheKey;
          if (cacheKey === undefined) {
            throw new Error('[ShapeQueryService] raw source cache metadata is missing cacheKey');
          }
          const data = await readRawDataDataSourceBuffer(
            this.shapeChunkStoreDatabaseName,
            nodeId,
            cacheKey
          );
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
    return records.filter(Boolean) as ShapeSourceCache[];
  }

  async getSourceCache(nodeId: NodeId, bufferId: string): Promise<ShapeSourceCache | null> {
    if (!isRawDataDataSourceCacheKey(bufferId)) return null;
    const data = await readRawDataDataSourceBuffer(
      this.shapeChunkStoreDatabaseName,
      nodeId,
      bufferId
    );
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

  async countSourceCaches(nodeId: NodeId): Promise<number> {
    return countSourceDataSourceBuffersForNode(this.shapeChunkStoreDatabaseName, nodeId);
  }

  async listGeometryCaches(nodeId: NodeId): Promise<ShapeGeometryCache[]> {
    const idsRaw = await ephemeralDB.geometryCacheMeta.where('nodeId').equals(nodeId).primaryKeys();
    if (idsRaw.length === 0) return [];
    const ids = idsRaw.map((id) => String(id));
    const records = await ephemeralDB.geometryCache.bulkGet(ids);
    return records
      .filter(isDefined)
      .filter((record): record is ShapeGeometryCache => record.nodeId === nodeId && record.timestamp > 0);
  }

  async getGeometryCache(bufferId: string): Promise<ShapeGeometryCache | null> {
    return await ephemeralDB.transaction('r', ephemeralDB.geometryCache, async () => {
      const record = await ephemeralDB.geometryCache.get(bufferId);
      if (!record || record.timestamp <= 0) return null;
      return record;
    });
  }

  async listTileEmitMetadata(nodeId: NodeId): Promise<ShapeTileEmitMetadata[]> {
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

  async listDataSourceMetadata(nodeId: NodeId): Promise<ShapeDataSourceMetadata[]> {
    return this.db.dataSourceMetadata.where('nodeId').equals(String(nodeId)).toArray() as Promise<
      ShapeDataSourceMetadata[]
    >;
  }

  async listFeatureMetadata(nodeId: NodeId): Promise<ShapeFeatureMetadata[]> {
    return this.db.featureMetadata.where('nodeId').equals(String(nodeId)).toArray() as Promise<
      ShapeFeatureMetadata[]
    >;
  }

  async listGeometryErrorRecords(nodeId: NodeId): Promise<ShapeGeometryErrorRecord[]> {
    return ephemeralDB.geometryErrors.where('nodeId').equals(nodeId).toArray();
  }
}
