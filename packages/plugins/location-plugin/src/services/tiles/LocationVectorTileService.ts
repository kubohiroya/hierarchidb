import type { NodeId, ProgressEvent } from '@hierarchidb/common-type';
import { getEphemeralLocationDB } from '../database/EphemeralLocationDB.js';
import { LocationBatchSessionManager } from '../batch/BatchSessionManager.js';
import type { LocationPointInput, LocationTileSettings, SessionSummary, ProgressInfo } from '../batch/SessionController.js';

export class LocationVectorTileService {
  private manager = new LocationBatchSessionManager();

  async startSession(nodeId: NodeId, points: LocationPointInput[], settings: LocationTileSettings): Promise<{
    sessionId: string
  } & SessionSummary> {
    return this.manager.createSession(nodeId, points, settings);
  }

  onProgress(sessionId: string, cb: (p: ProgressEvent) => void): () => void {
    return this.manager.onProgress(sessionId, cb);
  }

  async getVectorTile(sessionId: string, nodeId: NodeId, z: number, x: number, y: number): Promise<Uint8Array | null> {
    const db = getEphemeralLocationDB();
    const id = `loc-mvt-${sessionId}-${z}-${x}-${y}`;
    const rec = await db.vectorTiles.get(id);
    if (!rec || rec.nodeId !== nodeId) return null;
    return new Uint8Array(rec.data);
  }

  async getSessionSummary(sessionId: string): Promise<{
    exists: boolean;
    layers: string[];
    zoomRange?: [number, number];
    tiles: number;
    sizeBytes: number;
    bbox?: [number, number, number, number];
  }> {
    const db = getEphemeralLocationDB();
    const list = await db.vectorTiles.where('sessionId').equals(sessionId).toArray();
    if (list.length === 0) return { exists: false, layers: [], tiles: 0, sizeBytes: 0 };
    const zmin = Math.min(...list.map(r => r.z));
    const zmax = Math.max(...list.map(r => r.z));
    const size = list.reduce((s, r) => s + r.size, 0);
    // Approximate bbox from tile ranges
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    for (const r of list) {
      const west = tile2lon(r.x, r.z);
      const east = tile2lon(r.x + 1, r.z);
      const north = tile2lat(r.y, r.z);
      const south = tile2lat(r.y + 1, r.z);
      if (west < minLon) minLon = west;
      if (south < minLat) minLat = south;
      if (east > maxLon) maxLon = east;
      if (north > maxLat) maxLat = north;
    }
    const bbox: [number, number, number, number] = [minLon, minLat, maxLon, maxLat];
    return {
      exists: true,
      layers: ['location_points'],
      zoomRange: [zmin, zmax],
      tiles: list.length,
      sizeBytes: size,
      bbox,
    };
  }

  getInitialSummary(sessionId: string) {
    return this.manager.getInitialSummary(sessionId);
  }

  async listTileCoords(sessionId: string): Promise<Array<{ z: number; x: number; y: number }>> {
    const db = getEphemeralLocationDB();
    const list = await db.vectorTiles.where('sessionId').equals(sessionId).toArray();
    return list.map(r => ({ z: r.z, x: r.x, y: r.y }));
  }
}

export class LocationVectorTileControl {
  constructor(private readonly mgr: LocationBatchSessionManager) {
  }

  pause(sessionId: string) {
    this.mgr.pause(sessionId);
  }

  resume(sessionId: string) {
    this.mgr.resume(sessionId);
  }

  cancel(sessionId: string) {
    this.mgr.cancel(sessionId);
  }
}

function tile2lon(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}

function tile2lat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export type { LocationPointInput, LocationTileSettings, ProgressInfo };
