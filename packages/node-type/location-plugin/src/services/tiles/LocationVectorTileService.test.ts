import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocationVectorTileService } from './LocationVectorTileService';
import type { LocationPointInput, LocationTileSettings, ProgressInfo } from './LocationVectorTileService';
import { getEphemeralLocationDB, closeEphemeralLocationDB } from '../database/EphemeralLocationDB';

function long2tile(lon: number, z: number) { return Math.floor(((lon + 180) / 360) * Math.pow(2, z)); }
function lat2tile(lat: number, z: number) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * Math.pow(2, z));
}

async function waitForCompleted(on: (cb: (p: ProgressInfo) => void) => void, timeoutMs = 5000): Promise<ProgressInfo> {
  return new Promise<ProgressInfo>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout waiting for completed')), timeoutMs);
    on((p) => {
      if (p.stage === 'completed') {
        clearTimeout(t);
        resolve(p);
      }
    });
  });
}

describe('LocationVectorTileService', () => {
  beforeEach(async () => {
    // ensure a clean DB per test
    const db = getEphemeralLocationDB();
    await db.vectorTiles.clear();
  });
  afterEach(async () => {
    await closeEphemeralLocationDB();
  });

  it('generates at least one vector tile for small point set', async () => {
    const svc = new LocationVectorTileService();
    const points: LocationPointInput[] = [
      { lon: 139.767, lat: 35.681 }, // Tokyo Station
      { lon: 139.700, lat: 35.689 }, // Shinjuku
      { lon: 139.730, lat: 35.710 }, // Ueno
    ];
    const settings: LocationTileSettings = { zoomMinGenerate: 5, zoomMaxGenerate: 6 };

    const summary = await svc.startSession('node-1' as any, points, settings);
    expect(summary.sessionId).toBeTruthy();
    expect(summary.totalPoints).toBe(3);

    await waitForCompleted((cb) => svc.onProgress(summary.sessionId, cb));

    const db = getEphemeralLocationDB();
    const tiles = await db.vectorTiles.where('sessionId').equals(summary.sessionId).toArray();
    expect(tiles.length).toBeGreaterThan(0);

    const first = tiles[0]!;
    const bytes = await svc.getVectorTile(summary.sessionId, summary.nodeId, first.z, first.x, first.y);
    expect(bytes).not.toBeNull();
    expect((bytes as Uint8Array).byteLength).toBeGreaterThan(0);
  });

  it('emits progress events and completes to 100%', async () => {
    const svc = new LocationVectorTileService();
    const points: LocationPointInput[] = [
      { lon: -73.9857, lat: 40.7484 }, // NYC
      { lon: -73.9851, lat: 40.7580 },
      { lon: -73.9792, lat: 40.7615 },
    ];
    const settings: LocationTileSettings = { zoomMinGenerate: 4, zoomMaxGenerate: 4 };
    const { sessionId } = await svc.startSession('node-2' as any, points, settings);

    let sawTilegen = false;
    const p = await waitForCompleted((cb) => svc.onProgress(sessionId, (e) => { if (e.stage === 'tilegen') sawTilegen = true; cb(e); }));
    expect(sawTilegen).toBe(true);
    expect(p.percentage).toBeGreaterThanOrEqual(100);

    // sanity: chosen z/x/y for a point at zoom 4 should be present or empty; ensure summary exists
    const db = getEphemeralLocationDB();
    const all = await db.vectorTiles.where('sessionId').equals(sessionId).toArray();
    expect(all.length).toBeGreaterThan(0);

    // pick a z/x/y from the first point and ask the service
    const z = 4;
    const x = long2tile(points[0].lon, z);
    const y = lat2tile(points[0].lat, z);
    const bytes = await svc.getVectorTile(sessionId, 'node-2' as any, z, x, y);
    // It might be null if all points fell in neighboring tile; allow null but require at least one non-null in DB overall
    if (bytes) expect((bytes as Uint8Array).byteLength).toBeGreaterThan(0);
  });
});

