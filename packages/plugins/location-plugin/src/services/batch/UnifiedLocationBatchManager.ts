/**
 * Unified Batch Control Facade for Location Plugin
 * Provides standardized batch control API based on persisted session metadata
 */

import type { NodeId } from '@hierarchidb/common-type';
import type {
  BatchProgressCallback,
  BatchProgressEvent,
  BatchSessionId,
  BatchSessionStatus,
  IBatchSessionManager,
} from '@hierarchidb/runtime-shared-batch-processor';
import { isBatchControlAPIV2Enabled } from '@hierarchidb/runtime-shared-batch-processor';
import { LocationBatchSessionManager } from './BatchSessionManager.js';
import type { LocationPointInput, LocationTileSettings } from './SessionController.js';
import { getEphemeralLocationDB } from '../database/EphemeralLocationDB.js';
import { toBatchProgressEvent } from './ProgressAdapter.js';

export interface UnifiedLocationBatchConfig {
  concurrency?: number;
}

export interface LocationBatchData {
  points: LocationPointInput[];
  settings: LocationTileSettings;
}

export class UnifiedLocationBatchManager implements IBatchSessionManager {
  private manager: LocationBatchSessionManager;
  private getDb: () => ReturnType<typeof getEphemeralLocationDB>;

  private static readonly PENDING_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly VECTOR_TILE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(dbProvider: typeof getEphemeralLocationDB = getEphemeralLocationDB) {
    this.manager = new LocationBatchSessionManager();
    this.getDb = () => dbProvider();
  }

  /** @internal Test-only injection hook */
  setInternalManager(manager: LocationBatchSessionManager): void {
    this.manager = manager;
  }

  /** @internal Test-only injection hook */
  setDbProvider(provider: () => ReturnType<typeof getEphemeralLocationDB>): void {
    this.getDb = provider;
  }

  async prepareSession(nodeId: NodeId, config: UnifiedLocationBatchConfig | undefined, data: LocationBatchData): Promise<void> {
    const db = this.getDb();
    try {
      await db.clearExpiredPendingSessions(UnifiedLocationBatchManager.PENDING_TTL);
    } catch (error) {
      console.warn('[UnifiedLocationBatchManager] failed to clear expired pending sessions', error);
    }
    await db.pendingSessions.put({
      nodeId,
      points: data.points,
      settings: data.settings,
      config,
      storedAt: Date.now(),
    });
  }

  async startBatchSession(nodeId: NodeId): Promise<BatchSessionId> {
    const db = this.getDb();
    const pending = await db.pendingSessions.get(nodeId);
    if (!pending) {
      throw new Error(`No pending location batch session for node ${nodeId}`);
    }
    await db.pendingSessions.delete(nodeId);

    const points = pending.points as LocationPointInput[] | undefined;
    const settings = pending.settings as LocationTileSettings | undefined;
    const config = pending.config as UnifiedLocationBatchConfig | undefined;
    if (!points || !settings) {
      throw new Error('Location batch session requires points and settings');
    }

    const summary = await this.manager.createSession(nodeId, points, settings, { concurrency: config?.concurrency });
    try {
      await db.clearVectorTilesForSession(summary.sessionId);
      await db.clearExpiredVectorTiles(UnifiedLocationBatchManager.VECTOR_TILE_TTL);
    } catch (error) {
      console.warn('[UnifiedLocationBatchManager] failed to tidy vector tiles', error);
    }
    await db.sessions?.put({
      sessionId: summary.sessionId,
      nodeId,
      bbox: summary.bbox,
      zoomMin: summary.zoomMin,
      zoomMax: summary.zoomMax,
      totalPoints: summary.totalPoints,
      createdAt: Date.now(),
      status: 'running',
      config,
    });
    return summary.sessionId;
  }

  async pauseBatchSession(sessionId: BatchSessionId): Promise<void> {
    this.manager.pause(sessionId);
    try {
      const db = this.getDb();
      await db.sessions?.update(sessionId, {
        status: 'paused',
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.warn('[UnifiedLocationBatchManager] failed to mark session paused', error);
    }
  }

  async resumeBatchSession(sessionId: BatchSessionId): Promise<void> {
    this.manager.resume(sessionId);
    try {
      const db = this.getDb();
      await db.sessions?.update(sessionId, {
        status: 'running',
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.warn('[UnifiedLocationBatchManager] failed to mark session running', error);
    }
  }

  async cancelBatchSession(sessionId: BatchSessionId): Promise<void> {
    this.manager.cancel(sessionId);
    try {
      const db = this.getDb();
      await db.sessions?.update(sessionId, {
        status: 'cancelled',
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.warn('[UnifiedLocationBatchManager] failed to mark session cancelled', error);
    }
  }

  async getBatchSessionStatus(sessionId: BatchSessionId): Promise<BatchSessionStatus> {
    const summary = this.manager.getInitialSummary(sessionId);
    if (!summary) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return {
      sessionId: summary.sessionId,
      nodeId: summary.nodeId,
      status: 'running',
      progress: {
        total: summary.totalPoints,
        completed: 0,
        failed: 0,
        percentage: 0,
        currentStage: 'download',
      },
      startedAt: Date.now(),
    };
  }

  onBatchProgress(sessionId: BatchSessionId, callback: BatchProgressCallback): () => void {
    return this.manager.onProgress(sessionId, (legacy) => {
      const summary = this.manager.getInitialSummary(sessionId);
      const event: BatchProgressEvent = toBatchProgressEvent({
        sessionId: legacy.sessionId,
        nodeId: summary?.nodeId,
        stage: legacy.stage,
        total: legacy.total,
        completed: legacy.completed,
        failed: legacy.failed,
        percentage: legacy.percentage,
        currentTask: legacy.currentTask,
      });
      callback(event);
      void (async () => {
        const db = this.getDb();
        await db.sessions?.update(sessionId, {
          progress: event.payload?.completed,
          updatedAt: Date.now(),
          status: event.phase === 'completed' ? 'completed' : 'running',
        });
      })();
    });
  }
}

export function createLocationBatchManager(): IBatchSessionManager {
  return new UnifiedLocationBatchManager();
}

export function isLocationBatchAPIV2Enabled(): boolean {
  return isBatchControlAPIV2Enabled();
}
