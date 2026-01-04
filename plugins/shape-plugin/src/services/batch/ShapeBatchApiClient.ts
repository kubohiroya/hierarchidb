import type { NodeId } from '@hierarchidb/common-types';
import type {
  ShapeBatchSessionRecord,
  ShapeBatchSessionSummary,
  ShapeBatchTaskRecord,
  ShapeBatchTaskStage,
  ShapeBatchTaskStatus,
  ShapeBatchTaskSummary,
  ShapeEphemeralDBAPI,
  ShapeEphemeralSessionRecord,
  ShapeEphemeralStage,
  ShapeExtractedBufferRecord,
  ShapeFeatureRecord,
  ShapeFeatureMetadataRow,
  ShapeMutationAPI,
  ShapeProcessingCacheEntry,
  ShapeProcessingStatus,
  ShapeQueryAPI,
  ShapeRawBufferRecord,
  ShapeSourceMetadataRow,
  ShapeTileIdToBufferRelation,
  ShapeTileInfo,
  ShapeTileRow,
  ShapeTileSummary,
  ShapeTileSummaryEntry,
  ShapeVectorTileRecord,
} from '@hierarchidb/plugin-service-api';
import { shapeDB } from '../database/ShapeDB.js';
import { getEphemeralShapeDB } from '../database/EphemeralShapeDB.js';
import {
  toBatchSessionRecord,
  toBatchSessionUpdates,
  toProgressSummary,
  toShapeBatchSessionRecord,
  toVectorTileRecord,
} from './shapeSessionMappers.js';

const mapStatus = (status: ShapeBatchSessionSummary['status'] | 'running' | 'idle'): ShapeProcessingStatus['status'] => {
  if (status === 'running') return 'processing';
  if (status === 'idle') return 'idle';
  return status;
};

const toTaskSummary = (task: ShapeBatchTaskRecord): ShapeBatchTaskSummary => ({
  taskId: task.taskId,
  nodeId: task.nodeId,
  taskType: task.taskType,
  status: task.status,
  index: task.index,
  progress: task.progress,
  message: task.message,
  startedAt: task.startedAt,
  completedAt: task.completedAt,
  errorMessage: task.errorMessage,
});

export class LocalShapeQueryApi implements ShapeQueryAPI {
  async listBatchSessions(nodeId: NodeId): Promise<ShapeBatchSessionSummary[]> {
    const sessions = await shapeDB.batchSessions.where('nodeId').equals(nodeId).toArray();
    return sessions.map((session) => ({
      nodeId: session.nodeId,
      status: mapStatus(session.status),
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt,
      progress: toProgressSummary(session.progress),
    }));
  }

  async getBatchSession(nodeId: NodeId): Promise<ShapeBatchSessionSummary | null> {
    const session = await shapeDB.getBatchSession(nodeId);
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

  async listBatchSessionRecords(nodeId: NodeId): Promise<ShapeBatchSessionRecord[]> {
    const sessions = await shapeDB.batchSessions.where('nodeId').equals(nodeId).toArray();
    return sessions.map(toShapeBatchSessionRecord);
  }

  async getBatchSessionRecord(nodeId: NodeId): Promise<ShapeBatchSessionRecord | null> {
    const session = await shapeDB.getBatchSession(nodeId);
    return session ? toShapeBatchSessionRecord(session) : null;
  }

  async listBatchSessionRecordsByStatus(
    statuses: Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'>,
  ): Promise<ShapeBatchSessionRecord[]> {
    const sessions = await shapeDB.batchSessions.where('status').anyOf(statuses).toArray();
    return sessions.map(toShapeBatchSessionRecord);
  }

  async listBatchTasks(nodeId: NodeId): Promise<ShapeBatchTaskSummary[]> {
    const db = getEphemeralShapeDB();
    const tasks = await db.batchTasks.where('nodeId').equals(nodeId).toArray();
    return tasks.map((task) => toTaskSummary(task as ShapeBatchTaskRecord));
  }

  async listBatchTaskRecords(nodeId: NodeId): Promise<ShapeBatchTaskRecord[]> {
    const db = getEphemeralShapeDB();
    return db.batchTasks.where('nodeId').equals(nodeId).toArray() as Promise<ShapeBatchTaskRecord[]>;
  }

  async listBatchTaskRecordsByStage(nodeId: NodeId, stage: ShapeBatchTaskStage): Promise<ShapeBatchTaskRecord[]> {
    const tasks = await this.listBatchTaskRecords(nodeId);
    return tasks.filter((task) => task.taskType === stage);
  }

  async getBatchTaskRecord(taskId: string): Promise<ShapeBatchTaskRecord | null> {
    const db = getEphemeralShapeDB();
    const task = await db.batchTasks.get(taskId);
    return task ? (task as ShapeBatchTaskRecord) : null;
  }

  async getProcessingStatus(nodeId: NodeId): Promise<ShapeProcessingStatus | null> {
    const sessions = await shapeDB.batchSessions.where('nodeId').equals(nodeId).toArray();
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
      errorMessages: latest.status === 'failed' ? ['Batch processing failed'] : [],
      stage: latest.progress?.currentStage,
      progress: latest.progress?.percentage,
      lastUpdated: latest.updatedAt,
    };
  }

  async getProcessedFeatureCount(nodeId: NodeId): Promise<number> {
    return shapeDB.features.where('nodeId').equals(nodeId).count();
  }

  async getVectorTileInfo(nodeId: NodeId, z: number, x: number, y: number): Promise<ShapeTileInfo | null> {
    const tile = await shapeDB.getVectorTile(nodeId, z, x, y);
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

  async getVectorTileRecord(nodeId: NodeId, z: number, x: number, y: number): Promise<ShapeVectorTileRecord | null> {
    const tile = await shapeDB.getVectorTile(nodeId, z, x, y);
    return (tile as ShapeVectorTileRecord | undefined) ?? null;
  }

  async getVectorTile(nodeId: NodeId, z: number, x: number, y: number): Promise<Uint8Array | null> {
    const tile = await shapeDB.getVectorTile(nodeId, z, x, y);
    if (!tile) return null;
    const data = tile.data_Uint8Array;
    if (data instanceof Uint8Array) return data;
    return new Uint8Array(data);
  }

  async listVectorTiles(nodeId: NodeId): Promise<ShapeTileSummaryEntry[]> {
    const tiles = await shapeDB.vectorTiles.where('nodeId').equals(nodeId).toArray();
    return tiles.map((tile) => ({
      z: tile.z,
      x: tile.x,
      y: tile.y,
      size: tile.size,
      timestamp: tile.generatedAt,
    }));
  }

  async getVectorTileSummary(nodeId: NodeId): Promise<ShapeTileSummary> {
    const tiles = await shapeDB.vectorTiles.where('nodeId').equals(nodeId).toArray();
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
    return shapeDB.features.where('nodeId').equals(nodeId).toArray() as Promise<ShapeFeatureRecord[]>;
  }

  async listFeaturesInBbox(
    nodeId: NodeId,
    bbox: [number, number, number, number],
    adminLevel?: number,
  ): Promise<ShapeFeatureRecord[]> {
    return shapeDB.getFeaturesInBbox(nodeId, bbox, adminLevel) as Promise<ShapeFeatureRecord[]>;
  }

  async listRawBuffers(nodeId: NodeId): Promise<ShapeRawBufferRecord[]> {
    const db = getEphemeralShapeDB();
    return db.rawBuffers.where('nodeId').equals(nodeId).toArray() as Promise<ShapeRawBufferRecord[]>;
  }

  async getRawBuffer(bufferId: string): Promise<ShapeRawBufferRecord | null> {
    const db = getEphemeralShapeDB();
    const buffer = await db.rawBuffers.get(bufferId);
    return buffer ?? null;
  }

  async listExtractedBuffers(
    nodeId: NodeId,
    stage?: 'extract1' | 'extract2',
  ): Promise<ShapeExtractedBufferRecord[]> {
    const db = getEphemeralShapeDB();
    if (!stage) {
      return db.extractedBuffers.where('nodeId').equals(nodeId).toArray() as Promise<ShapeExtractedBufferRecord[]>;
    }
    return db.extractedBuffers.where('[nodeId+stage]').equals([nodeId, stage]).toArray() as
      Promise<ShapeExtractedBufferRecord[]>;
  }

  async getExtractedBuffer(bufferId: string): Promise<ShapeExtractedBufferRecord | null> {
    const db = getEphemeralShapeDB();
    const buffer = await db.extractedBuffers.get(bufferId);
    return buffer ?? null;
  }

  async listVectorTileRows(nodeId: NodeId): Promise<ShapeTileRow[]> {
    const rows = await shapeDB.vectorTiles.where('nodeId').equals(nodeId).toArray();
    return rows.map((row) => ({
      key: row.tileId,
      nodeId: String(nodeId),
      z: row.z,
      x: row.x,
      y: row.y,
      data: row.data_Uint8Array.buffer.slice(
        row.data_Uint8Array.byteOffset,
        row.data_Uint8Array.byteOffset + row.data_Uint8Array.byteLength,
      ),
      size: row.size,
      contentType: 'application/vnd.mapbox-vector-tile',
      timestamp: row.generatedAt,
    }));
  }

  async listSourceMetadata(nodeId: NodeId): Promise<ShapeSourceMetadataRow[]> {
    return shapeDB.sourceMetadata.where('nodeId').equals(String(nodeId)).toArray() as Promise<ShapeSourceMetadataRow[]>;
  }

  async listFeatureMetadata(nodeId: NodeId): Promise<ShapeFeatureMetadataRow[]> {
    return shapeDB.featureMetadata.where('nodeId').equals(String(nodeId)).toArray() as Promise<ShapeFeatureMetadataRow[]>;
  }
}

export class LocalShapeMutationApi implements ShapeMutationAPI {
  async upsertBatchSession(session: ShapeBatchSessionRecord): Promise<void> {
    const record = toBatchSessionRecord(session);
    if (!record) {
      throw new Error('Invalid batch session config');
    }
    await shapeDB.batchSessions.put(record);
  }

  async updateBatchSession(nodeId: NodeId, updates: Partial<ShapeBatchSessionRecord>): Promise<void> {
    const patch = toBatchSessionUpdates(updates);
    if (!patch) {
      throw new Error('Invalid batch session config update');
    }
    await shapeDB.updateBatchSession(nodeId, patch);
  }

  async deleteBatchSession(nodeId: NodeId): Promise<void> {
    await shapeDB.batchSessions.delete(nodeId);
  }

  async deleteBatchTasks(nodeId: NodeId): Promise<void> {
    const db = getEphemeralShapeDB();
    await db.batchTasks.where('nodeId').equals(nodeId).delete();
  }

  async deleteVectorTile(tileId: string): Promise<void> {
    await shapeDB.vectorTiles.delete(tileId);
  }

  async deleteVectorTiles(nodeId: NodeId): Promise<void> {
    await shapeDB.vectorTiles.where('nodeId').equals(nodeId).delete();
  }

  async deleteTileBuffers(nodeId: NodeId): Promise<void> {
    const db = getEphemeralShapeDB();
    await db.tileBuffers.where('nodeId').equals(nodeId).delete();
  }

  async deleteFeatureBuffers(nodeId: NodeId): Promise<void> {
    const db = getEphemeralShapeDB();
    await db.featureBuffers.where('nodeId').equals(nodeId).delete();
  }

  async deleteFeatures(nodeId: NodeId): Promise<void> {
    await shapeDB.features.where('nodeId').equals(nodeId).delete();
  }

  async clearCache(nodeId: NodeId): Promise<number> {
    const db = getEphemeralShapeDB();
    const keys = await db.cache
      .filter((entry) => entry.key.includes(String(nodeId)))
      .primaryKeys();
    if (keys.length > 0) {
      await db.cache.bulkDelete(keys);
    }
    return keys.length;
  }

  async cleanupProcessingData(nodeId: NodeId): Promise<void> {
    await this.deleteBatchTasks(nodeId);
    await this.deleteBatchSession(nodeId);
    await this.deleteFeatures(nodeId);
    await this.deleteFeatureBuffers(nodeId);
    await this.deleteTileBuffers(nodeId);
    await this.deleteVectorTiles(nodeId);
    await this.clearCache(nodeId);
    await this.clearTileIndexArtifacts(nodeId);
  }

  async clearShapeArtifacts(nodeId: NodeId): Promise<void> {
    await this.cleanupProcessingData(nodeId);
    const db = getEphemeralShapeDB();
    await db.clearNodeData(nodeId);
  }

  async upsertBatchTasks(tasks: ShapeBatchTaskRecord[]): Promise<void> {
    if (tasks.length === 0) return;
    const db = getEphemeralShapeDB();
    await db.batchTasks.bulkPut(tasks);
  }

  async updateBatchTask(taskId: string, updates: Partial<ShapeBatchTaskRecord>): Promise<void> {
    const db = getEphemeralShapeDB();
    await db.updateBatchTask(taskId, {
      ...updates,
      updatedAt: updates.updatedAt ?? Date.now(),
    });
  }

  async putRawBuffers(buffers: ShapeRawBufferRecord[]): Promise<void> {
    if (buffers.length === 0) return;
    const db = getEphemeralShapeDB();
    await db.rawBuffers.bulkPut(buffers);
  }

  async putExtractedBuffers(buffers: ShapeExtractedBufferRecord[]): Promise<void> {
    if (buffers.length === 0) return;
    const db = getEphemeralShapeDB();
    await db.extractedBuffers.bulkPut(buffers);
  }

  async putSourceMetadata(rows: ShapeSourceMetadataRow[]): Promise<void> {
    if (rows.length === 0) return;
    await shapeDB.sourceMetadata.bulkPut(rows);
  }

  async deleteSourceMetadataByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await shapeDB.sourceMetadata.bulkDelete(ids);
  }

  async deleteSourceMetadataByNode(nodeId: NodeId): Promise<void> {
    await shapeDB.sourceMetadata.where('nodeId').equals(nodeId).delete();
  }

  async putFeatureMetadata(rows: ShapeFeatureMetadataRow[]): Promise<void> {
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

export class LocalShapeEphemeralDbApi implements ShapeEphemeralDBAPI {
  async listBatchTasks(nodeId: NodeId): Promise<ShapeBatchTaskRecord[]> {
    const db = getEphemeralShapeDB();
    return db.batchTasks.where('nodeId').equals(nodeId).toArray() as Promise<ShapeBatchTaskRecord[]>;
  }

  async listBatchTasksByStatus(nodeId: NodeId, status: ShapeBatchTaskStatus): Promise<ShapeBatchTaskRecord[]> {
    const db = getEphemeralShapeDB();
    return db.batchTasks.where('[nodeId+status]').equals([nodeId, status]).toArray() as Promise<ShapeBatchTaskRecord[]>;
  }

  async listBatchTasksByType(nodeId: NodeId, taskType: ShapeBatchTaskStage): Promise<ShapeBatchTaskRecord[]> {
    const db = getEphemeralShapeDB();
    return db.batchTasks.where('[nodeId+taskType]').equals([nodeId, taskType]).toArray() as Promise<ShapeBatchTaskRecord[]>;
  }

  async getBatchTask(taskId: string): Promise<ShapeBatchTaskRecord | null> {
    const db = getEphemeralShapeDB();
    return (await db.batchTasks.get(taskId)) ?? null;
  }

  async countBatchTasks(nodeId: NodeId): Promise<number> {
    const db = getEphemeralShapeDB();
    return db.batchTasks.where('nodeId').equals(nodeId).count();
  }

  async putBatchTasks(tasks: ShapeBatchTaskRecord[]): Promise<void> {
    if (tasks.length === 0) return;
    const db = getEphemeralShapeDB();
    await db.batchTasks.bulkPut(tasks);
  }

  async deleteBatchTasksByNode(nodeId: NodeId): Promise<void> {
    const db = getEphemeralShapeDB();
    await db.batchTasks.where('nodeId').equals(nodeId).delete();
  }

  async deleteBatchTasksByIds(taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) return;
    const db = getEphemeralShapeDB();
    await db.batchTasks.bulkDelete(taskIds);
  }

  async updateBatchTask(taskId: string, updates: Partial<ShapeBatchTaskRecord>): Promise<void> {
    const db = getEphemeralShapeDB();
    await db.updateBatchTask(taskId, updates);
  }

  async listRawBuffers(nodeId: NodeId): Promise<ShapeRawBufferRecord[]> {
    const db = getEphemeralShapeDB();
    return db.rawBuffers.where('nodeId').equals(nodeId).toArray() as Promise<ShapeRawBufferRecord[]>;
  }

  async getRawBuffer(bufferId: string): Promise<ShapeRawBufferRecord | null> {
    const db = getEphemeralShapeDB();
    return (await db.rawBuffers.get(bufferId)) ?? null;
  }

  async countRawBuffers(nodeId: NodeId): Promise<number> {
    const db = getEphemeralShapeDB();
    return db.rawBuffers.where('nodeId').equals(nodeId).count();
  }

  async putRawBuffer(buffer: ShapeRawBufferRecord): Promise<void> {
    const db = getEphemeralShapeDB();
    await db.rawBuffers.put(buffer);
  }

  async putRawBuffers(buffers: ShapeRawBufferRecord[]): Promise<void> {
    if (buffers.length === 0) return;
    const db = getEphemeralShapeDB();
    await db.rawBuffers.bulkPut(buffers);
  }

  async listExtractedBuffers(
    nodeId: NodeId,
    stage?: 'extract1' | 'extract2',
  ): Promise<ShapeExtractedBufferRecord[]> {
    const db = getEphemeralShapeDB();
    if (!stage) {
      return db.extractedBuffers.where('nodeId').equals(nodeId).toArray() as Promise<ShapeExtractedBufferRecord[]>;
    }
    return db.extractedBuffers.where('[nodeId+stage]').equals([nodeId, stage]).toArray() as
      Promise<ShapeExtractedBufferRecord[]>;
  }

  async getExtractedBuffer(bufferId: string): Promise<ShapeExtractedBufferRecord | null> {
    const db = getEphemeralShapeDB();
    return (await db.extractedBuffers.get(bufferId)) ?? null;
  }

  async countExtractedBuffers(nodeId: NodeId, stage?: 'extract1' | 'extract2'): Promise<number> {
    const db = getEphemeralShapeDB();
    if (!stage) {
      return db.extractedBuffers.where('nodeId').equals(nodeId).count();
    }
    return db.extractedBuffers.where('[nodeId+stage]').equals([nodeId, stage]).count();
  }

  async putExtractedBuffer(buffer: ShapeExtractedBufferRecord): Promise<void> {
    const db = getEphemeralShapeDB();
    await db.extractedBuffers.put(buffer);
  }

  async putExtractedBuffers(buffers: ShapeExtractedBufferRecord[]): Promise<void> {
    if (buffers.length === 0) return;
    const db = getEphemeralShapeDB();
    await db.extractedBuffers.bulkPut(buffers);
  }

  async countVectorTiles(nodeId: NodeId): Promise<number> {
    const db = getEphemeralShapeDB();
    return db.vectorTiles.where('nodeId').equals(nodeId).count();
  }

  async listTileIdRelations(nodeId: NodeId): Promise<ShapeTileIdToBufferRelation[]> {
    const db = getEphemeralShapeDB();
    return db.tileIdToBufferRelations.where('nodeId').equals(nodeId).toArray() as Promise<ShapeTileIdToBufferRelation[]>;
  }

  async listTileIdRelationsByTileId(nodeId: NodeId, tileId: string): Promise<ShapeTileIdToBufferRelation[]> {
    const db = getEphemeralShapeDB();
    return db.tileIdToBufferRelations
      .where('[nodeId+tileId]')
      .equals([nodeId, tileId])
      .toArray() as Promise<ShapeTileIdToBufferRelation[]>;
  }

  async putTileIdRelations(relations: ShapeTileIdToBufferRelation[]): Promise<void> {
    if (relations.length === 0) return;
    const db = getEphemeralShapeDB();
    await db.tileIdToBufferRelations.bulkPut(relations);
  }

  async deleteTileIdRelations(nodeId: NodeId): Promise<void> {
    const db = getEphemeralShapeDB();
    await db.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
  }

  async getSessionRecord(nodeId: NodeId): Promise<ShapeEphemeralSessionRecord | null> {
    const db = getEphemeralShapeDB();
    return (await db.sessions.get(nodeId)) ?? null;
  }

  async deleteFeatureBuffers(nodeId: NodeId): Promise<void> {
    const db = getEphemeralShapeDB();
    await db.featureBuffers.where('nodeId').equals(nodeId).delete();
  }

  async deleteTileBuffers(nodeId: NodeId): Promise<void> {
    const db = getEphemeralShapeDB();
    await db.tileBuffers.where('nodeId').equals(nodeId).delete();
  }

  async countCacheEntries(nodeId: NodeId): Promise<number> {
    const db = getEphemeralShapeDB();
    return db.cache.filter((entry) => entry.key.includes(String(nodeId))).count();
  }

  async putCacheEntries(entries: ShapeProcessingCacheEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const db = getEphemeralShapeDB();
    await db.cache.bulkAdd(entries);
  }

  async clearCache(nodeId: NodeId): Promise<number> {
    const db = getEphemeralShapeDB();
    const keys = await db.cache.filter((entry) => entry.key.includes(String(nodeId))).primaryKeys();
    if (keys.length > 0) {
      await db.cache.bulkDelete(keys);
    }
    return keys.length;
  }

  async hasStageData(nodeId: NodeId, stage: ShapeEphemeralStage): Promise<boolean> {
    const db = getEphemeralShapeDB();
    return db.hasStageData(nodeId, stage);
  }

  async clearStage(nodeId: NodeId, stage: ShapeEphemeralStage): Promise<void> {
    const db = getEphemeralShapeDB();
    await db.clearStage(nodeId, stage);
  }

  async clearNodeData(nodeId: NodeId): Promise<void> {
    const db = getEphemeralShapeDB();
    await db.clearNodeData(nodeId);
  }

  async clearAll(): Promise<void> {
    const db = getEphemeralShapeDB();
    await db.clearAll();
  }

  async clearExpiredCache(): Promise<number> {
    const db = getEphemeralShapeDB();
    return db.clearExpiredCache();
  }

  async getStatistics(): Promise<{
    rawBuffers: number;
    extractedBuffers: number;
    vectorTiles: number;
    sessions: number;
    cacheEntries: number;
    totalSize: number;
  }> {
    const db = getEphemeralShapeDB();
    return db.getStatistics();
  }
}

const createShapeDbApiClient = () => ({
  query: new LocalShapeQueryApi(),
  mutation: new LocalShapeMutationApi(),
  ephemeral: new LocalShapeEphemeralDbApi(),
});

let cachedShapeDbApiClient: ReturnType<typeof createShapeDbApiClient> | null = null;

export const getShapeDbApiClient = (): ReturnType<typeof createShapeDbApiClient> => {
  if (!cachedShapeDbApiClient) {
    cachedShapeDbApiClient = createShapeDbApiClient();
  }
  return cachedShapeDbApiClient;
};

export const createShapeBatchApiClient = (): { query: ShapeQueryAPI; mutation: ShapeMutationAPI } => {
  const { query, mutation } = getShapeDbApiClient();
  return { query, mutation };
};
