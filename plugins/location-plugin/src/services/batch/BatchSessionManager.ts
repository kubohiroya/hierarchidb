/**
 * BatchSessionManager for Location plugin
 */

import type { NodeId, ProgressEvent } from '@hierarchidb/common-types';
import { BaseBatchSessionManager } from '@hierarchidb/batch-runtime-services';
import type { BatchProgressEvent, BatchSessionStatus } from '@hierarchidb/common-api';
import { LocationSessionController } from './LocationSessionController.js';
import type { LocationPointInput, LocationTileSettings, SessionSummary } from '../../common/types/batch-types.js';
import { LocationBatchSession } from './LocationBatchSession.js';
import { isDevEnvironment } from '../../common/utils/env.js';

export class LocationBatchSessionManager extends BaseBatchSessionManager {
  private legacyProgress = new Map<NodeId, Set<(p: ProgressEvent) => void>>();
  private summaries = new Map<NodeId, SessionSummary>();

  private static readonly SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  private static readonly PENDING_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly VECTOR_TILE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor() {
    super();
  }

  async startBatchSession(_nodeId: NodeId): Promise<BatchSessionStatus> {
    throw new Error('LocationBatchSessionManager requires createSession to start.');
  }

  async createSession(
    nodeId: NodeId,
    points: LocationPointInput[],
    settings: LocationTileSettings,
    options?: { concurrency?: number },
  ): Promise<SessionSummary> {
    const controller = new LocationSessionController(nodeId, points, settings);
    const bbox = computeBbox(points);
    const summary: SessionSummary = {
      nodeId,
      zoomMin: settings.zoomMinGenerate,
      zoomMax: settings.zoomMaxGenerate,
      zoomMaxServe: settings.zoomMaxServe,
      bbox,
      totalPoints: points.length,
      layers: ['location_points'],
    };
    this.summaries.set(nodeId, summary);
    // Persist session meta (best-effort)
    try {
      const { getEphemeralLocationDB } = await import('../../database/EphemeralLocationDB.js');
      const db = getEphemeralLocationDB();
      try {
        await db.clearExpiredSessions(LocationBatchSessionManager.SESSION_TTL);
        await db.clearExpiredPendingSessions(LocationBatchSessionManager.PENDING_TTL);
        await db.clearExpiredVectorTiles(LocationBatchSessionManager.VECTOR_TILE_TTL);
      } catch (error) {
        if (isDevEnvironment) {
          console.warn('[LocationBatchSessionManager] clearExpiredSessions failed', error);
        }
      }
      await db.sessions?.put({
        nodeId,
        bbox,
        zoomMin: summary.zoomMin,
        zoomMax: summary.zoomMax,
        totalPoints: points.length,
        createdAt: Date.now(),
        status: 'running',
      });
    } catch (error) {
      if (isDevEnvironment) {
        console.warn('[LocationBatchSessionManager] failed to persist session metadata', error);
      }
    }
    //  Fire and forget
    const shared = new LocationBatchSession(
      nodeId,
      { concurrency: options?.concurrency ?? 4 },
      controller,
      (ev) => this.emitLegacyProgress(nodeId, ev),
    );
    this.registerSession(shared);

    shared.start().catch((e) => {
      console.error('Location session failed', e);
    });
    return summary;
  }

  onProgress(nodeId: NodeId, cb: (p: ProgressEvent) => void): () => void {
    let set = this.legacyProgress.get(nodeId);
    if (!set) {
      set = new Set();
      this.legacyProgress.set(nodeId, set);
    }
    set.add(cb);
    //  late subscriber
    return () => {
      const s = this.legacyProgress.get(nodeId);
      if (!s) return;
      s.delete(cb);
      if (s.size === 0) this.legacyProgress.delete(nodeId);
    };
  }

  getInitialSummary(nodeId: NodeId): SessionSummary | undefined {
    return this.summaries.get(nodeId);
  }

  // Control APIs
  pause(nodeId: NodeId) {
    void this.pauseBatchSession(nodeId).catch((error) => {
      if (isDevEnvironment) {
        console.warn('[LocationBatchSessionManager] pause failed', error);
      }
    });
  }

  resume(nodeId: NodeId) {
    void this.resumeBatchSession(nodeId).catch((error) => {
      if (isDevEnvironment) {
        console.warn('[LocationBatchSessionManager] resume failed', error);
      }
    });
  }

  cancel(nodeId: NodeId) {
    void this.cancelBatchSession(nodeId).catch((error) => {
      if (isDevEnvironment) {
        console.warn('[LocationBatchSessionManager] cancel failed', error);
      }
    });
  }

  protected async onSessionProgress(session: LocationBatchSession, event: BatchProgressEvent): Promise<void> {
    const payload = event.payload ?? {};
    const total = payload.total ?? 0;
    const completed = payload.completed ?? 0;
    const failed = payload.failed ?? 0;
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    try {
      const { getEphemeralLocationDB } = await import('../../database/EphemeralLocationDB.js');
      const db = getEphemeralLocationDB();
      await db.sessions?.update(session.getState().nodeId, {
        progress: {
          total,
          completed,
          failed,
          percentage,
          currentStage: event.stage,
          currentTask: payload.currentTask,
        },
        updatedAt: event.timestamp,
      });
    } catch (error) {
      if (isDevEnvironment) {
        console.warn('[LocationBatchSessionManager] failed to persist progress', error);
      }
    }
  }

  protected async onSessionStatusChange(session: LocationBatchSession): Promise<void> {
    const state = session.getState();
    if (state.status === 'idle') {
      return;
    }
    try {
      const { getEphemeralLocationDB } = await import('../../database/EphemeralLocationDB.js');
      const db = getEphemeralLocationDB();
      await db.sessions?.update(state.nodeId, { status: state.status, updatedAt: Date.now() });
    } catch (error) {
      if (isDevEnvironment) {
        console.warn('[LocationBatchSessionManager] failed to persist status', error);
      }
    }
    if (state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled') {
      this.sessions.delete(state.nodeId);
      this.legacyProgress.delete(state.nodeId);
    }
  }

  private emitLegacyProgress(nodeId: NodeId, progress: ProgressEvent): void {
    const set = this.legacyProgress.get(nodeId);
    if (!set) return;
    for (const cb of set) cb(progress);
  }
}

function computeBbox(points: LocationPointInput[]): [number, number, number, number] {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const p of points) {
    if (p.lon < minLon) minLon = p.lon;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lon > maxLon) maxLon = p.lon;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  if (!Number.isFinite(minLon)) return [0, 0, 0, 0];
  return [minLon, minLat, maxLon, maxLat];
}
