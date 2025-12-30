import { SingletonMixin } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type { ShapeMutationAPI } from '@hierarchidb/plugin-service-api';
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

  private async clearTileIndexArtifacts(nodeId: string): Promise<void> {
    try {
      const db = await TilesDB.getSingleton();
      await db.tiles.where('sessionId').equals(nodeId).delete();
      await db.featureMetadata.where('sessionId').equals(nodeId).delete();
    } catch (error) {
      console.warn('[ShapeMutationService] failed to clear TilesDB artifacts', error);
    }
  }
}
