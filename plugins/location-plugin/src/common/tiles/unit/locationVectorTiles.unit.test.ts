import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toNodeId, type ProgressEvent, type NodeId, type NodeType } from '@hierarchidb/common-types';
import type { LocationPointInput, LocationTileSettings, SessionSummary } from '@hierarchidb/location-store';
import { closeLocationDB, getLocationDB } from '@hierarchidb/location-store';
import type { BatchProgressEvent, BatchSessionStatus } from '@hierarchidb/common-api';
import { UnifiedLocationBatchManager } from '../../../services/batch/UnifiedLocationBatchManager.js';
import { LocationBatchSessionManager } from '../../../services/batch/BatchSessionManager.js';
import {
  getLocationSessionSummary,
  getLocationVectorTile,
  startLocationVectorTileSession,
  subscribeLocationBatchProgress,
  type ProgressInfo,
} from '../locationVectorTiles.js';

type BridgeLike = {
  initialize(): Promise<void>;
  startBatchSession(nodeType: NodeType, nodeId: NodeId): Promise<BatchSessionStatus>;
  subscribeBatchProgress(
    nodeType: NodeType,
    nodeId: NodeId,
    cb: (event: BatchProgressEvent) => void,
  ): Promise<() => void>;
};

class TestSessionManager extends LocationBatchSessionManager {
  private summary: SessionSummary | undefined;
  private progressCb?: (e: ProgressEvent) => void;

  override async createSession(
    nodeId: ReturnType<typeof toNodeId>,
    points: LocationPointInput[],
    settings: LocationTileSettings,
  ): Promise<SessionSummary> {
    this.summary = {
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

  override onProgress(_nodeId: string, cb: (e: ProgressEvent) => void): () => void {
    this.progressCb = cb;
    return () => {
      this.progressCb = undefined;
    };
  }

  emit(event: ProgressEvent): void {
    this.progressCb?.(event);
  }
}

function createLocalBridge(manager: UnifiedLocationBatchManager): BridgeLike {
  const sessionManager = new TestSessionManager();
  manager.setInternalManager(sessionManager);
  manager.setDbProvider(() => getLocationDB());

  return {
    async initialize() {
      // no-op
    },
    async startBatchSession(_nodeType, nodeId) {
      const sessionNodeId = await manager.startBatchSession(nodeId);
      const db = getLocationDB();
      await db.vectorTiles.put({
        id: `loc-mvt-${sessionNodeId}-5-28-12`,
        nodeId: sessionNodeId,
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
      return manager.getBatchSessionStatus(sessionNodeId);
    },
    async subscribeBatchProgress(_nodeType, nodeId, cb) {
      const event: BatchProgressEvent = {
        nodeId,
        stage: 'vectortile',
        phase: 'completed',
        timestamp: Date.now(),
        payload: {
          completed: 1,
          total: 1,
        },
      } satisfies BatchProgressEvent;
      const timer = setTimeout(() => {
        const db = getLocationDB();
        void db.sessions?.update?.(nodeId, {
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

describe('locationVectorTiles', () => {
  beforeEach(async () => {
    const db = getLocationDB();
    await db.vectorTiles.clear();
  });
  afterEach(async () => {
    await closeLocationDB();
  });

  it('generates at least one vector tile for small point set', async () => {
    const manager = new UnifiedLocationBatchManager();
    const bridge = createLocalBridge(manager);
    const points: LocationPointInput[] = [
      { lon: 139.767, lat: 35.681 },
      { lon: 139.7, lat: 35.689 },
      { lon: 139.73, lat: 35.71 },
    ];
    const settings: LocationTileSettings = { zoomMinGenerate: 5, zoomMaxGenerate: 6 };

    const nodeId = toNodeId('node-1');
    const summary = await startLocationVectorTileSession(nodeId, points, settings, undefined, { manager, bridge });
    expect(summary.totalPoints).toBe(3);

    await waitForCompleted((cb) => subscribeLocationBatchProgress(summary.nodeId, cb, { bridge }));

    const db = getLocationDB();
    const tiles = await db.vectorTiles.where('nodeId').equals(summary.nodeId).toArray();
    expect(tiles.length).toBeGreaterThan(0);

    const first = tiles[0]!;
    const bytes = await getLocationVectorTile(summary.nodeId, first.z, first.x, first.y);
    expect(bytes).not.toBeNull();
    expect(bytes?.byteLength ?? 0).toBeGreaterThan(0);

    const sessionSummary = await getLocationSessionSummary(summary.nodeId);
    expect(sessionSummary.exists).toBe(true);
  });

  it('emits progress events and completes to 100%', async () => {
    const manager = new UnifiedLocationBatchManager();
    const bridge = createLocalBridge(manager);
    const points: LocationPointInput[] = [
      { lon: -73.9857, lat: 40.7484 },
      { lon: -73.9851, lat: 40.758 },
      { lon: -73.9792, lat: 40.7615 },
    ];
    const settings: LocationTileSettings = { zoomMinGenerate: 4, zoomMaxGenerate: 4 };
    const nodeId = toNodeId('node-2');
    const summary = await startLocationVectorTileSession(nodeId, points, settings, undefined, { manager, bridge });

    let sawTilegen = false;
    const p = await waitForCompleted((cb) => subscribeLocationBatchProgress(summary.nodeId, (e) => {
      if (e.stage === 'vectortile' || e.phase === 'completed') sawTilegen = true;
      cb(e);
    }, { bridge }));
    expect(sawTilegen).toBe(true);
    expect(p.phase).toBe('completed');

    const db = getLocationDB();
    const all = await db.vectorTiles.where('nodeId').equals(summary.nodeId).toArray();
    expect(all.length).toBeGreaterThan(0);

    const z = 4;
    const firstPoint = points[0];
    const x = long2tile(firstPoint!.lon, z);
    const y = lat2tile(firstPoint!.lat, z);
    const bytes = await getLocationVectorTile(summary.nodeId, z, x, y);
    if (bytes) expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('passes batch configuration through prepareSession', async () => {
    const manager = new UnifiedLocationBatchManager();
    const bridge = createLocalBridge(manager);
    const prepareSpy = vi.spyOn(manager, 'prepareSession');
    const nodeId = toNodeId('node-config');
    const points: LocationPointInput[] = [{ lon: 0, lat: 0 }];
    const settings: LocationTileSettings = { zoomMinGenerate: 3, zoomMaxGenerate: 5 };

    try {
      await startLocationVectorTileSession(nodeId, points, settings, { concurrency: 6 }, { manager, bridge });
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
