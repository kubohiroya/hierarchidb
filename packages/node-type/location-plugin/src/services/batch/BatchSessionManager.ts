/**
 * BatchSessionManager for Location plugin
 */

import type { NodeId } from '@hierarchidb/common-type';
import { SessionController, type LocationPointInput, type LocationTileSettings, type ProgressInfo, type SessionSummary } from './SessionController';

export class LocationBatchSessionManager {
  private controllers = new Map<string, SessionController>();
  private progress = new Map<string, Set<(p: ProgressInfo) => void>>();
  private summaries = new Map<string, SessionSummary>();

  async createSession(
    nodeId: NodeId,
    points: LocationPointInput[],
    settings: LocationTileSettings,
  ): Promise<SessionSummary> {
    const sessionId = `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const controller = new SessionController(sessionId, nodeId, points, settings);
    this.controllers.set(sessionId, controller);
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
      const { getEphemeralLocationDB } = await import('../database/EphemeralLocationDB');
      const db = getEphemeralLocationDB();
      // Opportunistic cleanup (7 days)
      try { await db.clearExpiredSessions(7 * 24 * 60 * 60 * 1000); } catch {}
      // @ts-ignore
      await db.table('sessions').put({ sessionId, nodeId, bbox, zoomMin: summary.zoomMin, zoomMax: summary.zoomMax, totalPoints: points.length, createdAt: Date.now(), status: 'running' });
    } catch {}
    const set = this.progress.get(sessionId);
    if (set && set.size > 0) controller.setProgressCallback((ev) => {
      for (const cb of set) cb(ev);
    });
    // Fire and forget
    controller.start().then(async () => {
      try {
        const { getEphemeralLocationDB } = await import('../database/EphemeralLocationDB');
        const db = getEphemeralLocationDB();
        // @ts-ignore
        await db.table('sessions').update(sessionId, { status: 'completed' });
      } catch {}
    }).catch(async (e) => {
      console.error('Location session failed', e);
      try {
        const { getEphemeralLocationDB } = await import('../database/EphemeralLocationDB');
        const db = getEphemeralLocationDB();
        // @ts-ignore
        await db.table('sessions').update(sessionId, { status: 'failed' });
      } catch {}
    });
    return summary;
  }

  onProgress(sessionId: string, cb: (p: ProgressInfo) => void): () => void {
    let set = this.progress.get(sessionId);
    if (!set) {
      set = new Set();
      this.progress.set(sessionId, set);
    }
    set.add(cb);
    const ctl = this.controllers.get(sessionId);
    if (ctl) ctl.setProgressCallback((ev) => {
      const s = this.progress.get(sessionId);
      if (!s) return;
      for (const fn of s) fn(ev);
    });
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
  pause(sessionId: string) { this.controllers.get(sessionId)?.pause(); }
  resume(sessionId: string) { this.controllers.get(sessionId)?.resume(); }
  cancel(sessionId: string) { this.controllers.get(sessionId)?.cancel(); }
}

function computeBbox(points: LocationPointInput[]): [number, number, number, number] {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const p of points) {
    if (p.lon < minLon) minLon = p.lon;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lon > maxLon) maxLon = p.lon;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  if (!isFinite(minLon)) return [0,0,0,0];
  return [minLon, minLat, maxLon, maxLat];
}
