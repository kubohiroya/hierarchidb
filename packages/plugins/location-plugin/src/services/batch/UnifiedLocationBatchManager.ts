/**
 * Unified Batch Control Facade for Location Plugin
 * Provides standardized batch control API based on persisted session metadata
 */

import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import type {
  BatchProgressCallback,
  BatchProgressEvent,
  BatchSessionId,
  BatchSessionStatus,
  IBatchSessionManager,
} from '@hierarchidb/batch-api';
import { isBatchControlAPIV2Enabled } from '@hierarchidb/batch-api';
import { UnifiedBatchManagerBase, type BatchPersistence, type UnifiedBatchSession } from '@hierarchidb/plugin-api';
import { LocationBatchSessionManager } from './BatchSessionManager.js';
import type { LocationPointInput, LocationTileSettings } from './LocationSessionController.js';
import { getEphemeralLocationDB, type EphemeralLocationDB } from '../database/EphemeralLocationDB.js';
import { toBatchProgressEvent } from './ProgressAdapter.js';

export interface UnifiedLocationBatchConfig {
  concurrency?: number;
}

export interface LocationBatchData {
  points: LocationPointInput[];
  settings: LocationTileSettings;
}

const PENDING_TTL = 24 * 60 * 60 * 1000; // 24 hours
const VECTOR_TILE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

type LocationBatchSessionPayload = UnifiedBatchSession<UnifiedLocationBatchConfig | undefined, LocationBatchData>;

function createPersistence(
  dbProvider: typeof getEphemeralLocationDB,
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
        config: record.config as UnifiedLocationBatchConfig | undefined,
        data: {
          points: record.points as LocationPointInput[],
          settings: record.settings as LocationTileSettings,
        },
        storedAt: record.storedAt as Timestamp,
      } satisfies LocationBatchSessionPayload;
    },
    async onSessionProgress(sessionId: BatchSessionId, event: BatchProgressEvent) {
      const db = dbProvider();
      await db.sessions?.update(sessionId, {
        progress: event.payload?.completed,
        updatedAt: event.timestamp,
        status: event.phase === 'completed' ? 'completed' : event.phase === 'failed' ? 'failed' : 'running',
      });
    },
    async onSessionCompleted(sessionId: BatchSessionId) {
      const db = dbProvider();
      await db.clearVectorTilesForSession(sessionId);
    },
  };
}

export class UnifiedLocationBatchManager extends UnifiedBatchManagerBase<UnifiedLocationBatchConfig | undefined, LocationBatchData> {
  private manager: LocationBatchSessionManager;
  private getDb: () => EphemeralLocationDB;

  constructor(dbProvider: typeof getEphemeralLocationDB = getEphemeralLocationDB) {
    super(createPersistence(dbProvider));
    this.manager = new LocationBatchSessionManager();
    this.getDb = () => dbProvider();
  }

  /** @internal Test-only injection hook */
  setInternalManager(manager: LocationBatchSessionManager): void {
    this.manager = manager;
  }

  /** @internal Test-only injection hook */
  setDbProvider(provider: () => EphemeralLocationDB): void {
    const self = this as unknown as {
      persistence?: BatchPersistence<UnifiedLocationBatchConfig | undefined, LocationBatchData>;
    };
    self.persistence = createPersistence(provider);
    this.getDb = provider;
  }

  protected async performStart(nodeId: NodeId, config: UnifiedLocationBatchConfig | undefined, data: LocationBatchData): Promise<BatchSessionId> {
    const summary = await this.manager.createSession(nodeId, data.points, data.settings, { concurrency: config?.concurrency });
    try {
      const db = this.getDb();
      await db.clearVectorTilesForSession(summary.sessionId);
      await db.clearExpiredVectorTiles(VECTOR_TILE_TTL);
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
    } catch (error) {
      console.warn('[UnifiedLocationBatchManager] failed to persist session metadata', error);
    }
    return summary.sessionId;
  }

  protected async performPause(sessionId: BatchSessionId): Promise<void> {
    this.manager.pause(sessionId);
    try {
      const db = this.getDb();
      await db.sessions?.update(sessionId, { status: 'paused', updatedAt: Date.now() });
    } catch (error) {
      console.warn('[UnifiedLocationBatchManager] failed to mark session paused', error);
    }
  }

  protected async performResume(sessionId: BatchSessionId): Promise<void> {
    this.manager.resume(sessionId);
    try {
      const db = this.getDb();
      await db.sessions?.update(sessionId, { status: 'running', updatedAt: Date.now() });
    } catch (error) {
      console.warn('[UnifiedLocationBatchManager] failed to mark session running', error);
    }
  }

  protected async performCancel(sessionId: BatchSessionId): Promise<void> {
    this.manager.cancel(sessionId);
    try {
      const db = this.getDb();
      await db.sessions?.update(sessionId, { status: 'cancelled', updatedAt: Date.now() });
      await db.clearVectorTilesForSession(sessionId);
    } catch (error) {
      console.warn('[UnifiedLocationBatchManager] failed to mark session cancelled', error);
    }
  }

  protected async performStatus(sessionId: BatchSessionId): Promise<BatchSessionStatus> {
    const db = this.getDb();
    const record = await db.sessions?.get(sessionId);
    const summary = this.manager.getInitialSummary(sessionId);
    if (!record && !summary) {
      throw new Error(`Session ${sessionId} not found`);
    }
    const total = record?.totalPoints ?? summary?.totalPoints ?? 0;
    const completed = (record?.progress as number | undefined) ?? 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const status = record?.status ?? (percentage >= 100 ? 'completed' : 'running');
    return {
      sessionId,
      nodeId: record?.nodeId ?? summary?.nodeId ?? ('' as NodeId),
      status,
      progress: {
        total,
        completed,
        failed: 0,
        percentage,
        currentStage: percentage >= 100 ? 'vectortile' : 'download',
      },
      startedAt: record?.createdAt,
      lastActivity: record?.updatedAt,
    };
  }

  protected performSubscribe(sessionId: BatchSessionId, callback: BatchProgressCallback): () => void {
    return this.manager.onProgress(sessionId, (legacy) => {
      const summary = this.manager.getInitialSummary(sessionId);
      const event = toBatchProgressEvent({
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
    });
  }
}

export function createLocationBatchManager(): IBatchSessionManager {
  return new UnifiedLocationBatchManager();
}

export function isLocationBatchAPIV2Enabled(): boolean {
  return isBatchControlAPIV2Enabled();
}
