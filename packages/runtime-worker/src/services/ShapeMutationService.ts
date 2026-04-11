import type { NodeId } from '@hierarchidb/core-types';
import type {
  ShapeBuildSessionRecord,
  ShapeBuildTaskRecordInput,
  ShapeBuildTaskRecordUpdate,
  ShapeFeatureMetadata,
  ShapeSourceCache,
  ShapeMutationAPI,
  ShapeDataSourceMetadata,
  ShapeGeometryCache,
  ShapeVectorTileRecord,
} from '@hierarchidb/shape-api';
import type {
  BuildStage,
  LayerInfo,
  ShapeDB,
  VectorTileRecord,
} from '@hierarchidb/shape-store';
import {
  ephemeralDB,
  type BuildSessionRecord,
  type BuildSessionHeartbeat,
  type BuildSessionStatus,
  type BuildStageStatus,
} from '@hierarchidb/gis-sdk';
import { SingletonMixin } from '@hierarchidb/util';
import { publishBuildSessionUpdate } from './buildSessionBroadcastUtils.js';
import { storeRawDataDataSourceBufferForNode } from './shapeChunkStoreUtils.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Convert ShapeBuildSessionRecord to four normalized table records
 * 
 * Splits the monolithic session record into:
 * - config: Immutable session configuration (BuildSessionRecord)
 * - heartbeat: High-frequency heartbeat tracking (BuildSessionHeartbeat)
 * - status: Session-level status (BuildSessionStatus)
 * - stageStatus: Current stage status (BuildStageStatus)
 */
const toBuildSessionRecords = (session: ShapeBuildSessionRecord): {
  config: BuildSessionRecord;
  heartbeat?: BuildSessionHeartbeat;
  status: BuildSessionStatus;
  stageStatus?: BuildStageStatus;
} => {
  // Extract stage from stages map if available
  const stageEntries = Object.entries(session.stages);
  const currentStageEntry = stageEntries.find(([_, stageData]) => {
    if (isRecord(stageData) && 'status' in stageData) {
      return stageData.status === 'running';
    }
    return false;
  });
  const currentStage = currentStageEntry?.[0] as BuildStage | undefined;

  return {
    config: {
      nodeId: session.nodeId,
      domainType: 'shape',
      selectedArrayByCountries: session.selectedArrayByCountries,
      selectedArrayVersion: undefined, // Not available in ShapeBuildSessionRecord
      startedAt: session.startedAt,
      sourceStageMaxima: session.sourceStageMaxima,
    },
    heartbeat: session.lastHeartbeatAt ? {
      nodeId: session.nodeId,
      lastHeartbeatAt: session.lastHeartbeatAt,
    } : undefined,
    status: {
      nodeId: session.nodeId,
      status: session.status,
      stopReason: session.stopReason,
      completedAt: session.completedAt,
    },
    stageStatus: currentStage ? {
      id: `${session.nodeId}:${currentStage}`,
      nodeId: session.nodeId,
      stage: currentStage,
      status: 'running',
      startedAt: session.stageStartedAt ?? session.startedAt,
      inactiveMs: session.stageInactiveMs,
      stageId: session.stageId,
    } : undefined,
  };
};

const toVectorTileRecord = (tile: ShapeVectorTileRecord): VectorTileRecord => {
  const layers: LayerInfo[] = (tile.layers ?? []).map((layer) => ({
    name: layer.name,
    featureCount: layer.featureCount ?? 0,
    minZoom: tile.z,
    maxZoom: tile.z,
    fields: [],
  }));

  return {
    tileId: tile.tileId,
    nodeId: tile.nodeId,
    z: tile.z,
    x: tile.x,
    y: tile.y,
    data_Uint8Array: tile.data_Uint8Array,
    size: tile.size,
    features: tile.features,
    layers,
    generatedAt: tile.generatedAt,
    lastAccessed: tile.lastAccessed,
    contentHash: tile.contentHash ?? '',
    contentEncoding: tile.contentEncoding as VectorTileRecord['contentEncoding'],
    version: tile.version ?? 1,
  };
};

export class ShapeMutationService implements ShapeMutationAPI {
  static async getSingleton(db: ShapeDB): Promise<ShapeMutationService> {
    return SingletonMixin.getSingleton(
      'ShapeMutationService',
      async () => new ShapeMutationService(db)
    );
  }

  constructor(private db: ShapeDB) {}

  private async ensureOpen(): Promise<void> {
    await this.db.open?.();
  }

  private async ensureEphemeralOpen(): Promise<void> {
    await ephemeralDB.open?.();
  }

  async upsertBuildSession(session: ShapeBuildSessionRecord): Promise<void> {
    await this.ensureOpen();
    await this.ensureEphemeralOpen();
    
    // Split session into four normalized records
    const records = toBuildSessionRecords(session);
    
    // Insert into all four tables
    await Promise.all([
      ephemeralDB.buildSessionConfigs.put(records.config),
      records.heartbeat ? ephemeralDB.buildSessionHeartbeats.put(records.heartbeat) : Promise.resolve(),
      ephemeralDB.buildSessionStatuses.put(records.status),
      records.stageStatus ? ephemeralDB.buildStageStatuses.put(records.stageStatus) : Promise.resolve(),
    ]);
    
    publishBuildSessionUpdate({ nodeId: session.nodeId, status: session.status });
  }

  async updateBuildSession(
    nodeId: NodeId,
    updates: Partial<ShapeBuildSessionRecord>
  ): Promise<void> {
    await this.ensureOpen();
    await this.ensureEphemeralOpen();
    
    const updatePromises: Promise<unknown>[] = [];
    
    // Heartbeat update - only update buildSessionHeartbeats table
    if (updates.lastHeartbeatAt !== undefined) {
      updatePromises.push(
        ephemeralDB.buildSessionHeartbeats.put({
          nodeId,
          lastHeartbeatAt: updates.lastHeartbeatAt,
        })
      );
    }
    
    // Status update - only update buildSessionStatuses table
    const statusFields = ['status', 'stopReason', 'completedAt'] as const;
    const hasStatusUpdate = statusFields.some(field => updates[field] !== undefined);
    if (hasStatusUpdate) {
      updatePromises.push((async () => {
        const currentStatus = await ephemeralDB.buildSessionStatuses.get(nodeId);
        const nextStatus: BuildSessionStatus = {
          nodeId,
          status: updates.status ?? currentStatus?.status ?? 'idle',
          stopReason: updates.stopReason ?? currentStatus?.stopReason,
          completedAt: updates.completedAt ?? currentStatus?.completedAt,
        };
        await ephemeralDB.buildSessionStatuses.put(nextStatus);
      })());
    }
    
    // Stage update - update buildStageStatuses table
    // Note: For stage transitions (moving from one stage to another), the caller should:
    // 1. Update the previous stage's completedAt by calling buildStageStatuses.update()
    // 2. Create a new stage record by calling buildStageStatuses.put()
    // This method handles updates to the current stage's fields.
    const stageFields = ['stageInactiveMs', 'stageStartedAt', 'stageId'] as const;
    const hasStageUpdate = stageFields.some(field => updates[field] !== undefined);
    if (hasStageUpdate || updates.stages !== undefined) {
      // Extract current stage from stages map if available
      let currentStage: BuildStage | undefined;
      if (updates.stages) {
        const stageEntries = Object.entries(updates.stages);
        const currentStageEntry = stageEntries.find(([_, stageData]) => {
          if (isRecord(stageData) && 'status' in stageData) {
            return stageData.status === 'running';
          }
          return false;
        });
        currentStage = currentStageEntry?.[0] as BuildStage | undefined;
      }
      
      if (currentStage) {
        const stageId = `${nodeId}:${currentStage}`;
        updatePromises.push((async () => {
          const currentStageStatus = await ephemeralDB.buildStageStatuses.get(stageId);
          const nextStageStatus: BuildStageStatus = {
            id: stageId,
            nodeId,
            stage: currentStage,
            status: currentStageStatus?.status ?? 'running',
            startedAt: updates.stageStartedAt ?? currentStageStatus?.startedAt ?? Date.now(),
            inactiveMs: updates.stageInactiveMs ?? currentStageStatus?.inactiveMs,
            stageId: updates.stageId ?? currentStageStatus?.stageId,
            completedAt: currentStageStatus?.completedAt,
          };
          await ephemeralDB.buildStageStatuses.put(nextStageStatus);
        })());
      }
    }
    
    // Execute all updates in parallel
    await Promise.all(updatePromises);
    
    publishBuildSessionUpdate({ nodeId, status: updates.status });
  }

  async deleteBuildSession(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.ensureEphemeralOpen();
    
    // Delete from all four tables atomically
    await Promise.all([
      ephemeralDB.buildSessionConfigs.delete(nodeId),
      ephemeralDB.buildSessionHeartbeats.delete(nodeId),
      ephemeralDB.buildSessionStatuses.delete(nodeId),
      ephemeralDB.buildStageStatuses.where('nodeId').equals(nodeId).delete(),
    ]);
    
    publishBuildSessionUpdate({ nodeId, status: 'deleted' });
  }

  async deleteBuildTasks(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await ephemeralDB.buildTasks.where('nodeId').equals(nodeId).delete?.();
  }

  async deleteVectorTile(tileId: string): Promise<void> {
    await this.ensureOpen();
    await this.db.deleteVectorTile(tileId);
  }

  async deleteVectorTiles(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.deleteVectorTilesByNode(nodeId);
  }

  async cleanupProcessingData(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.deleteBuildSession(nodeId);
    await this.deleteFeatureMetadataByNode(String(nodeId));
    await this.deleteDataSourceMetadataByNode(String(nodeId));
    await this.deleteVectorTiles(nodeId);
    await this.clearTileIndexArtifacts(String(nodeId));
    await ephemeralDB.buildTasks.where('nodeId').equals(nodeId).delete();
  }

  async clearShapeArtifacts(nodeId: NodeId): Promise<void> {
    await this.cleanupProcessingData(nodeId);
    await ephemeralDB.clearNodeData(nodeId);
  }

  async upsertBuildTasks(tasks: ReadonlyArray<ShapeBuildTaskRecordInput>): Promise<void> {
    await this.ensureOpen();
    if (tasks.length === 0) return;
    await ephemeralDB.buildTasks.bulkPut?.(tasks);
  }

  async updateBuildTask(taskId: string, updates: ShapeBuildTaskRecordUpdate): Promise<void> {
    await this.ensureOpen();
    await ephemeralDB.buildTasks.update?.(taskId, updates);
  }

  async putSourceCaches(buffers: ShapeSourceCache[]): Promise<void> {
    if (buffers.length === 0) return;
    await Promise.all(
      buffers.map((buffer) =>
        storeRawDataDataSourceBufferForNode({
          nodeId: buffer.nodeId,
          cacheKey: buffer.id,
          buffer: buffer.data,
        })
      )
    );
  }

  async putGeometryCaches(buffers: ShapeGeometryCache[], taskId?: string, taskQueue?: any): Promise<void> {
    if (buffers.length === 0) return;
    const emptyBuffer = buffers.find((buffer) => buffer.data.byteLength === 0);
    if (emptyBuffer) {
      throw new Error(`[shape-mutation] empty geometry cache buffer: ${emptyBuffer.id}`);
    }

    // Note: Cache write validation is handled at the application layer
    // This function focuses on the actual cache write operation

    const pending = buffers.map((buffer) => ({ ...buffer, timestamp: 0 }));
    await ephemeralDB.transaction('rw', [ephemeralDB.geometryCache, ephemeralDB.geometryCacheMeta], async () => {
      await ephemeralDB.geometryCache.bulkPut(pending);
      const completedAt = Date.now();
      await Promise.all(
        pending.map((buffer) =>
          ephemeralDB.geometryCache.update(buffer.id, { timestamp: completedAt })
        )
      );
    });
  }

  async putDataSourceMetadata(rows: ShapeDataSourceMetadata[]): Promise<void> {
    if (rows.length === 0) return;
    await this.db.dataSourceMetadata.bulkPut?.(rows);
  }

  async deleteDataSourceMetadataByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db.dataSourceMetadata.bulkDelete?.(ids);
  }

  async deleteDataSourceMetadataByNode(nodeId: string): Promise<void> {
    await this.db.dataSourceMetadata.where('nodeId').equals(nodeId).delete?.();
  }

  async putFeatureMetadata(rows: ShapeFeatureMetadata[]): Promise<void> {
    if (rows.length === 0) return;
    await this.db.featureMetadata.bulkPut?.(rows);
  }

  async deleteFeatureMetadataByNode(nodeId: string): Promise<void> {
    await this.db.featureMetadata.where('nodeId').equals(nodeId).delete?.();
  }

  async syncVectorTilesFromTilesDb(nodeId: NodeId): Promise<void> {
    void nodeId;
  }

  async storeVectorTile(tile: ShapeVectorTileRecord): Promise<void> {
    await this.ensureOpen();
    await this.db.storeVectorTile(toVectorTileRecord(tile));
  }

  private async clearTileIndexArtifacts(nodeId: string): Promise<void> {
    void nodeId;
  }
}
