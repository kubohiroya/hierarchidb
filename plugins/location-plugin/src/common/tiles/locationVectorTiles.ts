import type { NodeId, NodeType } from '@hierarchidb/common-types';
import type {
  LocationBatchData,
  LocationPointInput,
  LocationTileSettings,
  SessionSummary,
  UnifiedLocationBatchConfig,
} from '@hierarchidb/location-store';
import type { BatchProgressEvent, BatchSessionStatus } from '@hierarchidb/common-api';
import { getEphemeralLocationDB } from '@hierarchidb/location-store';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { UnifiedLocationBatchManager } from '../../services/batch/UnifiedLocationBatchManager.js';

interface BatchBridge {
  initialize(): Promise<void>;
  startBatchSession(nodeType: NodeType, nodeId: NodeId): Promise<BatchSessionStatus>;
  subscribeBatchProgress(
    nodeType: NodeType,
    nodeId: NodeId,
    cb: (event: BatchProgressEvent) => void,
  ): Promise<() => void>;
}

export type ProgressInfo = BatchProgressEvent;

const LOCATION_NODE_TYPE = 'location' as NodeType;

type LocationVectorTileDeps = {
  manager?: UnifiedLocationBatchManager;
  bridge?: BatchBridge;
  dbProvider?: typeof getEphemeralLocationDB;
};

export async function startLocationVectorTileSession(
  nodeId: NodeId,
  points: LocationPointInput[],
  settings: LocationTileSettings,
  config?: UnifiedLocationBatchConfig,
  deps: LocationVectorTileDeps = {},
): Promise<SessionSummary> {
  const manager = deps.manager ?? new UnifiedLocationBatchManager();
  const bridge = deps.bridge ?? getWorkerBridge();
  const data: LocationBatchData = { points, settings };
  await manager.prepareSession(nodeId, config, data);
  await bridge.initialize();
  return {
    nodeId,
    zoomMin: settings.zoomMinGenerate,
    zoomMax: settings.zoomMaxGenerate,
    zoomMaxServe: settings.zoomMaxServe,
    bbox: computeBbox(points),
    totalPoints: points.length,
    layers: ['location_points'],
  } satisfies SessionSummary;
}

export function subscribeLocationBatchProgress(
  nodeId: NodeId,
  cb: (p: BatchProgressEvent) => void,
  deps: LocationVectorTileDeps = {},
): () => void {
  const bridge = deps.bridge ?? getWorkerBridge();
  let active = true;
  let unsubscribe: (() => void) | null = null;
  void bridge.initialize()
    .then(() => bridge.subscribeBatchProgress(LOCATION_NODE_TYPE, nodeId, cb))
    .then((fn) => {
      if (!active) {
        fn();
        return;
      }
      unsubscribe = fn;
    })
    .catch((error) => {
      console.error('[locationVectorTiles] progress subscription failed:', error);
    });
  return () => {
    active = false;
    unsubscribe?.();
  };
}

export async function getLocationVectorTile(
  nodeId: NodeId,
  z: number,
  x: number,
  y: number,
  deps: LocationVectorTileDeps = {},
): Promise<Uint8Array | null> {
  const db = (deps.dbProvider ?? getEphemeralLocationDB)();
  const id = `loc-mvt-${nodeId}-${z}-${x}-${y}`;
  const rec = await db.vectorTiles.get(id);
  if (!rec || rec.nodeId !== nodeId) return null;
  return new Uint8Array(rec.data);
}

export async function getLocationSessionSummary(
  nodeId: NodeId,
  deps: LocationVectorTileDeps = {},
): Promise<{
  exists: boolean;
  layers: string[];
  zoomRange?: [number, number];
  tiles: number;
  sizeBytes: number;
  bbox?: [number, number, number, number];
}> {
  const db = (deps.dbProvider ?? getEphemeralLocationDB)();
  const list = await db.vectorTiles.where('nodeId').equals(nodeId).toArray();
  if (list.length === 0) return { exists: false, layers: [], tiles: 0, sizeBytes: 0 };
  const zmin = Math.min(...list.map(r => r.z));
  const zmax = Math.max(...list.map(r => r.z));
  const size = list.reduce((s, r) => s + r.size, 0);
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
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

function tile2lon(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}

function tile2lat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}
