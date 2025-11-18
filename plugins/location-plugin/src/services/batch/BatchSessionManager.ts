/**
 * BatchSessionManager for Location plugin
 */

import type { NodeId, ProgressEvent } from '@hierarchidb/common-types';
import { LocationSessionController } from './LocationSessionController.js';
import type { LocationPointInput, LocationTileSettings, SessionSummary } from './types.js';
import { LocationBatchSession } from './LocationBatchSession.js';
import { isDevEnvironment } from '../../common/utils/env.js';

export class LocationBatchSessionManager {
  private shared = new Map<string, LocationBatchSession>();
  private progress = new Map<string, Set<(p: ProgressEvent) => void>>();
  private summaries = new Map<string, SessionSummary>();

  private static readonly SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  private static readonly PENDING_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly VECTOR_TILE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  async createSession(
    nodeId: NodeId,
    points: LocationPointInput[],
    settings: LocationTileSettings,
    options?: { concurrency?: number },
  ): Promise<SessionSummary> {
    const sessionId = `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const controller = new LocationSessionController(sessionId, nodeId, points, settings);
    const bbox = computeBbox(points);
    const summary: SessionSummary = {
      sessionId,
      nodeId,
      zoomMin: settings.zoomMinGenerate,
      zoomMax: settings.zoomMaxGenerate,
      zoomMaxServe: settings.zoomMaxServe,
      bbox,
      totalPoints: points.length,
      layers: ['location_points'],
    };
    this.summaries.set(sessionId, summary);
    // Persist session meta (best-effort)
    try {
      const { getEphemeralLocationDB } = await import('../database/EphemeralLocationDB.js');
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
        sessionId,
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
    const shared = new LocationBatchSession(sessionId, nodeId, { concurrency: options?.concurrency ?? 4 }, controller, (ev) => {
      const set2 = this.progress.get(sessionId);
      if (!set2) return;
      for (const cb of set2) cb(ev);
    });
    this.shared.set(sessionId, shared);

    shared.start().then(async () => {
      try {
        const { getEphemeralLocationDB } = await import('../database/EphemeralLocationDB.js');
        const db = getEphemeralLocationDB();
        await db.sessions?.update(sessionId, { status: 'completed' });
      } catch (error) {
        if (isDevEnvironment) {
          console.warn('[LocationBatchSessionManager] failed to mark session completed', error);
        }
      }
    }).catch(async (e: any) => {
      console.error('Location session failed', e);
      try {
        const { getEphemeralLocationDB } = await import('../database/EphemeralLocationDB.js');
        const db = getEphemeralLocationDB();
        await db.sessions?.update(sessionId, { status: 'failed' });
      } catch (error) {
        if (isDevEnvironment) {
          console.warn('[LocationBatchSessionManager] failed to mark session failed', error);
        }
      }
    });
    return summary;
  }

  onProgress(sessionId: string, cb: (p: ProgressEvent) => void): () => void {
    let set = this.progress.get(sessionId);
    if (!set) {
      set = new Set();
      this.progress.set(sessionId, set);
    }
    set.add(cb);
    //  late subscriber
    return () => {
      const s = this.progress.get(sessionId);
      if (!s) return;
      s.delete(cb);
      if (s.size === 0) this.progress.delete(sessionId);
    };
  }

  getInitialSummary(sessionId: string): SessionSummary | undefined {
    return this.summaries.get(sessionId);
  }

  // Control APIs
  pause(sessionId: string) {
    this.shared.get(sessionId)?.pause();
  }

  resume(sessionId: string) {
    this.shared.get(sessionId)?.resume();
  }

  cancel(sessionId: string) {
    this.shared.get(sessionId)?.cancel();
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
  if (!isFinite(minLon)) return [0, 0, 0, 0];
  return [minLon, minLat, maxLon, maxLat];
}
