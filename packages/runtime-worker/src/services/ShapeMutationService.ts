import { SingletonMixin } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type {
  ShapeBatchTaskRecord,
  ShapeExtractedBufferRecord,
  ShapeFeatureMetadataRow,
  ShapeMutationAPI,
  ShapeRawBufferRecord,
  ShapeSourceMetadataRow,
} from '@hierarchidb/plugin-service-api';
import { getEphemeralShapeDB } from '@hierarchidb/shape-store';
import type { ShapeDB } from '@hierarchidb/shape-store';

export class ShapeMutationService implements ShapeMutationAPI {
  static async getSingleton(db: ShapeDB): Promise<ShapeMutationService> {
    return SingletonMixin.getSingleton('ShapeMutationService', async () => new ShapeMutationService(db));
  }

  constructor(private db: ShapeDB) {}

  private async ensureOpen(): Promise<void> {
    await this.db.open?.();
  }

  async deleteBatchSession(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.batchSessions.delete(nodeId);
  }

  async deleteBatchTasks(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.batchTasks.where('nodeId').equals(nodeId).delete?.();
  }

  async deleteVectorTiles(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.vectorTiles.where('nodeId').equals(nodeId).delete?.();
  }

  async deleteTileBuffers(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    const ephemeral = getEphemeralShapeDB();
    await ephemeral.tileBuffers.where('nodeId').equals(nodeId).delete();
  }

  async deleteFeatureBuffers(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    const ephemeral = getEphemeralShapeDB();
    await ephemeral.featureBuffers.where('nodeId').equals(nodeId).delete();
  }

  async deleteFeatures(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.features.where('nodeId').equals(nodeId).delete?.();
  }

  async clearCache(nodeId: NodeId): Promise<number> {
    await this.ensureOpen();
    const ephemeral = getEphemeralShapeDB();
    const keys = await ephemeral.cache
      .filter((entry) => entry.key.includes(String(nodeId)))
      .primaryKeys();
    if (keys.length > 0) {
      await ephemeral.cache.bulkDelete(keys);
    }
    return keys.length;
  }

  async cleanupProcessingData(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.batchTasks.where('nodeId').equals(nodeId).delete();
    await this.db.batchSessions.where('nodeId').equals(nodeId).delete();
    await this.deleteFeatures(nodeId);
    await this.deleteFeatureBuffers(nodeId);
    await this.deleteTileBuffers(nodeId);
    await this.deleteVectorTiles(nodeId);
    await this.clearCache(nodeId);
    await this.clearTileIndexArtifacts(String(nodeId));
  }

  async clearShapeArtifacts(nodeId: NodeId): Promise<void> {
    await this.cleanupProcessingData(nodeId);
    const ephemeral = getEphemeralShapeDB();
    await ephemeral.clearNodeData(nodeId);
  }

  async upsertBatchTasks(tasks: ShapeBatchTaskRecord[]): Promise<void> {
    await this.ensureOpen();
    if (tasks.length === 0) return;
    await this.db.batchTasks.bulkPut?.(tasks);
  }

  async updateBatchTask(taskId: string, updates: Partial<ShapeBatchTaskRecord>): Promise<void> {
    await this.ensureOpen();
    await this.db.batchTasks.update?.(taskId, {
      ...updates,
      updatedAt: updates.updatedAt ?? Date.now(),
    });
  }

  async putRawBuffers(buffers: ShapeRawBufferRecord[]): Promise<void> {
    const db = getEphemeralShapeDB();
    if (buffers.length === 0) return;
    await db.rawBuffers.bulkPut(buffers);
  }

  async putExtractedBuffers(buffers: ShapeExtractedBufferRecord[]): Promise<void> {
    const db = getEphemeralShapeDB();
    if (buffers.length === 0) return;
    await db.extractedBuffers.bulkPut(buffers);
  }

  async putSourceMetadata(rows: ShapeSourceMetadataRow[]): Promise<void> {
    if (rows.length === 0) return;
    await this.db.sourceMetadata.bulkPut?.(rows);
  }

  async deleteSourceMetadataByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db.sourceMetadata.bulkDelete?.(ids);
  }

  async deleteSourceMetadataByNode(nodeId: string): Promise<void> {
    await this.db.sourceMetadata.where('nodeId').equals(nodeId).delete?.();
  }

  async putFeatureMetadata(rows: ShapeFeatureMetadataRow[]): Promise<void> {
    if (rows.length === 0) return;
    await this.db.featureMetadata.bulkPut?.(rows);
  }

  async deleteFeatureMetadataByNode(nodeId: string): Promise<void> {
    await this.db.featureMetadata.where('nodeId').equals(nodeId).delete?.();
  }

  async syncVectorTilesFromTilesDb(nodeId: NodeId): Promise<void> {
    void nodeId;
  }

  private async clearTileIndexArtifacts(nodeId: string): Promise<void> {
    void nodeId;
  }
}
