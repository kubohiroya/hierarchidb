import type { NodeId } from '@hierarchidb/core-types';
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
  ShapeFeatureRecord,
  ShapeFetchCache,
  ShapeMutationAPI,
  ShapeProcessingStatus,
  ShapeQueryAPI,
  ShapeDataSourceMetadata,
  ShapeTileIdToBufferRelation,
  ShapeTileInfo,
  ShapeTileSummary,
  ShapeTileSummaryEntry,
  ShapeTransformCache,
  ShapeTransformErrorRecord,
  ShapeVectorTileRecord,
  ShapeVTMetadata,
} from '@hierarchidb/shape-api';
import {
  bufferDeserializer,
  bufferSerializer,
  createShapeChunkStore,
  storeRawDataDataSourceBufferForNode,
} from '../utils/chunkStore.js';
import { resolveCountryContinentName, resolveCountryName } from '../utils/iso3166.js';
import {
  isBuildProcessConfig,
  toBuildSessionRecord,
  toBuildSessionUpdates,
  toProgressInfo,
  toProgressSummary,
  toShapeBuildSessionRecord,
  toVectorTileRecord,
} from './shapeSessionMappers.js';
import { shapeDB } from '@hierarchidb/shape-store';
import type {
  BuildSessionRecord,
  BuildTaskType,
  ResourceUsage,
  StageStatus,
  VectorTileRecord,
} from '@hierarchidb/shape-store';
import {
  hidbEphemeralDB as ephemeralShapeDB,
  type EphemeralBuildSessionRecord,
} from '@hierarchidb/gis-sdk';

const mapStatus = (status: ShapeBuildSessionSummary['status'] | 'running' | 'idle'): ShapeProcessingStatus['status'] => {
  if (status === 'running') return 'processing';
  if (status === 'idle') return 'idle';
  return status;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isProgressSummary = (value: unknown): value is ShapeBuildProgressSummary => {
  if (!isRecord(value)) return false;
  return isNumber(value.total)
    && isNumber(value.completed)
    && isNumber(value.failed)
    && isNumber(value.skipped)
    && isNumber(value.percentage)
    && (value.taskType === undefined || typeof value.taskType === 'string');
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

const readBuildSessionsByNode = async (nodeId: NodeId): Promise<BuildSessionRecord[]> => {
  const sessions = await ephemeralShapeDB.sessions.where('nodeId').equals(nodeId).toArray();
  return sessions.map(toBuildSessionRecordFromEphemeral).filter(isNonNull);
};

const readBuildSession = async (nodeId: NodeId): Promise<BuildSessionRecord | undefined> => {
  const session = await ephemeralShapeDB.sessions.get(nodeId);
  if (!session) return undefined;
  return toBuildSessionRecordFromEphemeral(session) ?? undefined;
};

const readAllBuildSessions = async (): Promise<BuildSessionRecord[]> => {
  const sessions = await ephemeralShapeDB.sessions.toArray();
  return sessions.map(toBuildSessionRecordFromEphemeral).filter(isNonNull);
};

const listVtTilesByNode = async (nodeId: NodeId): Promise<VectorTileRecord[]> => (
  shapeDB.vectorTiles.where('nodeId').equals(nodeId).toArray()
);

const pickLatestTile = (tiles: VectorTileRecord[]): VectorTileRecord | null => {
  if (tiles.length === 0) return null;
  return tiles.reduce((latest, tile) => (tile.generatedAt > latest.generatedAt ? tile : latest));
};

const getVtTileByXYZ = async (nodeId: NodeId, z: number, x: number, y: number): Promise<VectorTileRecord | null> => {
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

const isTransformCacheComplete = (record: ShapeTransformCache | null | undefined): record is ShapeTransformCache => (
  Boolean(record && record.timestamp > 0)
);

const markTransformCacheWriteComplete = async (buffers: Array<{ id: string }>): Promise<void> => {
  if (buffers.length === 0) return;
  const completedAt = Date.now();
  await Promise.all(buffers.map((buffer) => (
    ephemeralShapeDB.transformCache.update(buffer.id, { timestamp: completedAt })
  )));
};

const assertNonEmptyTransformCacheBuffer = (buffer: Pick<ShapeTransformCache, 'id' | 'data'>): void => {
  if (buffer.data.byteLength === 0) {
    throw new Error(`[shape-build] empty transform cache buffer: ${buffer.id}`);
  }
};

const assertNonEmptyTransformCacheBuffers = (buffers: Array<Pick<ShapeTransformCache, 'id' | 'data'>>): void => {
  buffers.forEach(assertNonEmptyTransformCacheBuffer);
};


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
    const db = ephemeralShapeDB;
    const tasks = await db.buildTasks.where('nodeId').equals(nodeId).toArray();
    return tasks.map((task) => toTaskSummary(task));
  }

  async listBuildTaskRecords(nodeId: NodeId): Promise<ShapeBuildTaskRecord[]> {
    const db = ephemeralShapeDB;
    return db.buildTasks.where('nodeId').equals(nodeId).toArray();
  }

  async listBuildTaskRecordsByStage(nodeId: NodeId, stage: ShapeBuildStage): Promise<ShapeBuildTaskRecord[]> {
    const tasks = await this.listBuildTaskRecords(nodeId);
    return tasks.filter((task) => task.taskType === stage);
  }

  async getBuildTaskRecord(taskId: string): Promise<ShapeBuildTaskRecord | null> {
    const db = ephemeralShapeDB;
    const task = await db.buildTasks.get(taskId);
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
      stage: latest.progress?.taskType,
      progress: latest.progress?.percentage,
      lastUpdated: latest.updatedAt,
    };
  }

  async getProcessedFeatureCount(nodeId: NodeId): Promise<number> {
    return shapeDB.features.where('nodeId').equals(nodeId).count();
  }

  async getVectorTileInfo(nodeId: NodeId, z: number, x: number, y: number): Promise<ShapeTileInfo | null> {
    const tile = await getVtTileByXYZ(nodeId, z, x, y);
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
    const tile = await getVtTileByXYZ(nodeId, z, x, y);
    return tile ? toShapeVectorTileRecord(tile) : null;
  }

  async getVectorTile(nodeId: NodeId, z: number, x: number, y: number): Promise<Uint8Array | null> {
    const tile = await getVtTileByXYZ(nodeId, z, x, y);
    if (!tile) return null;
    return new Uint8Array(tile.data_Uint8Array);
  }

  async listVectorTiles(nodeId: NodeId): Promise<ShapeTileSummaryEntry[]> {
    const tiles = await listVtTilesByNode(nodeId);
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

  async listFeatures(nodeId: NodeId): Promise<ShapeFeatureRecord[]> {
    return shapeDB.features.where('nodeId').equals(nodeId).toArray() as Promise<ShapeFeatureRecord[]>;
  }

  async listFeaturesInBbox(
    nodeId: NodeId,
    bbox: [number, number, number, number],
    adminLevel?: number,
  ): Promise<ShapeFeatureRecord[]> {
    return shapeDB.getFeaturesInBbox(nodeId, bbox, adminLevel) as Promise<ShapeFeatureRecord[]>;
  }

  async listFetchCaches(nodeId: NodeId): Promise<ShapeFetchCache[]> {
    const records = await ephemeralShapeDB.fetchCache.where('nodeId').equals(nodeId).toArray();
    return records.map((record) => ({
      id: record.id,
      nodeId: record.nodeId,
      data: record.data,
      featureCount: record.featureCount,
      bbox: record.bbox,
      downloadTime: record.downloadTime,
      size: record.size,
      timestamp: record.timestamp,
    }));
  }

  async getFetchCache(nodeId: NodeId, bufferId: string): Promise<ShapeFetchCache | null> {
    const record = await ephemeralShapeDB.fetchCache.get(bufferId);
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

  async getTransformCache(
    bufferId: string
  ): Promise<ShapeTransformCache|null> {
    return await ephemeralShapeDB.transaction('r', ephemeralShapeDB.transformCache, async () => {
      const record = await ephemeralShapeDB.transformCache.get(bufferId);
      return isTransformCacheComplete(record) ? record : null;
    });
  }

  async listTransformCaches(
    nodeId: NodeId
  ): Promise<ShapeTransformCache[]> {
    return await ephemeralShapeDB.transaction('r', ephemeralShapeDB.transformCache, async () => {
      const records = await ephemeralShapeDB.transformCache.where('nodeId').equals(nodeId).toArray();
      return records.filter((record) => isTransformCacheComplete(record));
    });
  }

  async listVTMetadata(nodeId: NodeId): Promise<ShapeVTMetadata[]> {
    const rows = await listVtTilesByNode(nodeId);
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

  async listTransformErrorRecords(nodeId: NodeId): Promise<ShapeTransformErrorRecord[]> {
    const rows = await ephemeralShapeDB.transformErrors
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
    const updates: ShapeTransformErrorRecord[] = [];
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
        await ephemeralShapeDB.transformErrors.bulkPut(updates);
      } catch (error) {
        console.warn('[ShapeBuildAPIClient] Failed to update transform error names', error);
      }
    }
    return merged;
  }
}

export class ShapeMutationAPIImpl implements ShapeMutationAPI {
  async upsertBuildSession(session: ShapeBuildSessionRecord): Promise<void> {
    const record = toBuildSessionRecord(session);
    if (!record) {
      throw new Error('Invalid build session config');
    }
    await ephemeralShapeDB.sessions.put(record);
  }

  async updateBuildSession(nodeId: NodeId, updates: Partial<ShapeBuildSessionRecord>): Promise<void> {
    const patch = toBuildSessionUpdates(updates);
    if (!patch) {
      throw new Error('Invalid build session config update');
    }
    await ephemeralShapeDB.sessions.update(nodeId, {
      ...patch,
      updatedAt: Date.now(),
    });
  }

  async deleteBuildSession(nodeId: NodeId): Promise<void> {
    await ephemeralShapeDB.sessions.delete(nodeId);
  }

  async deleteBuildTasks(nodeId: NodeId): Promise<void> {
    await ephemeralShapeDB.buildTasks.where('nodeId').equals(nodeId).delete();
  }

  async deleteVectorTile(tileId: string): Promise<void> {
    await shapeDB.deleteVectorTile(tileId);
  }

  async deleteVectorTiles(nodeId: NodeId): Promise<void> {
    await shapeDB.deleteVectorTilesByNode(nodeId);
  }

  async deleteFeatures(nodeId: NodeId): Promise<void> {
    await shapeDB.features.where('nodeId').equals(nodeId).delete();
  }

  async cleanupProcessingData(nodeId: NodeId): Promise<void> {
    await this.deleteBuildTasks(nodeId);
    await this.deleteBuildSession(nodeId);
    await this.deleteFeatures(nodeId);
    await this.deleteVectorTiles(nodeId);
    await this.clearTileIndexArtifacts(nodeId);
  }

  async clearShapeArtifacts(nodeId: NodeId): Promise<void> {
    await this.cleanupProcessingData(nodeId);
    await ephemeralShapeDB.clearNodeData(nodeId);
  }

  async upsertBuildTasks(tasks: ReadonlyArray<ShapeBuildTaskRecordInput>): Promise<void> {
    if (tasks.length === 0) return;
    await ephemeralShapeDB.buildTasks.bulkPut(tasks);
  }

  async updateBuildTask(taskId: string, updates: ShapeBuildTaskRecordUpdate): Promise<void> {
    await ephemeralShapeDB.updateBuildTask(taskId, updates);
  }

  async putFetchCaches(buffers: ShapeFetchCache[]): Promise<void> {
    if (buffers.length === 0) return;
    await Promise.all(buffers.map((buffer) => (
      storeRawDataDataSourceBufferForNode({
        nodeId: buffer.nodeId,
        cacheKey: buffer.id,
        buffer: buffer.data,
      })
    )));
  }
  async putTransformCaches(buffers: ShapeTransformCache[]): Promise<void>{
    if (buffers.length === 0) return;
    assertNonEmptyTransformCacheBuffers(buffers);
    const pending = buffers.map((buffer) => ({ ...buffer, timestamp: 0 }));
    await ephemeralShapeDB.transaction('rw', ephemeralShapeDB.transformCache, async () => {
      await ephemeralShapeDB.transformCache.bulkPut(pending);
      await markTransformCacheWriteComplete(pending);
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
    return ephemeralShapeDB.buildTasks.where('nodeId').equals(nodeId).toArray();
  }

  async listBuildTasksByStatus(nodeId: NodeId, status: ShapeBuildTaskStatus): Promise<ShapeBuildTaskRecord[]> {
    return ephemeralShapeDB.buildTasks.where('[nodeId+status]').equals([nodeId, status]).toArray();
  }

  async listBuildTasksByType(nodeId: NodeId, taskType: ShapeBuildStage): Promise<ShapeBuildTaskRecord[]> {
    return ephemeralShapeDB.buildTasks.where('[nodeId+taskType]').equals([nodeId, taskType]).toArray();
  }

  async getBuildTask(taskId: string): Promise<ShapeBuildTaskRecord | null> {
    const task = await ephemeralShapeDB.buildTasks.get(taskId);
    return task ?? null;
  }

  async countBuildTasks(nodeId: NodeId): Promise<number> {
    return ephemeralShapeDB.buildTasks.where('nodeId').equals(nodeId).count();
  }

  async putBuildTasks(tasks: ReadonlyArray<ShapeBuildTaskRecordInput>): Promise<void> {
    if (tasks.length === 0) return;
    await ephemeralShapeDB.buildTasks.bulkPut(tasks);
  }

  async deleteBuildTasksByNode(nodeId: NodeId): Promise<void> {
    await ephemeralShapeDB.buildTasks.where('nodeId').equals(nodeId).delete();
  }

  async deleteBuildTasksByIds(taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) return;
    await ephemeralShapeDB.buildTasks.bulkDelete(taskIds);
  }

  async updateBuildTask(taskId: string, updates: ShapeBuildTaskRecordUpdate): Promise<void> {
    await ephemeralShapeDB.updateBuildTask(taskId, updates);
  }

  async listFetchCaches(nodeId: NodeId): Promise<ShapeFetchCache[]> {
    const records = await ephemeralShapeDB.fetchCache.where('nodeId').equals(nodeId).toArray();
    return records.map((record) => ({
      id: record.id,
      nodeId: record.nodeId,
      data: record.data,
      featureCount: record.featureCount,
      bbox: record.bbox,
      downloadTime: record.downloadTime,
      size: record.size,
      timestamp: record.timestamp,
    }));
  }

  async getFetchCache(nodeId: NodeId, bufferId: string): Promise<ShapeFetchCache | null> {
    const record = await ephemeralShapeDB.fetchCache.get(bufferId);
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

  async countFetchCaches(nodeId: NodeId): Promise<number> {
    return ephemeralShapeDB.fetchCache.where('nodeId').equals(nodeId).count();
  }

  async putFetchCache(buffer: ShapeFetchCache): Promise<void> {
    await storeRawDataDataSourceBufferForNode({
      nodeId: buffer.nodeId,
      cacheKey: buffer.id,
      buffer: buffer.data,
    });
  }

  async putFetchCaches(buffers: ShapeFetchCache[]): Promise<void> {
    if (buffers.length === 0) return;
    await Promise.all(buffers.map((buffer) => (
      storeRawDataDataSourceBufferForNode({
        nodeId: buffer.nodeId,
        cacheKey: buffer.id,
        buffer: buffer.data,
      })
    )));
  }

  async listTransformCaches(
    nodeId: NodeId
  ): Promise<ShapeTransformCache[]> {
    return await ephemeralShapeDB.transaction('r', ephemeralShapeDB.transformCache, async () => {
      const records = await ephemeralShapeDB.transformCache.where('nodeId').equals(nodeId).toArray();
      return records.filter((record) => isTransformCacheComplete(record));
    });
  }

  async getTransformCache(bufferId: string): Promise<ShapeTransformCache | null> {
    return await ephemeralShapeDB.transaction('r', ephemeralShapeDB.transformCache, async () => {
      const record = await ephemeralShapeDB.transformCache.get(bufferId);
      return isTransformCacheComplete(record) ? record : null;
    });
  }

  async countTransformCaches(nodeId: NodeId): Promise<number> {
    return ephemeralShapeDB.transaction('r', ephemeralShapeDB.transformCache, async () => (
      ephemeralShapeDB.transformCache
        .where('nodeId')
        .equals(nodeId)
        .filter((record) => isTransformCacheComplete(record))
        .count()
    ));
  }

  async putTransformCache(buffer: ShapeTransformCache): Promise<void> {
    assertNonEmptyTransformCacheBuffer(buffer);
    const pending = { ...buffer, timestamp: 0 };
    await ephemeralShapeDB.transaction('rw', ephemeralShapeDB.transformCache, async () => {
      await ephemeralShapeDB.transformCache.put(pending);
      await markTransformCacheWriteComplete([pending]);
    });
  }

  async putTransformCaches(buffers: ShapeTransformCache[]): Promise<void> {
    if (buffers.length === 0) return;
    assertNonEmptyTransformCacheBuffers(buffers);
    const pending = buffers.map((buffer) => ({ ...buffer, timestamp: 0 }));
    await ephemeralShapeDB.transaction('rw', ephemeralShapeDB.transformCache, async () => {
      await ephemeralShapeDB.transformCache.bulkPut(pending);
      await markTransformCacheWriteComplete(pending);
    });
  }

  async listTileIdRelations(nodeId: NodeId): Promise<ShapeTileIdToBufferRelation[]> {
    return ephemeralShapeDB.tileIdToBufferRelations.where('nodeId').equals(nodeId).toArray() as Promise<ShapeTileIdToBufferRelation[]>;
  }

  async listTileIdRelationsByTileId(nodeId: NodeId, bandIndex: number, tileId: string): Promise<ShapeTileIdToBufferRelation[]> {
    return ephemeralShapeDB.tileIdToBufferRelations
      .where('[nodeId+bandIndex+tileId]')
      .equals([nodeId, bandIndex, tileId])
      .toArray() as Promise<ShapeTileIdToBufferRelation[]>;
  }

  async putTileIdRelations(relations: ShapeTileIdToBufferRelation[]): Promise<void> {
    if (relations.length === 0) return;
    await ephemeralShapeDB.tileIdToBufferRelations.bulkPut(relations);
  }

  async deleteTileIdRelations(nodeId: NodeId): Promise<void> {
    await ephemeralShapeDB.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
  }

  async getSessionRecord(nodeId: NodeId): Promise<ShapeEphemeralSessionRecord | null> {
    return (await ephemeralShapeDB.sessions.get(nodeId)) ?? null;
  }

  async hasStageData(nodeId: NodeId, stage: ShapeBuildStage): Promise<boolean> {
    return ephemeralShapeDB.hasStageData(nodeId, stage);
  }

  async clearStage(nodeId: NodeId, stage: ShapeBuildStage): Promise<void> {
    await ephemeralShapeDB.clearStage(nodeId, stage);
    if (stage === 'fetch') {
      try {
        const store = createShapeChunkStore(bufferSerializer, bufferDeserializer);
        await store.deleteAllForNode(nodeId);
      } catch (error) {
        console.warn('[shapeBuildAPI] failed to clear download chunk-store entries', error);
      }
    }
  }

  async clearNodeData(nodeId: NodeId): Promise<void> {
    await ephemeralShapeDB.clearNodeData(nodeId);
  }

  async clearAll(): Promise<void> {
    await ephemeralShapeDB.clearAll();
  }

  async getNumCaches(): Promise<{
    numFetchCaches: number;
    numTransformCaches: number;
    numSessions: number;
    totalSize: number;
  }> {
    return ephemeralShapeDB.getNumCaches();
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
