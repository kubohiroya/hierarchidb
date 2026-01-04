import type { NodeId } from '@hierarchidb/common-types';
import type {
  ShapeBatchSessionSummary,
  ShapeBatchTaskRecord,
  ShapeBatchTaskStage,
  ShapeBatchTaskSummary,
  ShapeExtractedBufferRecord,
  ShapeFeatureMetadataRow,
  ShapeMutationAPI,
  ShapeProcessingStatus,
  ShapeQueryAPI,
  ShapeRawBufferRecord,
  ShapeSourceMetadataRow,
  ShapeTileInfo,
  ShapeTileRow,
  ShapeTileSummary,
  ShapeTileSummaryEntry,
} from '@hierarchidb/plugin-service-api';
import { shapeDB } from '../database/ShapeDB.js';
import { getEphemeralShapeDB } from '../database/EphemeralShapeDB.js';

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
      progress: session.progress,
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
      progress: session.progress,
    };
  }

  async listBatchTasks(nodeId: NodeId): Promise<ShapeBatchTaskSummary[]> {
    const tasks = await shapeDB.batchTasks.where('nodeId').equals(nodeId).toArray();
    return tasks.map((task) => toTaskSummary(task as ShapeBatchTaskRecord));
  }

  async listBatchTaskRecords(nodeId: NodeId): Promise<ShapeBatchTaskRecord[]> {
    return shapeDB.batchTasks.where('nodeId').equals(nodeId).toArray() as Promise<ShapeBatchTaskRecord[]>;
  }

  async listBatchTaskRecordsByStage(nodeId: NodeId, stage: ShapeBatchTaskStage): Promise<ShapeBatchTaskRecord[]> {
    const tasks = await this.listBatchTaskRecords(nodeId);
    return tasks.filter((task) => task.taskType === stage);
  }

  async getBatchTaskRecord(taskId: string): Promise<ShapeBatchTaskRecord | null> {
    const task = await shapeDB.batchTasks.get(taskId);
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
  async deleteBatchSession(nodeId: NodeId): Promise<void> {
    await shapeDB.batchSessions.delete(nodeId);
  }

  async deleteBatchTasks(nodeId: NodeId): Promise<void> {
    await shapeDB.batchTasks.where('nodeId').equals(nodeId).delete();
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
    await this.clearTileIndexArtifacts(String(nodeId));
  }

  async clearShapeArtifacts(nodeId: NodeId): Promise<void> {
    await this.cleanupProcessingData(nodeId);
    const db = getEphemeralShapeDB();
    await db.clearNodeData(nodeId);
  }

  async upsertBatchTasks(tasks: ShapeBatchTaskRecord[]): Promise<void> {
    if (tasks.length === 0) return;
    await shapeDB.batchTasks.bulkPut(tasks);
  }

  async updateBatchTask(taskId: string, updates: Partial<ShapeBatchTaskRecord>): Promise<void> {
    await shapeDB.updateBatchTask(taskId, {
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

  private async clearTileIndexArtifacts(nodeId: NodeId): Promise<void> {
    void nodeId;
  }

}

export const createShapeBatchApiClient = (): { query: ShapeQueryAPI; mutation: ShapeMutationAPI } => ({
  query: new LocalShapeQueryApi(),
  mutation: new LocalShapeMutationApi(),
});
