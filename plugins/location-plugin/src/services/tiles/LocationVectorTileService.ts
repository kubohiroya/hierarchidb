import type { NodeId, NodeType } from '@hierarchidb/common-types';
import { getEphemeralLocationDB } from '../database/EphemeralLocationDB.js';
import { UnifiedLocationBatchManager, type LocationBatchData, type UnifiedLocationBatchConfig } from '../batch/UnifiedLocationBatchManager.js';
import type { LocationPointInput, LocationTileSettings, SessionSummary } from '../batch/LocationSessionController.js';
import type {
  BatchProgressEvent,
  BatchSessionId,
  BatchSessionStatus,
} from '@hierarchidb/common-api';
import { getWorkerBridge } from '@hierarchidb/ui-plugin-dialog';

interface BatchBridge {
  initialize(): Promise<void>;
  startBatchSession(nodeType: NodeType, nodeId: NodeId): Promise<BatchSessionStatus>;
  subscribeBatchProgress(
    nodeType: NodeType,
    sessionId: BatchSessionId,
    cb: (event: BatchProgressEvent) => void,
  ): Promise<() => void>;
}

export interface ProgressInfo extends BatchProgressEvent {}

const LOCATION_NODE_TYPE = 'location' as NodeType;

export class LocationVectorTileService {
  private readonly manager: UnifiedLocationBatchManager;
  private readonly bridge: BatchBridge;

  constructor(bridge: BatchBridge = getWorkerBridge()) {
    this.manager = new UnifiedLocationBatchManager();
    this.bridge = bridge;
  }

  async startSession(
    nodeId: NodeId,
    points: LocationPointInput[],
    settings: LocationTileSettings,
    config?: UnifiedLocationBatchConfig,
  ): Promise<SessionSummary> {
    const data: LocationBatchData = { points, settings };
    await this.manager.prepareSession(nodeId, config, data);
    await this.bridge.initialize();
    const status = await this.bridge.startBatchSession(LOCATION_NODE_TYPE, nodeId);
    const sessionId = status.sessionId;
    if (!sessionId) {
      throw new Error('Worker did not return a sessionId for location batch session');
    }
    return {
      sessionId,
      nodeId,
      zoomMin: settings.zoomMinGenerate,
      zoomMax: settings.zoomMaxGenerate,
      zoomMaxServe: settings.zoomMaxServe,
      bbox: computeBbox(points),
      totalPoints: points.length,
      layers: ['location_points'],
    } satisfies SessionSummary;
  }

  onProgress(sessionId: string, cb: (p: BatchProgressEvent) => void): () => void {
    let active = true;
    let unsubscribe: (() => void) | null = null;
    void this.bridge.initialize()
      .then(() => this.bridge.subscribeBatchProgress(LOCATION_NODE_TYPE, sessionId, cb))
      .then((fn) => {
        if (!active) {
          fn();
          return;
        }
        unsubscribe = fn;
      })
      .catch((error) => {
        console.error('[LocationVectorTileService] progress subscription failed:', error);
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
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
}

function computeBbox(points: LocationPointInput[]): [number, number, number, number] {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const point of points) {
    if (point.lon < minLon) minLon = point.lon;
    if (point.lat < minLat) minLat = point.lat;
    if (point.lon > maxLon) maxLon = point.lon;
    if (point.lat > maxLat) maxLat = point.lat;
  }
  if (!Number.isFinite(minLon) || !Number.isFinite(minLat) || !Number.isFinite(maxLon) || !Number.isFinite(maxLat)) {
    return [0, 0, 0, 0];
  }
  return [minLon, minLat, maxLon, maxLat];
}

export type { LocationPointInput, LocationTileSettings };

function tile2lon(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}

function tile2lat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}
