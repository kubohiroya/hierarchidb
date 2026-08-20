import type { NodeId } from '@hierarchidb/core-types';
import type { Table } from 'dexie';
import type {
  ShapeBuildSessionRecord,
  ShapeBuildSessionSummary,
  ShapeBuildStage,
  ShapeBuildProgressSummary,
  ShapeBuildTaskRecord,
  ShapeBuildTaskRecordInput,
  ShapeBuildTaskRecordUpdate,
  ShapeBuildTaskStatus,
  ShapeBuildTaskSummary,
  ShapeEphemeralSessionRecord,
  ShapeFeatureMetadata,
  ShapeSourceCache,
  ShapeMutationAPI,
  ShapeProcessingStatus,
  ShapeQueryAPI,
  ShapeDataSourceMetadata,
  ShapeTileIdToBufferRelation,
  ShapeTileInfo,
  ShapeTileSummary,
  ShapeTileSummaryEntry,
  ShapeGeometryCache,
  ShapeGeometryErrorRecord,
  ShapeVectorTileRecord,
  ShapeTileEmitMetadata,
  ShapeBuildSessionProbeResult,
  ShapeBuildSessionRecoveryRequest,
  ShapeBuildSessionRecoveryResult,
} from '@hierarchidb/shape-api';
import type { VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import {
  storeRawDataDataSourceBufferForNode,
} from '~/services/utils/chunkStore';
import { resolveCountryContinentName, resolveCountryName } from '~/services/utils/iso3166';
import {
  toEphemeralBuildSessionRecord,
  toEphemeralBuildSessionUpdates,
  toProgressInfo,
  toProgressSummary,
  toShapeBuildSessionRecord,
  toVectorTileRecord,
} from './shapeSessionMapperUtils.js';
import { shapeDB } from '@hierarchidb/shape-store';
import type {
  BuildSessionRecord,
  BuildTaskType,
  SourceStageMaxima,
  ResourceUsage,
  StageStatus,
  VectorTileRecord,
} from '@hierarchidb/shape-store';
import {
  ephemeralDB,
  type EphemeralBuildSessionRecord,
  getSessionWithDetails,
  probeBuildSession as probeEphemeralBuildSession,
  type BuildSessionRecord as GisBuildSessionRecord,
  type BuildSessionHeartbeat,
  type BuildSessionStatus,
  type BuildStageStatus,
} from '@hierarchidb/gis-sdk';

const shapeBuildTaskTable = (): Table<ShapeBuildTaskRecord, string> =>
  ephemeralDB.buildTasks as Table<ShapeBuildTaskRecord, string>;

const mapStatus = (status: ShapeBuildSessionSummary['status'] | 'running' | 'idle'): ShapeProcessingStatus['status'] => {
  if (status === 'running') return 'processing';
  if (status === 'idle') return 'idle';
  return status;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const BUILD_STAGES = ['source', 'geometry', 'tileEmit'] as const;

const resolveRunningBuildStage = (value: unknown): BuildTaskType | undefined => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new Error('[ShapeMutationAPI] stages must be an object');
  }
  const runningStages = BUILD_STAGES.filter((stage) => {
    const candidate = value[stage];
    return isRecord(candidate) && candidate.status === 'running';
  });
  if (runningStages.length > 1) {
    throw new Error('[ShapeMutationAPI] only one build stage may be running');
  }
  return runningStages[0];
};

const requireFiniteNonNegativeTiming = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`[ShapeMutationAPI] ${label} must be a finite non-negative number`);
  }
  return value;
};

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isProgressSummary = (value: unknown): value is ShapeBuildProgressSummary => {
  if (!isRecord(value)) return false;
  return isNumber(value.total)
    && isNumber(value.completed)
    && isNumber(value.failed)
    && isNumber(value.skipped)
    && isNumber(value.percentage)
    && (value.stage === undefined || typeof value.stage === 'string');
};

const isStageStatus = (value: unknown): value is StageStatus => {
  if (!isRecord(value)) return false;
  return isNumber(value.progress)
    && isNumber(value.tasksTotal)
    && isNumber(value.tasksCompleted)
    && isNumber(value.tasksFailed)
    && typeof value.status === 'string'
    && (value.message === undefined || typeof value.message === 'string');
};

const isSelectedArrayByCountries = (value: unknown): value is Record<string, boolean[]> => {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => (
    Array.isArray(entry) && entry.every((item) => typeof item === 'boolean')
  ));
};

const readStageMap = (value: unknown): Record<BuildTaskType, StageStatus> | null => {
  if (!isRecord(value)) return null;
  const sourceStage = value.source;
  const geometryStage = value.geometry;
  const tileEmitStage = value.tileEmit;
  if (!isStageStatus(sourceStage) || !isStageStatus(geometryStage) || !isStageStatus(tileEmitStage)) return null;
  return { source: sourceStage, geometry: geometryStage, tileEmit: tileEmitStage };
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

const readSourceStageMaxima = (value: unknown): SourceStageMaxima | undefined => {
  if (!isRecord(value)) return undefined;
  if (!isNumber(value.featureMax) || !isNumber(value.polygonMax)) return undefined;
  if (value.featureMax < 0 || value.polygonMax < 0) return undefined;
  const maxPolygonVertexCount = isNumber(value.maxPolygonVertexCount) && value.maxPolygonVertexCount >= 0
    ? value.maxPolygonVertexCount
    : undefined;
  const baseTolerance = isNumber(value.baseTolerance) && value.baseTolerance >= 0
    ? value.baseTolerance
    : undefined;
  const vertexLimit = isNumber(value.vertexLimit) && value.vertexLimit > 0
    ? Math.round(value.vertexLimit)
    : undefined;
  return {
    featureMax: value.featureMax,
    polygonMax: value.polygonMax,
    maxPolygonVertexCount,
    baseTolerance,
    vertexLimit,
  };
};

const requireBuildSessionStatus = (status: unknown): BuildSessionRecord['status'] => {
  if (status === 'idle'
    || status === 'running'
    || status === 'paused'
    || status === 'completed'
    || status === 'failed') {
    return status;
  }
  throw new Error(`[ShapeBuildAPIClient] unsupported build session status: ${String(status)}`);
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
    status: requireBuildSessionStatus(session.status),
    selectedArrayByCountries: isSelectedArrayByCountries(session.selectedArrayByCountries)
      ? session.selectedArrayByCountries
      : undefined,
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
    sourceStageMaxima: readSourceStageMaxima(session.sourceStageMaxima),
  };
};

const isNonNull = <T>(value: T | null): value is T => value !== null;

/**
 * Helper function to query session data using the unified query interface
 * This replaces direct access to the old monolithic ephemeralDB.sessions table
 */
const getEphemeralSessionWithDetails = async (nodeId: NodeId): Promise<EphemeralBuildSessionRecord | null> => {
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
};

const probeEphemeralSession = async (
  nodeId: NodeId,
): Promise<ShapeBuildSessionProbeResult> => {
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
        getHeartbeat: async (targetNodeId) =>
          ephemeralDB.buildSessionHeartbeats.get(targetNodeId),
        getStatus: async (targetNodeId) => ephemeralDB.buildSessionStatuses.get(targetNodeId),
        getStageStatuses: async (targetNodeId) =>
          ephemeralDB.buildStageStatuses.where('nodeId').equals(targetNodeId).toArray(),
        getTasks: async (targetNodeId) =>
          ephemeralDB.buildTasks.where('nodeId').equals(targetNodeId).toArray(),
      }),
  );
};

const readBuildSessionsByNode = async (nodeId: NodeId): Promise<BuildSessionRecord[]> => {
  const session = await getEphemeralSessionWithDetails(nodeId);
  if (!session) return [];
  const buildSessionRecord = toBuildSessionRecordFromEphemeral(session);
  return buildSessionRecord ? [buildSessionRecord] : [];
};

const readBuildSession = async (nodeId: NodeId): Promise<BuildSessionRecord | undefined> => {
  const session = await getEphemeralSessionWithDetails(nodeId);
  if (!session) return undefined;
  return toBuildSessionRecordFromEphemeral(session) ?? undefined;
};

const readAllBuildSessions = async (): Promise<BuildSessionRecord[]> => {
  // Get all session configs, then query each one using the unified interface
  const configs = await ephemeralDB.buildSessionConfigs.toArray();
  const sessions = await Promise.all(
    configs.map(config => getEphemeralSessionWithDetails(config.nodeId))
  );
  return sessions.map(session => session ? toBuildSessionRecordFromEphemeral(session) : null).filter(isNonNull);
};

const listTileEmitTilesByNode = async (nodeId: NodeId): Promise<VectorTileRecord[]> => (
  shapeDB.vectorTiles.where('nodeId').equals(nodeId).toArray()
);

const pickLatestTile = (tiles: VectorTileRecord[]): VectorTileRecord | null => {
  if (tiles.length === 0) return null;
  return tiles.reduce((latest, tile) => (tile.generatedAt > latest.generatedAt ? tile : latest));
};

const getTileEmitTileByXYZ = async (nodeId: NodeId, z: number, x: number, y: number): Promise<VectorTileRecord | null> => {
  const tiles = await shapeDB.vectorTiles
    .where('[nodeId+z+x+y]')
    .equals([nodeId, z, x, y])
    .toArray();
  return pickLatestTile(tiles);
};

const toShapeVectorTileRecord = (tile: VectorTileRecord): ShapeVectorTileRecord => ({
  tileId: String(tile.tileId),
  nodeId: tile.nodeId,
  z: tile.z,
  x: tile.x,
  y: tile.y,
  data_Uint8Array: tile.data_Uint8Array,
  size: tile.size,
  features: tile.features,
  layers: tile.layers,
  generatedAt: tile.generatedAt,
  lastAccessed: tile.lastAccessed,
  contentHash: tile.contentHash,
  contentEncoding: tile.contentEncoding,
  version: tile.version,
});

const isGeometryCacheComplete = <T extends { timestamp: number }>(record: T | null | undefined): record is T => (
  Boolean(record && record.timestamp > 0)
);

const markGeometryCacheWriteComplete = async (buffers: Array<{ id: string }>): Promise<void> => {
  if (buffers.length === 0) return;
  const completedAt = Date.now();
  await Promise.all(buffers.map((buffer) => (
    ephemeralDB.geometryCache.update(buffer.id, { timestamp: completedAt })
  )));
};

const assertNonEmptyGeometryCacheBuffer = (buffer: Pick<ShapeGeometryCache, 'id' | 'data'>): void => {
  if (buffer.data.byteLength === 0) {
    throw new Error(`[shape-build] empty geometry cache buffer: ${buffer.id}`);
  }
};

const assertNonEmptyGeometryCacheBuffers = (buffers: Array<Pick<ShapeGeometryCache, 'id' | 'data'>>): void => {
  buffers.forEach(assertNonEmptyGeometryCacheBuffer);
};

const isDefined = <T>(value: T | null | undefined): value is T => (
  value !== null && value !== undefined
);

const toShapeSourceCache = (record: {
  id: string;
  nodeId: NodeId;
  data: ArrayBuffer;
  featureCount: number;
  bbox: [number, number, number, number];
  downloadTime: number;
  size: number;
  timestamp: number;
}): ShapeSourceCache => ({
  id: record.id,
  nodeId: record.nodeId,
  data: record.data,
  featureCount: record.featureCount,
  bbox: record.bbox,
  downloadTime: record.downloadTime,
  size: record.size,
  timestamp: record.timestamp,
});

const listSourceCachesWithoutHeavyIteration = async (nodeId: NodeId): Promise<ShapeSourceCache[]> => {
  const idsRaw = await ephemeralDB.sourceCacheMeta.where('nodeId').equals(nodeId).primaryKeys();
  if (idsRaw.length === 0) return [];
  const ids = idsRaw.map((id) => String(id));
  const records = await ephemeralDB.sourceCache.bulkGet(ids);
  return records
    .filter(isDefined)
    .filter((record) => record.nodeId === nodeId)
    .map((record) => toShapeSourceCache(record));
};

const listGeometryCachesWithoutHeavyIteration = async (nodeId: NodeId): Promise<ShapeGeometryCache[]> => {
  const idsRaw = await ephemeralDB.geometryCacheMeta.where('nodeId').equals(nodeId).primaryKeys();
  if (idsRaw.length === 0) return [];
  const ids = idsRaw.map((id) => String(id));
  const records = await ephemeralDB.geometryCache.bulkGet(ids);
  return records
    .filter(isDefined)
    .filter((record): record is ShapeGeometryCache => (
      record.nodeId === nodeId && isGeometryCacheComplete(record)
    ));
};


const toTaskSummary = (task: ShapeBuildTaskRecord): ShapeBuildTaskSummary => ({
  taskId: task.taskId,
  version: task.version,
  nodeId: task.nodeId,
  stage: task.stage,
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

export class ShapeQueryAPIImpl implements ShapeQueryAPI {
  async listBuildSessions(nodeId: NodeId): Promise<ShapeBuildSessionSummary[]> {
    const sessions = await readBuildSessionsByNode(nodeId);
    return sessions.map((session) => ({
      nodeId: session.nodeId,
      status: mapStatus(session.status),
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt,
      progress: toProgressSummary(session.progress),
    }));
  }

  async getBuildSession(nodeId: NodeId): Promise<ShapeBuildSessionSummary | null> {
    const session = await readBuildSession(nodeId);
    if (!session) return null;
    return {
      nodeId: session.nodeId,
      status: mapStatus(session.status),
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt,
      progress: toProgressSummary(session.progress),
    };
  }

  async probeBuildSession(nodeId: NodeId): Promise<ShapeBuildSessionProbeResult> {
    return probeEphemeralSession(nodeId);
  }

  async listBuildSessionRecords(nodeId: NodeId): Promise<ShapeBuildSessionRecord[]> {
    const sessions = await readBuildSessionsByNode(nodeId);
    return sessions.map(toShapeBuildSessionRecord);
  }

  async getBuildSessionRecord(nodeId: NodeId): Promise<ShapeBuildSessionRecord | null> {
    const session = await readBuildSession(nodeId);
    return session ? toShapeBuildSessionRecord(session) : null;
  }

  async listBuildSessionRecordsByStatus(
    statuses: Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'>,
  ): Promise<ShapeBuildSessionRecord[]> {
    const sessions = await readAllBuildSessions();
    return sessions.filter((session) => statuses.includes(session.status)).map(toShapeBuildSessionRecord);
  }

  async listBuildTasks(nodeId: NodeId): Promise<ShapeBuildTaskSummary[]> {
    const tasks = await shapeBuildTaskTable().where('nodeId').equals(nodeId).toArray();
    return tasks.map((task) => toTaskSummary(task));
  }

  async listBuildTaskRecords(nodeId: NodeId): Promise<ShapeBuildTaskRecord[]> {
    return shapeBuildTaskTable().where('nodeId').equals(nodeId).toArray();
  }

  async listBuildTaskRecordsByStage(nodeId: NodeId, stage: ShapeBuildStage): Promise<ShapeBuildTaskRecord[]> {
    const tasks = await this.listBuildTaskRecords(nodeId);
    return tasks.filter((task) => task.stage === stage);
  }

  async getBuildTaskRecord(taskId: string): Promise<ShapeBuildTaskRecord | null> {
    const task = await shapeBuildTaskTable().get(taskId);
    return task ?? null;
  }

  async getProcessingStatus(nodeId: NodeId): Promise<ShapeProcessingStatus | null> {
    const sessions = await readBuildSessionsByNode(nodeId);
    const latest = sessions.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
    if (!latest) {
      return {
        status: 'idle',
        hasErrors: false,
        errorMessages: [],
      };
    }
    const totalFeatures = await this.getProcessedFeatureCount(nodeId);
    const totalVectorTiles = await shapeDB.vectorTiles.where('nodeId').equals(nodeId).count();
    return {
      status: mapStatus(latest.status),
      lastProcessed: latest.completedAt ?? latest.updatedAt,
      totalFeatures,
      totalVectorTiles,
      hasErrors: latest.status === 'failed',
      errorMessages: latest.status === 'failed' ? ['Build processing failed'] : [],
      stage: latest.progress?.stage,
      progress: latest.progress?.percentage,
      lastUpdated: latest.updatedAt,
    };
  }

  async getProcessedFeatureCount(nodeId: NodeId): Promise<number> {
    return shapeDB.featureMetadata.where('nodeId').equals(String(nodeId)).count();
  }

  async getVectorTileInfo(nodeId: NodeId, z: number, x: number, y: number): Promise<ShapeTileInfo | null> {
    const tile = await getTileEmitTileByXYZ(nodeId, z, x, y);
    if (!tile) return null;
    return {
      exists: true,
      size: tile.size,
      features: tile.features,
      layers: tile.layers,
      generatedAt: tile.generatedAt,
      lastAccessed: undefined,
    };
  }

  async getVectorTileRecord(nodeId: NodeId, z: number, x: number, y: number): Promise<ShapeVectorTileRecord | null> {
    const tile = await getTileEmitTileByXYZ(nodeId, z, x, y);
    return tile ? toShapeVectorTileRecord(tile) : null;
  }

  async getVectorTile(nodeId: NodeId, z: number, x: number, y: number): Promise<Uint8Array | null> {
    const tile = await getTileEmitTileByXYZ(nodeId, z, x, y);
    if (!tile) return null;
    return new Uint8Array(tile.data_Uint8Array);
  }

  async listVectorTiles(nodeId: NodeId): Promise<ShapeTileSummaryEntry[]> {
    const tiles = await listTileEmitTilesByNode(nodeId);
    return tiles.map((tile) => ({
      z: tile.z,
      x: tile.x,
      y: tile.y,
      size: tile.size,
      timestamp: tile.generatedAt,
    }));
  }

  async getVectorTileSummary(nodeId: NodeId): Promise<ShapeTileSummary> {
    const summary = await shapeDB.getVectorTileSummary(nodeId);
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
    return listSourceCachesWithoutHeavyIteration(nodeId);
  }

  async getSourceCache(nodeId: NodeId, bufferId: string): Promise<ShapeSourceCache | null> {
    const record = await ephemeralDB.sourceCache.get(bufferId);
    if (!record || record.nodeId !== nodeId) return null;
    return {
      id: record.id,
      nodeId: record.nodeId,
      data: record.data,
      featureCount: record.featureCount,
      bbox: record.bbox,
      downloadTime: record.downloadTime,
      size: record.size,
      timestamp: record.timestamp,
    };
  }

  async getGeometryCache(
    bufferId: string
  ): Promise<ShapeGeometryCache | null> {
    return await ephemeralDB.transaction('r', ephemeralDB.geometryCache, async () => {
      const record = await ephemeralDB.geometryCache.get(bufferId);
      return isGeometryCacheComplete(record) ? record : null;
    });
  }

  async listGeometryCaches(
    nodeId: NodeId
  ): Promise<ShapeGeometryCache[]> {
    return listGeometryCachesWithoutHeavyIteration(nodeId);
  }

  async listTileEmitMetadata(nodeId: NodeId): Promise<ShapeTileEmitMetadata[]> {
    const rows = await listTileEmitTilesByNode(nodeId);
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
    return shapeDB.dataSourceMetadata.where('nodeId').equals(String(nodeId)).toArray() as Promise<ShapeDataSourceMetadata[]>;
  }

  async listFeatureMetadata(nodeId: NodeId): Promise<ShapeFeatureMetadata[]> {
    return shapeDB.featureMetadata.where('nodeId').equals(String(nodeId)).toArray() as Promise<ShapeFeatureMetadata[]>;
  }

  async listGeometryErrorRecords(nodeId: NodeId): Promise<ShapeGeometryErrorRecord[]> {
    const rows = await ephemeralDB.geometryErrors
      .where('nodeId')
      .equals(nodeId)
      .toArray();
    const missing = rows.filter((row) => {
      if (!row.countryCode) return false;
      return !row.countryName || !row.continentName;
    });
    if (missing.length === 0) return rows;
    const codes = Array.from(
      new Set(
        missing
          .map((row) => row.countryCode?.trim().toUpperCase())
          .filter((code): code is string => Boolean(code)),
      ),
    );
    const lookup = new Map<string, { countryName: string; continentName: string }>();
    await Promise.all(
      codes.map(async (code) => {
        try {
          const [countryName, continentName] = await Promise.all([
            resolveCountryName(code),
            resolveCountryContinentName(code),
          ]);
          lookup.set(code, { countryName, continentName });
        } catch {
          lookup.set(code, { countryName: '', continentName: '' });
        }
      }),
    );
    const updates: ShapeGeometryErrorRecord[] = [];
    const merged = rows.map((row) => {
      const code = row.countryCode?.trim().toUpperCase();
      if (!code) return row;
      const info = lookup.get(code);
      if (!info) return row;
      const countryName = row.countryName ?? info.countryName;
      const continentName = row.continentName ?? info.continentName;
      if (countryName === row.countryName && continentName === row.continentName) {
        return row;
      }
      const next = { ...row, countryName, continentName };
      updates.push(next);
      return next;
    });
    if (updates.length > 0) {
      try {
        await ephemeralDB.geometryErrors.bulkPut(updates);
      } catch (error) {
        console.warn('[ShapeBuildAPIClient] Failed to update geometry error names', error);
      }
    }
    return merged;
  }

  subscribeToWorkerLog(_nodeId: NodeId, _callback: (event: { level: 'log' | 'warn' | 'error'; message: string; data?: any; timestamp: number }) => void): () => void {
    // This method is implemented on the UI side and should not directly call worker API
    // The actual subscription is handled by the WorkerBridge
    console.warn('[ShapeQueryAPIImpl] subscribeToWorkerLog called on UI side - this should be handled by WorkerBridge');
    return () => { }; // Return empty unsubscribe function
  }
}

export class ShapeMutationAPIImpl implements ShapeMutationAPI {
  async upsertBuildSession(session: ShapeBuildSessionRecord): Promise<void> {
    const record = toEphemeralBuildSessionRecord(session);
    if (!record) {
      throw new Error('Invalid build session config');
    }

    // Ensure required fields are present
    if (record.startedAt === undefined) {
      throw new Error('startedAt is required for session creation');
    }
    const runningStage = resolveRunningBuildStage(session.stages);
    if (record.stage !== undefined && record.stage !== runningStage) {
      throw new Error('[ShapeMutationAPI] progress stage must match the running stage');
    }

    // Split the monolithic record into four normalized tables
    const config: GisBuildSessionRecord = {
      nodeId: record.nodeId,
      domainType: record.domainType,
      selectedArrayByCountries: record.selectedArrayByCountries,
      selectedArrayVersion: record.selectedArrayVersion,
      startedAt: record.startedAt,
      sourceStageMaxima: record.sourceStageMaxima,
    };

    const heartbeat: BuildSessionHeartbeat | undefined = record.lastHeartbeatAt !== undefined ? {
      nodeId: record.nodeId,
      lastHeartbeatAt: requireFiniteNonNegativeTiming(record.lastHeartbeatAt, 'lastHeartbeatAt'),
    } : undefined;

    const startedAt = requireFiniteNonNegativeTiming(record.startedAt, 'startedAt');
    const inactiveMs = record.inactiveMs === undefined
      ? undefined
      : requireFiniteNonNegativeTiming(record.inactiveMs, 'inactiveMs');
    const completedAt = record.completedAt === undefined
      ? undefined
      : requireFiniteNonNegativeTiming(record.completedAt, 'completedAt');
    if ((record.status === 'completed' || record.status === 'failed') && completedAt === undefined) {
      throw new Error(`[ShapeMutationAPI] completedAt is required for terminal status ${record.status}`);
    }
    if (completedAt !== undefined && completedAt - startedAt - (inactiveMs ?? 0) < 0) {
      throw new Error('[ShapeMutationAPI] completed session interval must be non-negative');
    }

    const status: BuildSessionStatus = {
      nodeId: record.nodeId,
      status: record.status,
      stopReason: record.stopReason,
      completedAt,
      inactiveMs,
      canResume: record.canResume,
    };

    const stageStatus: BuildStageStatus | undefined = runningStage
      ? (() => {
          const stageStartedAt = requireFiniteNonNegativeTiming(
            record.stageStartedAt,
            'stageStartedAt',
          );
          const stageInactiveMs = requireFiniteNonNegativeTiming(
            record.stageInactiveMs,
            'stageInactiveMs',
          );
          return {
            id: `${record.nodeId}:${runningStage}`,
            nodeId: record.nodeId,
            stage: runningStage,
            status: 'running',
            startedAt: stageStartedAt,
            inactiveMs: stageInactiveMs,
            stageId: record.stageId,
          };
        })()
      : undefined;

    await ephemeralDB.transaction('rw', [
      ephemeralDB.buildSessionConfigs,
      ephemeralDB.buildSessionHeartbeats,
      ephemeralDB.buildSessionStatuses,
      ephemeralDB.buildStageStatuses,
    ], async () => {
      await Promise.all([
        ephemeralDB.buildSessionConfigs.put(config),
        heartbeat
          ? ephemeralDB.buildSessionHeartbeats.put(heartbeat)
          : ephemeralDB.buildSessionHeartbeats.delete(record.nodeId),
        ephemeralDB.buildSessionStatuses.put(status),
        ephemeralDB.buildStageStatuses.where('nodeId').equals(record.nodeId).delete(),
      ]);
      if (stageStatus) {
        await ephemeralDB.buildStageStatuses.put(stageStatus);
      }
    });
  }

  async updateBuildSession(nodeId: NodeId, updates: Partial<ShapeBuildSessionRecord>): Promise<void> {
    const patch = toEphemeralBuildSessionUpdates(updates);
    if (!patch) {
      throw new Error('Invalid build session config update');
    }
    const heartbeatAt = patch.lastHeartbeatAt === undefined
      ? undefined
      : requireFiniteNonNegativeTiming(patch.lastHeartbeatAt, 'lastHeartbeatAt');
    const hasStatusUpdate = patch.status !== undefined || patch.stopReason !== undefined ||
      patch.completedAt !== undefined || patch.inactiveMs !== undefined || patch.canResume !== undefined;
    const runningStage = resolveRunningBuildStage(updates.stages);
    const targetStage = runningStage ?? patch.stage;
    const hasStageTimingUpdate = patch.stageStartedAt !== undefined ||
      patch.stageInactiveMs !== undefined;
    if (hasStageTimingUpdate && targetStage === undefined) {
      throw new Error('[ShapeMutationAPI] active stage is required for stage timing updates');
    }
    const hasConfigUpdate = patch.selectedArrayByCountries !== undefined ||
      patch.selectedArrayVersion !== undefined || patch.sourceStageMaxima !== undefined;

    await ephemeralDB.transaction('rw', [
      ephemeralDB.buildSessionConfigs,
      ephemeralDB.buildSessionHeartbeats,
      ephemeralDB.buildSessionStatuses,
      ephemeralDB.buildStageStatuses,
    ], async () => {
      const currentConfig = await ephemeralDB.buildSessionConfigs.get(nodeId);
      if (!currentConfig) {
        throw new Error(`[ShapeMutationAPI] build session config is missing: ${String(nodeId)}`);
      }
      const currentStatus = await ephemeralDB.buildSessionStatuses.get(nodeId);
      if (!currentStatus) {
        throw new Error(`[ShapeMutationAPI] build session status is missing: ${String(nodeId)}`);
      }

      let nextStatusRecord: BuildSessionStatus | undefined;
      if (hasStatusUpdate) {
        const nextStatus = patch.status ?? currentStatus.status;
        const nextInactiveMs = patch.inactiveMs ?? currentStatus.inactiveMs;
        const inactiveMs = nextInactiveMs === undefined
          ? undefined
          : requireFiniteNonNegativeTiming(nextInactiveMs, 'inactiveMs');
        const nextCompletedAt = patch.completedAt ?? currentStatus.completedAt;
        const completedAt = nextCompletedAt === undefined
          ? undefined
          : requireFiniteNonNegativeTiming(nextCompletedAt, 'completedAt');
        if ((nextStatus === 'completed' || nextStatus === 'failed') && completedAt === undefined) {
          throw new Error(`[ShapeMutationAPI] completedAt is required for terminal status ${nextStatus}`);
        }
        const startedAt = requireFiniteNonNegativeTiming(currentConfig.startedAt, 'startedAt');
        if (completedAt !== undefined && completedAt - startedAt - (inactiveMs ?? 0) < 0) {
          throw new Error('[ShapeMutationAPI] completed session interval must be non-negative');
        }
        nextStatusRecord = {
          nodeId,
          status: nextStatus,
          stopReason: patch.stopReason ?? currentStatus.stopReason,
          completedAt,
          inactiveMs,
          canResume: patch.canResume ?? currentStatus.canResume,
        };
      }

      let nextStageStatus: BuildStageStatus | undefined;
      if (targetStage !== undefined) {
        const stageRowId = `${nodeId}:${targetStage}`;
        const currentStageStatus = await ephemeralDB.buildStageStatuses.get(stageRowId);
        const stageStartedAt = requireFiniteNonNegativeTiming(
          patch.stageStartedAt ?? currentStageStatus?.startedAt,
          'stageStartedAt',
        );
        const stageInactiveMs = requireFiniteNonNegativeTiming(
          patch.stageInactiveMs ?? currentStageStatus?.inactiveMs,
          'stageInactiveMs',
        );
        const isNewStageRun = patch.stageStartedAt !== undefined &&
          patch.stageStartedAt !== currentStageStatus?.startedAt;
        nextStageStatus = {
          id: stageRowId,
          nodeId,
          stage: targetStage,
          status: 'running',
          startedAt: stageStartedAt,
          inactiveMs: stageInactiveMs,
          stageId: patch.stageId ?? currentStageStatus?.stageId,
          completedAt: isNewStageRun ? undefined : currentStageStatus?.completedAt,
        };
      }

      const writes: Promise<unknown>[] = [];
      if (heartbeatAt !== undefined) {
        writes.push(ephemeralDB.buildSessionHeartbeats.put({ nodeId, lastHeartbeatAt: heartbeatAt }));
      }
      if (nextStatusRecord) {
        writes.push(ephemeralDB.buildSessionStatuses.put(nextStatusRecord));
      }
      if (nextStageStatus) {
        writes.push(ephemeralDB.buildStageStatuses.put(nextStageStatus));
      }
      if (hasConfigUpdate) {
        writes.push(ephemeralDB.buildSessionConfigs.put({
          ...currentConfig,
          selectedArrayByCountries: patch.selectedArrayByCountries ?? currentConfig.selectedArrayByCountries,
          selectedArrayVersion: patch.selectedArrayVersion ?? currentConfig.selectedArrayVersion,
          sourceStageMaxima: patch.sourceStageMaxima ?? currentConfig.sourceStageMaxima,
        }));
      }
      await Promise.all(writes);
    });
  }

  async deleteBuildSession(nodeId: NodeId): Promise<void> {
    // Delete from all four tables atomically
    await ephemeralDB.transaction('rw', [
      ephemeralDB.buildSessionConfigs,
      ephemeralDB.buildSessionHeartbeats,
      ephemeralDB.buildSessionStatuses,
      ephemeralDB.buildStageStatuses,
    ], async () => {
      await Promise.all([
        ephemeralDB.buildSessionConfigs.delete(nodeId),
        ephemeralDB.buildSessionHeartbeats.delete(nodeId),
        ephemeralDB.buildSessionStatuses.delete(nodeId),
        ephemeralDB.buildStageStatuses.where('nodeId').equals(nodeId).delete(),
      ]);
    });
  }

  async recoverLegacyBuildSession(
    request: ShapeBuildSessionRecoveryRequest,
  ): Promise<ShapeBuildSessionRecoveryResult> {
    return ephemeralDB.recoverLegacyBuildSession(request);
  }

  async deleteBuildTasks(nodeId: NodeId): Promise<void> {
    await shapeBuildTaskTable().where('nodeId').equals(nodeId).delete();
  }

  async deleteVectorTile(tileId: string): Promise<void> {
    await shapeDB.deleteVectorTile(tileId);
  }

  async deleteVectorTiles(nodeId: NodeId): Promise<void> {
    await shapeDB.deleteVectorTilesByNode(nodeId);
  }

  async cleanupProcessingData(nodeId: NodeId): Promise<void> {
    await this.deleteBuildTasks(nodeId);
    await this.deleteBuildSession(nodeId);
    await this.deleteFeatureMetadataByNode(nodeId);
    await this.deleteDataSourceMetadataByNode(nodeId);
    await this.deleteVectorTiles(nodeId);
    await this.clearTileIndexArtifacts(nodeId);
  }

  async clearShapeArtifacts(nodeId: NodeId): Promise<void> {
    await this.cleanupProcessingData(nodeId);
    await ephemeralDB.clearNodeData(nodeId);
  }

  async upsertBuildTasks(tasks: ReadonlyArray<ShapeBuildTaskRecordInput>): Promise<void> {
    if (tasks.length === 0) return;
    await shapeBuildTaskTable().bulkPut(tasks);
  }

  async updateBuildTask(taskId: string, updates: ShapeBuildTaskRecordUpdate): Promise<void> {
    await ephemeralDB.updateBuildTask(taskId, updates);
  }

  async putSourceCaches(buffers: ShapeSourceCache[]): Promise<void> {
    if (buffers.length === 0) return;
    await Promise.all(buffers.map((buffer) => (
      storeRawDataDataSourceBufferForNode({
        nodeId: buffer.nodeId,
        cacheKey: buffer.id,
        buffer: buffer.data,
      })
    )));
  }
  async putGeometryCaches(buffers: ShapeGeometryCache[], taskId?: string, taskQueue?: VtTaskQueueDb): Promise<void> {
    if (buffers.length === 0) return;
    assertNonEmptyGeometryCacheBuffers(buffers);

    // Validate cache write is allowed if taskId and taskQueue are provided
    if (taskId && taskQueue) {
      const { validateCacheWriteAllowed } = await import('../../worker/api/cacheWriteValidationConstants');
      await validateCacheWriteAllowed(taskQueue, taskId, 'geometry');
    }

    const pending = buffers.map((buffer) => ({ ...buffer, timestamp: 0 }));
    await ephemeralDB.transaction('rw', [ephemeralDB.geometryCache, ephemeralDB.geometryCacheMeta], async () => {
      await ephemeralDB.geometryCache.bulkPut(pending);
      await markGeometryCacheWriteComplete(pending);
    });
  }

  async putDataSourceMetadata(rows: ShapeDataSourceMetadata[]): Promise<void> {
    if (rows.length === 0) return;
    await shapeDB.dataSourceMetadata.bulkPut(rows);
  }

  async deleteDataSourceMetadataByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await shapeDB.dataSourceMetadata.bulkDelete(ids);
  }

  async deleteDataSourceMetadataByNode(nodeId: NodeId): Promise<void> {
    await shapeDB.dataSourceMetadata.where('nodeId').equals(nodeId).delete();
  }

  async putFeatureMetadata(rows: ShapeFeatureMetadata[]): Promise<void> {
    if (rows.length === 0) return;
    await shapeDB.featureMetadata.bulkPut(rows);
  }

  async deleteFeatureMetadataByNode(nodeId: NodeId): Promise<void> {
    await shapeDB.featureMetadata.where('nodeId').equals(nodeId).delete();
  }

  async syncVectorTilesFromTilesDb(nodeId: NodeId): Promise<void> {
    void nodeId;
  }

  async storeVectorTile(tile: ShapeVectorTileRecord): Promise<void> {
    await shapeDB.storeVectorTile(toVectorTileRecord(tile));
  }

  private async clearTileIndexArtifacts(nodeId: NodeId): Promise<void> {
    void nodeId;
  }

}

export class EphemeralShapeApiImpl {
  async listBuildTasks(nodeId: NodeId): Promise<ShapeBuildTaskRecord[]> {
    return shapeBuildTaskTable().where('nodeId').equals(nodeId).toArray();
  }

  async listBuildTasksByStatus(nodeId: NodeId, status: ShapeBuildTaskStatus): Promise<ShapeBuildTaskRecord[]> {
    return shapeBuildTaskTable().where('[nodeId+status]').equals([nodeId, status]).toArray();
  }

  async listBuildTasksByStage(nodeId: NodeId, stage: ShapeBuildStage): Promise<ShapeBuildTaskRecord[]> {
    return shapeBuildTaskTable().where('[nodeId+stage]').equals([nodeId, stage]).toArray();
  }

  async getBuildTask(taskId: string): Promise<ShapeBuildTaskRecord | null> {
    const task = await shapeBuildTaskTable().get(taskId);
    return task ?? null;
  }

  async countBuildTasks(nodeId: NodeId): Promise<number> {
    return shapeBuildTaskTable().where('nodeId').equals(nodeId).count();
  }

  async putBuildTasks(tasks: ReadonlyArray<ShapeBuildTaskRecordInput>): Promise<void> {
    if (tasks.length === 0) return;
    await shapeBuildTaskTable().bulkPut(tasks);
  }

  async deleteBuildTasksByNode(nodeId: NodeId): Promise<void> {
    await shapeBuildTaskTable().where('nodeId').equals(nodeId).delete();
  }

  async deleteBuildTasksByIds(taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) return;
    await shapeBuildTaskTable().bulkDelete(taskIds);
  }

  async updateBuildTask(taskId: string, updates: ShapeBuildTaskRecordUpdate): Promise<void> {
    await ephemeralDB.updateBuildTask(taskId, updates);
  }

  async listSourceCaches(nodeId: NodeId): Promise<ShapeSourceCache[]> {
    return listSourceCachesWithoutHeavyIteration(nodeId);
  }

  async getSourceCache(nodeId: NodeId, bufferId: string): Promise<ShapeSourceCache | null> {
    const record = await ephemeralDB.sourceCache.get(bufferId);
    if (!record || record.nodeId !== nodeId) return null;
    return {
      id: record.id,
      nodeId: record.nodeId,
      data: record.data,
      featureCount: record.featureCount,
      bbox: record.bbox,
      downloadTime: record.downloadTime,
      size: record.size,
      timestamp: record.timestamp,
    };
  }

  async countSourceCaches(nodeId: NodeId): Promise<number> {
    return ephemeralDB.sourceCacheMeta.where('nodeId').equals(nodeId).count();
  }

  async putSourceCache(buffer: ShapeSourceCache): Promise<void> {
    await storeRawDataDataSourceBufferForNode({
      nodeId: buffer.nodeId,
      cacheKey: buffer.id,
      buffer: buffer.data,
    });
  }

  async putSourceCaches(buffers: ShapeSourceCache[]): Promise<void> {
    if (buffers.length === 0) return;
    await Promise.all(buffers.map((buffer) => (
      storeRawDataDataSourceBufferForNode({
        nodeId: buffer.nodeId,
        cacheKey: buffer.id,
        buffer: buffer.data,
      })
    )));
  }

  async listGeometryCaches(
    nodeId: NodeId
  ): Promise<ShapeGeometryCache[]> {
    return listGeometryCachesWithoutHeavyIteration(nodeId);
  }

  async getGeometryCache(bufferId: string): Promise<ShapeGeometryCache | null> {
    return await ephemeralDB.transaction('r', ephemeralDB.geometryCache, async () => {
      const record = await ephemeralDB.geometryCache.get(bufferId);
      return isGeometryCacheComplete(record) ? record : null;
    });
  }

  async countGeometryCaches(nodeId: NodeId): Promise<number> {
    return ephemeralDB.transaction('r', ephemeralDB.geometryCacheMeta, async () => (
      ephemeralDB.geometryCacheMeta
        .where('[nodeId+timestamp]')
        .between([nodeId, 1], [nodeId, Number.MAX_SAFE_INTEGER])
        .count()
    ));
  }

  async putGeometryCache(buffer: ShapeGeometryCache): Promise<void> {
    assertNonEmptyGeometryCacheBuffer(buffer);
    const pending = { ...buffer, timestamp: 0 };
    // Phase 1: Write data with timestamp: 0 (invalid state)
    await ephemeralDB.geometryCache.put(pending);
    // Phase 2: Mark write complete with non-zero timestamp (valid state)
    try {
      await markGeometryCacheWriteComplete([pending]);
    } catch (error) {
      const { handleCacheWriteFailure } = await import('../../worker/api/cacheWriteValidationConstants');
      handleCacheWriteFailure(error, {
        nodeId: buffer.nodeId,
        taskId: buffer.id,
        cacheType: 'geometry',
        cacheId: buffer.id,
        phase: 'metadata',
      });
      throw error;
    }
  }

  async putGeometryCaches(buffers: ShapeGeometryCache[]): Promise<void> {
    if (buffers.length === 0) return;
    assertNonEmptyGeometryCacheBuffers(buffers);
    const pending = buffers.map((buffer) => ({ ...buffer, timestamp: 0 }));
    // Phase 1: Write data with timestamp: 0 (invalid state)
    await ephemeralDB.geometryCache.bulkPut(pending);
    // Phase 2: Mark write complete with non-zero timestamp (valid state)
    try {
      await markGeometryCacheWriteComplete(pending);
    } catch (error) {
      const { handleCacheWriteFailure } = await import('../../worker/api/cacheWriteValidationConstants');
      // Log failure for the first buffer as representative context
      const first = buffers[0];
      if (first !== undefined) {
        handleCacheWriteFailure(error, {
          nodeId: first.nodeId,
          taskId: first.id,
          cacheType: 'geometry',
          cacheId: `batch(${buffers.length})`,
          phase: 'metadata',
        });
      }
      throw error;
    }
  }

  async listTileIdRelations(nodeId: NodeId): Promise<ShapeTileIdToBufferRelation[]> {
    return ephemeralDB.tileEmitBufferRelations.where('nodeId').equals(nodeId).toArray() as Promise<ShapeTileIdToBufferRelation[]>;
  }

  async listTileIdRelationsByTileId(nodeId: NodeId, bandIndex: number, tileId: string): Promise<ShapeTileIdToBufferRelation[]> {
    return ephemeralDB.tileEmitBufferRelations
      .where('[nodeId+bandIndex+tileId]')
      .equals([nodeId, bandIndex, tileId])
      .toArray() as Promise<ShapeTileIdToBufferRelation[]>;
  }

  async putTileIdRelations(relations: ShapeTileIdToBufferRelation[]): Promise<void> {
    if (relations.length === 0) return;
    await ephemeralDB.tileEmitBufferRelations.bulkPut(relations);
  }

  async deleteTileIdRelations(nodeId: NodeId): Promise<void> {
    await ephemeralDB.tileEmitBufferRelations.where('nodeId').equals(nodeId).delete();
  }

  async getSessionRecord(nodeId: NodeId): Promise<ShapeEphemeralSessionRecord | null> {
    // Use the unified query interface to get session data
    return await getEphemeralSessionWithDetails(nodeId);
  }

  async hasStageData(nodeId: NodeId, stage: ShapeBuildStage): Promise<boolean> {
    return ephemeralDB.hasStageData(nodeId, stage);
  }

  async clearStage(nodeId: NodeId, stage: ShapeBuildStage): Promise<void> {
    await ephemeralDB.clearStage(nodeId, stage);
  }

  async markSourceCachesRawCacheInvalidated(nodeId: NodeId): Promise<void> {
    await ephemeralDB.sourceCache
      .where('nodeId')
      .equals(nodeId)
      .modify((record) => {
        const metadata = isRecord(record.metadata) ? record.metadata : {};
        record.metadata = { ...metadata, rawCacheInvalidated: true };
      });
  }

  async clearNodeData(nodeId: NodeId): Promise<void> {
    await ephemeralDB.clearNodeData(nodeId);
  }

  async clearAll(): Promise<void> {
    await ephemeralDB.clearAll();
  }

  async getNumCaches(): Promise<{
    numSourceCaches: number;
    numGeometryCaches: number;
    numSessions: number;
    totalSize: number;
  }> {
    return ephemeralDB.getNumCaches();
  }
}

/*
const createShapeDbApiClient = () => ({
  query: new LocalShapeQueryApi(),
  mutation: new LocalShapeMutationApi(),
  ephemeral: new ShapeEphemeralDBAPIImpl(),
});

let cachedShapeDbApiClient: ReturnType<typeof createShapeDbApiClient> | null = null;
export const getShapeDbApiClient = (): ReturnType<typeof createShapeDbApiClient> => {
  if (!cachedShapeDbApiClient) {
    cachedShapeDbApiClient = createShapeDbApiClient();
  }
  return cachedShapeDbApiClient;
};

export const createShapeBuildApiClient = (): { query: ShapeQueryAPI; mutation: ShapeMutationAPI } => {
  const { query, mutation } = getShapeDbApiClient();
  return { query, mutation };
};
 */

export const shapeQueryAPIImpl = new ShapeQueryAPIImpl();
export const shapeMutationAPIImpl = new ShapeMutationAPIImpl();
export const ephemeralShapeAPIImpl = new EphemeralShapeApiImpl();
