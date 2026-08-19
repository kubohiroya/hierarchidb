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

const BUILD_STAGES = ['source', 'geometry', 'tileEmit'] as const;

const resolveRunningBuildStage = (value: unknown): BuildStage | undefined => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new Error('[ShapeMutationService] stages must be an object');
  }
  const runningStages = BUILD_STAGES.filter((stage) => {
    const candidate = value[stage];
    return isRecord(candidate) && candidate.status === 'running';
  });
  if (runningStages.length > 1) {
    throw new Error('[ShapeMutationService] only one build stage may be running');
  }
  return runningStages[0];
};

const requireFiniteNonNegativeTiming = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`[ShapeMutationService] ${label} must be a finite non-negative number`);
  }
  return value;
};

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
  const currentStage = resolveRunningBuildStage(session.stages);
  const startedAt = requireFiniteNonNegativeTiming(session.startedAt, 'startedAt');
  const inactiveMs =
    session.inactiveMs === undefined
      ? undefined
      : requireFiniteNonNegativeTiming(session.inactiveMs, 'inactiveMs');
  const completedAt =
    session.completedAt === undefined
      ? undefined
      : requireFiniteNonNegativeTiming(session.completedAt, 'completedAt');
  if (
    (session.status === 'completed' || session.status === 'failed') &&
    completedAt === undefined
  ) {
    throw new Error(
      `[ShapeMutationService] completedAt is required for terminal status ${session.status}`
    );
  }
  if (completedAt !== undefined && completedAt - startedAt - (inactiveMs ?? 0) < 0) {
    throw new Error('[ShapeMutationService] completed session interval must be non-negative');
  }

  return {
    config: {
      nodeId: session.nodeId,
      domainType: 'shape',
      selectedArrayByCountries: session.selectedArrayByCountries,
      selectedArrayVersion: undefined, // Not available in ShapeBuildSessionRecord
      startedAt,
      sourceStageMaxima: session.sourceStageMaxima,
    },
    heartbeat:
      session.lastHeartbeatAt !== undefined
        ? {
            nodeId: session.nodeId,
            lastHeartbeatAt: requireFiniteNonNegativeTiming(
              session.lastHeartbeatAt,
              'lastHeartbeatAt'
            ),
          }
        : undefined,
    status: {
      nodeId: session.nodeId,
      status: session.status,
      stopReason: session.stopReason,
      completedAt,
      inactiveMs,
      canResume: session.canResume,
    },
    stageStatus: currentStage
      ? {
          id: `${session.nodeId}:${currentStage}`,
          nodeId: session.nodeId,
          stage: currentStage,
          status: 'running',
          startedAt: requireFiniteNonNegativeTiming(session.stageStartedAt, 'stageStartedAt'),
          inactiveMs: requireFiniteNonNegativeTiming(session.stageInactiveMs, 'stageInactiveMs'),
          stageId: session.stageId,
        }
      : undefined,
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

    await ephemeralDB.transaction(
      'rw',
      [
        ephemeralDB.buildSessionConfigs,
        ephemeralDB.buildSessionHeartbeats,
        ephemeralDB.buildSessionStatuses,
        ephemeralDB.buildStageStatuses,
      ],
      async () => {
        await Promise.all([
          ephemeralDB.buildSessionConfigs.put(records.config),
          records.heartbeat
            ? ephemeralDB.buildSessionHeartbeats.put(records.heartbeat)
            : ephemeralDB.buildSessionHeartbeats.delete(session.nodeId),
          ephemeralDB.buildSessionStatuses.put(records.status),
          ephemeralDB.buildStageStatuses.where('nodeId').equals(session.nodeId).delete(),
        ]);
        if (records.stageStatus) {
          await ephemeralDB.buildStageStatuses.put(records.stageStatus);
        }
      }
    );

    publishBuildSessionUpdate({ nodeId: session.nodeId, status: session.status });
  }

  async updateBuildSession(
    nodeId: NodeId,
    updates: Partial<ShapeBuildSessionRecord>
  ): Promise<void> {
    await this.ensureOpen();
    await this.ensureEphemeralOpen();
    const heartbeatAt =
      updates.lastHeartbeatAt === undefined
        ? undefined
        : requireFiniteNonNegativeTiming(updates.lastHeartbeatAt, 'lastHeartbeatAt');
    const statusFields = [
      'status',
      'stopReason',
      'completedAt',
      'inactiveMs',
      'canResume',
    ] as const;
    const hasStatusUpdate = statusFields.some((field) => updates[field] !== undefined);
    const currentStage = resolveRunningBuildStage(updates.stages);
    const hasStageTimingUpdate =
      updates.stageStartedAt !== undefined || updates.stageInactiveMs !== undefined;
    if (hasStageTimingUpdate && currentStage === undefined) {
      throw new Error('[ShapeMutationService] active stage is required for stage timing updates');
    }
    await ephemeralDB.transaction(
      'rw',
      [
        ephemeralDB.buildSessionConfigs,
        ephemeralDB.buildSessionHeartbeats,
        ephemeralDB.buildSessionStatuses,
        ephemeralDB.buildStageStatuses,
      ],
      async () => {
        const currentConfig = await ephemeralDB.buildSessionConfigs.get(nodeId);
        if (!currentConfig) {
          throw new Error(
            `[ShapeMutationService] build session config is missing: ${String(nodeId)}`
          );
        }
        const currentStatus = await ephemeralDB.buildSessionStatuses.get(nodeId);
        if (!currentStatus) {
          throw new Error(
            `[ShapeMutationService] build session status is missing: ${String(nodeId)}`
          );
        }

        let nextStatus: BuildSessionStatus | undefined;
        if (hasStatusUpdate) {
          const status = updates.status ?? currentStatus.status;
          const nextInactiveMs = updates.inactiveMs ?? currentStatus.inactiveMs;
          const inactiveMs =
            nextInactiveMs === undefined
              ? undefined
              : requireFiniteNonNegativeTiming(nextInactiveMs, 'inactiveMs');
          const nextCompletedAt = updates.completedAt ?? currentStatus.completedAt;
          const completedAt =
            nextCompletedAt === undefined
              ? undefined
              : requireFiniteNonNegativeTiming(nextCompletedAt, 'completedAt');
          if ((status === 'completed' || status === 'failed') && completedAt === undefined) {
            throw new Error(
              `[ShapeMutationService] completedAt is required for terminal status ${status}`
            );
          }
          const startedAt = requireFiniteNonNegativeTiming(currentConfig.startedAt, 'startedAt');
          if (completedAt !== undefined && completedAt - startedAt - (inactiveMs ?? 0) < 0) {
            throw new Error(
              '[ShapeMutationService] completed session interval must be non-negative'
            );
          }
          nextStatus = {
            nodeId,
            status,
            stopReason: updates.stopReason ?? currentStatus.stopReason,
            completedAt,
            inactiveMs,
            canResume: updates.canResume ?? currentStatus.canResume,
          };
        }

        let nextStageStatus: BuildStageStatus | undefined;
        if (currentStage) {
          const stageId = `${nodeId}:${currentStage}`;
          const currentStageStatus = await ephemeralDB.buildStageStatuses.get(stageId);
          const isNewStageRun =
            updates.stageStartedAt !== undefined &&
            updates.stageStartedAt !== currentStageStatus?.startedAt;
          nextStageStatus = {
            id: stageId,
            nodeId,
            stage: currentStage,
            status: 'running',
            startedAt: requireFiniteNonNegativeTiming(
              updates.stageStartedAt ?? currentStageStatus?.startedAt,
              'stageStartedAt'
            ),
            inactiveMs: requireFiniteNonNegativeTiming(
              updates.stageInactiveMs ?? currentStageStatus?.inactiveMs,
              'stageInactiveMs'
            ),
            stageId: updates.stageId ?? currentStageStatus?.stageId,
            completedAt: isNewStageRun ? undefined : currentStageStatus?.completedAt,
          };
        }

        const writes: Promise<unknown>[] = [];
        if (heartbeatAt !== undefined) {
          writes.push(
            ephemeralDB.buildSessionHeartbeats.put({ nodeId, lastHeartbeatAt: heartbeatAt })
          );
        }
        if (nextStatus) {
          writes.push(ephemeralDB.buildSessionStatuses.put(nextStatus));
        }
        if (nextStageStatus) {
          writes.push(ephemeralDB.buildStageStatuses.put(nextStageStatus));
        }
        await Promise.all(writes);
      }
    );

    publishBuildSessionUpdate({ nodeId, status: updates.status });
  }

  async deleteBuildSession(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.ensureEphemeralOpen();

    // Delete from all four tables atomically
    await ephemeralDB.transaction(
      'rw',
      [
        ephemeralDB.buildSessionConfigs,
        ephemeralDB.buildSessionHeartbeats,
        ephemeralDB.buildSessionStatuses,
        ephemeralDB.buildStageStatuses,
      ],
      async () => {
        await Promise.all([
          ephemeralDB.buildSessionConfigs.delete(nodeId),
          ephemeralDB.buildSessionHeartbeats.delete(nodeId),
          ephemeralDB.buildSessionStatuses.delete(nodeId),
          ephemeralDB.buildStageStatuses.where('nodeId').equals(nodeId).delete(),
        ]);
      }
    );

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
