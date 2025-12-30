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
import { TilesDB } from '@hierarchidb/gis-sdk';

type DexieCollection = {
  delete?: () => Promise<number>;
  count?: () => Promise<number>;
  toArray?: () => Promise<unknown[]>;
};

type DexieWhere = {
  equals(value: unknown): DexieCollection;
};

type DexieTable = {
  where(key: string): DexieWhere;
  delete?: (id: string) => Promise<void>;
  update?: (id: string, changes: Record<string, unknown>) => Promise<void>;
  bulkPut?: (items: Array<object>) => Promise<void>;
};

type ShapeDatabaseLike = {
  open?: () => Promise<unknown>;
  batchSessions: DexieTable;
  batchTasks: DexieTable;
  features: DexieTable;
  vectorTiles: DexieTable;
};

export class ShapeMutationService implements ShapeMutationAPI {
  static async getSingleton(db: ShapeDatabaseLike): Promise<ShapeMutationService> {
    return SingletonMixin.getSingleton('ShapeMutationService', async () => new ShapeMutationService(db));
  }

  constructor(private db: ShapeDatabaseLike) {}

  private async ensureOpen(): Promise<void> {
    await this.db.open?.();
  }

  async deleteBatchSession(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.batchSessions.delete?.(String(nodeId));
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
    await this.db.batchTasks.where('nodeId').equals(nodeId).delete?.();
    await this.db.batchSessions.where('nodeId').equals(nodeId).delete?.();
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
    const db = await TilesDB.getSingleton();
    await db.sourceMetadata.bulkPut(rows);
  }

  async deleteSourceMetadataByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await TilesDB.getSingleton();
    await db.sourceMetadata.bulkDelete(ids);
  }

  async deleteSourceMetadataByNode(nodeId: string): Promise<void> {
    const db = await TilesDB.getSingleton();
    await db.sourceMetadata.where('nodeId').equals(nodeId).delete();
  }

  async putFeatureMetadata(rows: ShapeFeatureMetadataRow[]): Promise<void> {
    if (rows.length === 0) return;
    const db = await TilesDB.getSingleton();
    await db.featureMetadata.bulkPut(rows);
  }

  async deleteFeatureMetadataByNode(nodeId: string): Promise<void> {
    const db = await TilesDB.getSingleton();
    await db.featureMetadata.where('nodeId').equals(nodeId).delete();
  }

  async syncVectorTilesFromTilesDb(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    const tilesDb = await TilesDB.getSingleton();
    const tiles = await tilesDb.tiles.where('nodeId').equals(String(nodeId)).toArray();
    if (tiles.length === 0) return;
    const records = await Promise.all(
      tiles
        .filter((row) => row.contentType === 'application/vnd.mapbox-vector-tile' && row.data)
        .map(async (row) => {
          const data = row.data instanceof Uint8Array ? row.data : new Uint8Array(row.data);
          const contentHash = await this.calculateTileHash(data);
          return {
            tileId: `${String(nodeId)}-${row.z}-${row.x}-${row.y}`,
            nodeId,
            z: row.z,
            x: row.x,
            y: row.y,
            data_Uint8Array: data,
            size: row.size,
            features: 0,
            layers: [],
            generatedAt: row.timestamp,
            contentHash,
            version: 1,
          };
        })
    );
    if (records.length > 0) {
      await this.db.vectorTiles.bulkPut?.(records);
    }
  }

  private async clearTileIndexArtifacts(nodeId: string): Promise<void> {
    try {
      const db = await TilesDB.getSingleton();
      await db.tiles.where('sessionId').equals(nodeId).delete();
      await db.featureMetadata.where('sessionId').equals(nodeId).delete();
    } catch (error) {
      console.warn('[ShapeMutationService] failed to clear TilesDB artifacts', error);
    }
  }

  private async calculateTileHash(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data as ArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
