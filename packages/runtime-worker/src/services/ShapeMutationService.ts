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
  featureBuffers: DexieTable;
  tileBuffers: DexieTable;
  vectorTiles: DexieTable;
  cache: DexieTable;
  clearCache?: (nodeId?: NodeId, cacheType?: string) => Promise<number>;
};

export class ShapeMutationService implements ShapeMutationAPI {
  static async getSingleton(db: ShapeDatabaseLike): Promise<ShapeMutationService> {
    return SingletonMixin.getSingleton('ShapeMutationService', async () => new ShapeMutationService(db));
  }

  constructor(private db: ShapeDatabaseLike) {}

  private async ensureOpen(): Promise<void> {
    await this.db.open?.();
  }

  async deleteBatchSession(sessionId: string): Promise<void> {
    await this.ensureOpen();
    await this.db.batchSessions.delete?.(sessionId);
  }

  async deleteBatchTasks(sessionId: string): Promise<void> {
    await this.ensureOpen();
    await this.db.batchTasks.where('sessionId').equals(sessionId).delete?.();
  }

  async deleteVectorTiles(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.vectorTiles.where('nodeId').equals(nodeId).delete?.();
  }

  async deleteTileBuffers(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.tileBuffers.where('nodeId').equals(nodeId).delete?.();
  }

  async deleteFeatureBuffers(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.featureBuffers.where('nodeId').equals(nodeId).delete?.();
  }

  async deleteFeatures(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.features.where('nodeId').equals(nodeId).delete?.();
  }

  async clearCache(nodeId: NodeId): Promise<number> {
    await this.ensureOpen();
    if (this.db.clearCache) {
      return this.db.clearCache(nodeId);
    }
    const query = this.db.cache.where('nodeId').equals(nodeId);
    const count = (await query.count?.()) ?? 0;
    await query.delete?.();
    return count;
  }

  async cleanupProcessingData(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    const sessions = await this.db.batchSessions.where('nodeId').equals(nodeId).toArray?.() ?? [];
    const sessionIds = new Set<string>([String(nodeId)]);
    for (const session of sessions as Array<{ sessionId?: string }>) {
      const sessionId = session.sessionId;
      if (sessionId) {
        sessionIds.add(sessionId);
        await this.db.batchTasks.where('sessionId').equals(sessionId).delete?.();
      }
    }
    await this.db.batchSessions.where('nodeId').equals(nodeId).delete?.();
    await this.deleteFeatures(nodeId);
    await this.deleteFeatureBuffers(nodeId);
    await this.deleteTileBuffers(nodeId);
    await this.deleteVectorTiles(nodeId);
    await this.clearCache(nodeId);
    await this.clearTileIndexArtifacts(Array.from(sessionIds));
  }

  async clearShapeArtifacts(nodeId: NodeId): Promise<void> {
    await this.cleanupProcessingData(nodeId);
    const ephemeral = getEphemeralShapeDB();
    await ephemeral.clearNodeData(nodeId);
  }

  private async clearTileIndexArtifacts(sessionIds: string[]): Promise<void> {
    try {
      const db = await TilesDB.getSingleton();
      for (const sessionId of sessionIds) {
        const inputKey = `input:${sessionId}`;
        await db.tiles.where('sessionId').equals(sessionId).delete();
        await db.tiles.where('sessionId').equals(inputKey).delete();
        await db.featureMetadata.where('sessionId').equals(sessionId).delete();
      }
    } catch (error) {
      console.warn('[ShapeMutationService] failed to clear TilesDB artifacts', error);
    }
  }
}
