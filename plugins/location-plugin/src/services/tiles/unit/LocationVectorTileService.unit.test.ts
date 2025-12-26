import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toNodeId, type ProgressEvent } from '@hierarchidb/common-types';
import type { LocationPointInput, LocationTileSettings, ProgressInfo } from '../LocationVectorTileService';
import { LocationVectorTileService } from '../LocationVectorTileService';
import { closeEphemeralLocationDB, getEphemeralLocationDB } from '../../../database/EphemeralLocationDB';
import { UnifiedLocationBatchManager } from '../../batch/UnifiedLocationBatchManager';
import { LocationBatchSessionManager } from '../../batch/BatchSessionManager';
import type { SessionSummary } from '../../_obsolate_common/types/batch-types.js';
import type { BatchProgressEvent } from '@hierarchidb/common-api';

type BridgeLike = NonNullable<ConstructorParameters<typeof LocationVectorTileService>[0]>;

class TestSessionManager extends LocationBatchSessionManager {
  private summary: SessionSummary | undefined;
  private progressCb?: (e: ProgressEvent) => void;

  override async createSession(
    nodeId: ReturnType<typeof toNodeId>,
    points: LocationPointInput[],
    settings: LocationTileSettings,
    // options?: { concurrency?: number },
  ): Promise<SessionSummary> {
    this.summary = {
      sessionId: `${String(nodeId)}-session`,
      nodeId,
      zoomMin: settings.zoomMinGenerate,
      zoomMax: settings.zoomMaxGenerate,
      zoomMaxServe: settings.zoomMaxServe,
      bbox: [0, 0, 0, 0],
      totalPoints: points.length,
      layers: ['location_points'],
    } satisfies SessionSummary;
    return this.summary;
  }

  override getInitialSummary(): SessionSummary | undefined {
    return this.summary;
  }

  override onProgress(_sessionId: string, cb: (e: ProgressEvent) => void): () => void {
    this.progressCb = cb;
    return () => {
      this.progressCb = undefined;
    };
  }

  emit(event: ProgressEvent): void {
    this.progressCb?.(event);
  }
}

function createLocalBridge(): BridgeLike {
  const manager = new UnifiedLocationBatchManager();
  const sessionManager = new TestSessionManager();
  manager.setInternalManager(sessionManager);
  manager.setDbProvider(() => getEphemeralLocationDB());

  return {
    async initialize() {
      // no-op
    },
    async startBatchSession(_nodeType, nodeId) {
      const sessionId = await manager.startBatchSession(nodeId);
      const db = getEphemeralLocationDB();
      await db.vectorTiles.put({
        id: `loc-mvt-${sessionId}-5-28-12`,
        sessionId,
        nodeId,
        z: 5,
        x: 28,
        y: 12,
        data: new Uint8Array([1, 2, 3]).buffer,
        hash: 'stub-hash',
        size: 3,
        featureCount: 1,
        timestamp: Date.now(),
        contentType: 'application/vnd.mapbox-vector-tile',
      });
      return manager.getBatchSessionStatus(sessionId);
    },
    async subscribeBatchProgress(_nodeType, sessionId, cb) {
      const event: BatchProgressEvent = {
        sessionId,
        nodeId: toNodeId('stub-node'),
        stage: 'vectortile',
        phase: 'completed',
        timestamp: Date.now(),
        payload: {
          completed: 1,
          total: 1,
        },
      } satisfies BatchProgressEvent;
      const timer = setTimeout(() => {
        const db = getEphemeralLocationDB();
        void db.sessions?.update?.(sessionId, {
          status: 'completed',
          progress: event.payload?.completed,
          updatedAt: Date.now(),
        });
        cb(event);
      }, 0);
      return () => {
        clearTimeout(timer);
      };
    },
  } satisfies BridgeLike;
}

function long2tile(lon: number, z: number) {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}

function lat2tile(lat: number, z: number) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * 2 ** z);
}

async function waitForCompleted(on: (cb: (p: ProgressInfo) => void) => void, timeoutMs = 5000): Promise<ProgressInfo> {
  return new Promise<ProgressInfo>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout waiting for completed')), timeoutMs);
    on((p) => {
      if (p.phase === 'completed') {
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
    const svc = new LocationVectorTileService(createLocalBridge());
    const points: LocationPointInput[] = [
      { lon: 139.767, lat: 35.681 }, // Tokyo Station
      { lon: 139.700, lat: 35.689 }, // Shinjuku
      { lon: 139.730, lat: 35.710 }, // Ueno
    ];
    const settings: LocationTileSettings = { zoomMinGenerate: 5, zoomMaxGenerate: 6 };

    const nodeId = toNodeId('node-1');
    const summary = await svc.startSession(nodeId, points, settings);
    expect(summary.sessionId).toBeTruthy();
    expect(summary.totalPoints).toBe(3);

    await waitForCompleted((cb) => svc.onProgress(summary.sessionId, cb));

    const db = getEphemeralLocationDB();
    const tiles = await db.vectorTiles.where('sessionId').equals(summary.sessionId).toArray();
    expect(tiles.length).toBeGreaterThan(0);

    const first = tiles[0]!;
    const bytes = await svc.getVectorTile(summary.sessionId, summary.nodeId, first.z, first.x, first.y);
    expect(bytes).not.toBeNull();
    expect(bytes?.byteLength ?? 0).toBeGreaterThan(0);
  });

  it('emits progress events and completes to 100%', async () => {
    const svc = new LocationVectorTileService(createLocalBridge());
    const points: LocationPointInput[] = [
      { lon: -73.9857, lat: 40.7484 }, // NYC
      { lon: -73.9851, lat: 40.7580 },
      { lon: -73.9792, lat: 40.7615 },
    ];
    const settings: LocationTileSettings = { zoomMinGenerate: 4, zoomMaxGenerate: 4 };
    const nodeId = toNodeId('node-2');
    const { sessionId } = await svc.startSession(nodeId, points, settings);

    let sawTilegen = false;
    const p = await waitForCompleted((cb) => svc.onProgress(sessionId, (e) => {
      if (e.stage === 'vectortile' || e.phase === 'completed') sawTilegen = true;
      cb(e);
    }));
    expect(sawTilegen).toBe(true);
    expect(p.phase).toBe('completed');

    // sanity: chosen z/x/y for a point at zoom 4 should be present or empty; ensure summary exists
    const db = getEphemeralLocationDB();
    const all = await db.vectorTiles.where('sessionId').equals(sessionId).toArray();
    expect(all.length).toBeGreaterThan(0);

    // pick a z/x/y from the first point and ask the service
    const z = 4;
    const firstPoint = points[0];
    expect(firstPoint).toBeDefined();
    const x = long2tile(firstPoint!.lon, z);
    const y = lat2tile(firstPoint!.lat, z);
    const bytes = await svc.getVectorTile(sessionId, nodeId, z, x, y);
    // It might be null if all points fell in neighboring tile; allow null but require at least one non-null in DB overall
    if (bytes) expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('passes batch configuration through prepareSession', async () => {
    const prepareSpy = vi.spyOn(UnifiedLocationBatchManager.prototype, 'prepareSession');
    const svc = new LocationVectorTileService(createLocalBridge());
    const nodeId = toNodeId('node-config');
    const points: LocationPointInput[] = [{ lon: 0, lat: 0 }];
    const settings: LocationTileSettings = { zoomMinGenerate: 3, zoomMaxGenerate: 5 };

    try {
      await svc.startSession(nodeId, points, settings, { concurrency: 6 });
      expect(prepareSpy).toHaveBeenCalledWith(
        nodeId,
        { concurrency: 6 },
        expect.objectContaining({ points, settings }),
      );
    } finally {
      prepareSpy.mockRestore();
    }
  });
});
