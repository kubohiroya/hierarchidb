/**
 * Unified Batch Control Facade for Location Plugin
 * Provides standardized batch control API based on persisted session metadata
 */

import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import {
  isBatchControlAPIV2Enabled,
  type BatchProgressCallback,
  type BatchProgressEvent,
  type BatchSessionStatus,
  type IBatchSessionManager,
} from '@hierarchidb/common-api';
import { UnifiedBatchManagerBase, type BatchPersistence, type UnifiedBatchSession } from '@hierarchidb/batch';
import { LocationBatchSessionManager } from './BatchSessionManager.js';
import { getLocationDB, type LocationDB } from '../../database/EphemeralLocationDB.js';
import { toBatchProgressEvent } from './ProgressAdapter.js';
import type { LocationBatchData } from '../../common/types/batch-types.js';
import type { UnifiedLocationBatchConfig } from '../../common/types/BatchConfig.js';

const PENDING_TTL = 24 * 60 * 60 * 1000; // 24 hours
const VECTOR_TILE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

type LocationBatchSessionPayload = UnifiedBatchSession<UnifiedLocationBatchConfig | undefined, LocationBatchData>;

function createPersistence(
  dbProvider: typeof getLocationDB,
): BatchPersistence<UnifiedLocationBatchConfig | undefined, LocationBatchData> {
  return {
    async savePending(nodeId: NodeId, payload: LocationBatchSessionPayload) {
      const db = dbProvider();
      try {
        await db.clearExpiredPendingSessions(PENDING_TTL);
      } catch (error) {
        console.warn('[UnifiedLocationBatchManager] failed to clear expired pending sessions', error);
      }
      await db.pendingSessions.put({
        nodeId,
        points: payload.data.points,
        settings: payload.data.settings,
        config: payload.config,
        storedAt: payload.storedAt,
      });
    },
    async takePending(nodeId: NodeId) {
      const db = dbProvider();
      const record = await db.pendingSessions.get(nodeId);
      if (!record) return undefined;
      await db.pendingSessions.delete(nodeId);
      return {
        config: record.config,
        data: {
          points: record.points,
          settings: record.settings,
        },
        storedAt: record.storedAt as Timestamp,
      } satisfies LocationBatchSessionPayload;
    },
    async onSessionProgress(_nodeId: NodeId, _event: BatchProgressEvent) {
    },
    async onSessionCompleted(nodeId: NodeId) {
      const db = dbProvider();
      await db.clearVectorTilesForNode(nodeId);
    },
  };
}

export class UnifiedLocationBatchManager extends UnifiedBatchManagerBase<UnifiedLocationBatchConfig | undefined, LocationBatchData> {
  private manager: LocationBatchSessionManager;
  private getDb: () => LocationDB;

  constructor(dbProvider: typeof getLocationDB = getLocationDB) {
    super(createPersistence(dbProvider));
    this.manager = new LocationBatchSessionManager();
    this.getDb = () => dbProvider();
  }

  /** @internal Test-only injection hook */
  setInternalManager(manager: LocationBatchSessionManager): void {
    this.manager = manager;
  }

  /** @internal Test-only injection hook */
  setDbProvider(provider: () => LocationDB): void {
    const self = this as unknown as {
      persistence?: BatchPersistence<UnifiedLocationBatchConfig | undefined, LocationBatchData>;
    };
    self.persistence = createPersistence(provider);
    this.getDb = provider;
  }

  protected async performStart(nodeId: NodeId, config: UnifiedLocationBatchConfig | undefined, data: LocationBatchData): Promise<BatchSessionStatus> {
    const summary = await this.manager.createSession(nodeId, data.points, data.settings, { concurrency: config?.concurrency });
    try {
      const db = this.getDb();
      await db.clearVectorTilesForNode(nodeId);
      await db.clearExpiredVectorTiles(VECTOR_TILE_TTL);
    } catch (error) {
      console.warn('[UnifiedLocationBatchManager] failed to clear vector tiles', error);
    }
    return {
      nodeId,
      status: 'running',
      progress: {
        total: summary.totalPoints ?? data.points.length,
        completed: 0,
        failed: 0,
        percentage: 0,
      },
      startedAt: Date.now(),
      lastActivity: Date.now(),
    };
  }

  protected async performPause(nodeId: NodeId): Promise<void> {
    this.manager.pause(nodeId);
  }

  protected async performResume(nodeId: NodeId): Promise<void> {
    this.manager.resume(nodeId);
  }

  protected async performStatus(nodeId: NodeId): Promise<BatchSessionStatus> {
    const summary = this.manager.getInitialSummary(nodeId);
    if (!summary) {
      throw new Error(`Session ${nodeId} not found`);
    }
    return {
      nodeId: summary.nodeId,
      status: 'running',
      progress: {
        total: summary.totalPoints ?? 0,
        completed: 0,
        failed: 0,
        percentage: 0,
      },
      startedAt: Date.now(),
      lastActivity: Date.now(),
    };
  }

  protected performSubscribe(nodeId: NodeId, callback: BatchProgressCallback): () => void {
    return this.manager.onProgress(nodeId, (legacy) => {
      const summary = this.manager.getInitialSummary(nodeId);
      const event = toBatchProgressEvent({
        nodeId: summary?.nodeId ?? legacy.nodeId,
        stage: legacy.taskType,
        total: legacy.total,
        completed: legacy.completed,
        failed: legacy.failed,
        percentage: legacy.percentage,
        message: legacy.message,
      });
      callback(event);
    });
  }
}

export function createLocationBatchManager(): IBatchSessionManager {
  return new UnifiedLocationBatchManager();
}

export function isLocationBatchAPIV2Enabled(): boolean {
  return isBatchControlAPIV2Enabled();
}
