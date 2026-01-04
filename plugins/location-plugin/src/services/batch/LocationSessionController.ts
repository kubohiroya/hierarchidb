/**
 * Location SessionController - minimal point -> MVT pipeline
 */
import type { NodeId, ProgressEvent } from '@hierarchidb/common-types';
import { getLocationDB } from '../../database/EphemeralLocationDB.js';
import { TabularWriter } from '@hierarchidb/tabular-store';
import { digestSha256Hex } from '@hierarchidb/util';
// External libs (ambient types declared under types/external.d.ts)
import { BatchService, createLaneSemaphoreRegistry } from '@hierarchidb/batch';
import { getLocationRuntimeWorkerClient } from './adapters/RuntimeWorkerClient.js';
import type { LocationPointInput, LocationTileSettings } from '../../common/types/batch-types.js';
import type { Feature, Point } from 'geojson';
import { runVectorTileStage } from '@hierarchidb/runtime-worker';
import { encodeFlatGeobufFromFeatureCollection } from '@hierarchidb/gis-sdk';

// Use _obsolate_common progress event type to decouple worker from UI
export type ProgressInfo = ProgressEvent;

type LocationFeature = Feature<Point, Record<string, unknown>>;

export class LocationSessionController {
  private static readonly laneRegistry = createLaneSemaphoreRegistry({
    defaults: {
      tilegen: 4,
    },
    envKey: 'LOCATION_LANE_LIMITS',
    fallback: 4,
  });

  constructor(
    private readonly nodeId: NodeId,
    private readonly points: LocationPointInput[],
    private readonly settings: LocationTileSettings,
  ) {
  }

  private progressCb?: (p: ProgressInfo) => void;
  private paused = false;

  setProgressCallback(cb: (p: ProgressInfo) => void) {
    this.progressCb = cb;
  }

  async start(): Promise<void> {
    // Stage 1: import (noop: we already have points)
    this.emit('import', 1, 1, 0, 'Loaded points');

    // Stage 2: normalize
    const norm = this.normalizePoints(this.points);
    this.emit('normalize', 1, 1, 0, `Normalized ${norm.features.length} points`);

    // Optional: persist tabular-source rows for column-wise search
    try {
      const columns = determineColumns(norm.features, this.settings.attributeAllowlist);
      const writer = new TabularWriter('location');
      await writer.begin({ filename: `location-${this.nodeId}.json`, columns });
      const rows = featuresToRows(norm.features);
      // Write in chunks
      const CHUNK = 2000;
      for (let i = 0; i < rows.length; i += CHUNK) {
        await writer.writeRows(rows.slice(i, i + CHUNK));
      }
      const { tableId: committedId } = await writer.commit();
      // Link tableId to session (best-effort)
        const db = getLocationDB();
        await db.table('sessions').update(this.nodeId, { tableId: committedId });
    } catch (e) {
      console.warn('[Location][Session] tabular-source persist skipped:', e);
    }

    // Stage 3: tilegen
    await this.generateTiles(norm);
    this.emit('completed', 1, 1, 0, 'Tile generation completed');
  }

  private normalizePoints(points: LocationPointInput[]) {
    const allow = this.settings.attributeAllowlist;
    const features: LocationFeature[] = points.map((p, i) => ({
      type: 'Feature' as const,
      id: p.id ?? i,
      properties: allow ? filterProps(p.properties ?? {}, allow) : (p.properties ?? {}),
      geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
    }));
    const bbox = computeBbox(points);
    return { type: 'FeatureCollection' as const, features, bbox };
  }

  private async generateTiles(fc: {
    type: 'FeatureCollection';
    features: LocationFeature[];
    bbox: [number, number, number, number]
  }) {
    const db = getLocationDB();
    try {
      await db.clearVectorTilesForNode(this.nodeId);
    } catch (error) {
      console.warn('[Location][Session] failed to clear existing vector tiles for session', error);
    }
    // 1) Prepare normalized GeoJSON input buffer for worker
    const inputFormat = this.settings.inputFormat ?? 'geojson';
    const inputCompression = this.settings.inputCompression ?? 'none';
    const bytes = inputFormat === 'flatgeobuf'
      ? await encodeFlatGeobufFromFeatureCollection(fc)
      : new TextEncoder().encode(JSON.stringify(fc)).buffer;
    const fileId = this.nodeId; // worker uses this as nodeId

    // 2) Delegate tile generation to runtime-worker-worker
    const client = await getLocationRuntimeWorkerClient();
    if (!client) {
      console.warn('[Location][Session] runtime-worker worker client unavailable; skipping worker delegation');
      return;
    }
    const tileClient = client.vectortile;
    if (!tileClient) {
      console.warn('[Location][Session] vectortile client unavailable; skipping worker delegation');
      return;
    }
    type TileInfo = { z: number; x: number; y: number; size: number; timestamp: number };
    let list: TileInfo[] = [];
    try {
      await LocationSessionController.laneRegistry.runWithLane('tilegen', async () => {
        const result = await runVectorTileStage({
          bufferId: fileId,
          buffer: bytes,
          config: {
            format: 'mvt',
            compression: 'none',
            inputFormat,
            inputCompression,
            targetNodeId: this.nodeId,
            targetNodeType: 'location',
          },
        }, tileClient);
        list = result.tiles;
      });
    } catch (e) {
      console.error('[Location][Session] Failed to generate tiles:', e);
      return;
    }

    // 3) Import generated tiles back into location DB for compatibility
    const total = list.length;
    let completed = 0;
    const batch = new BatchService();
    const laneName = 'tilegen';
    const concurrency = LocationSessionController.laneRegistry.recommendConcurrency([laneName], 4);

    await batch.mapChunks<TileInfo, void>(list, async (t) => {
      await LocationSessionController.laneRegistry.runWithLane(laneName, async () => {
        while (this.paused) await new Promise(r => setTimeout(r, 100));
        const u8 = await tileClient.getTile(this.nodeId, t.z, t.x, t.y, 'location');
        if (!u8) return;
        const copy = new Uint8Array(u8);
        const data: ArrayBuffer = copy.buffer.slice(0);
        const id = `loc-mvt-${this.nodeId}-${t.z}-${t.x}-${t.y}`;
        const hash = await digestSha256Hex(new Uint8Array(data));
        await db.vectorTiles.put({
          id,
          nodeId: this.nodeId,
          z: t.z, x: t.x, y: t.y,
          data,
          hash,
          size: data.byteLength,
          featureCount: 0,
          timestamp: t.timestamp ?? Date.now(),
          contentType: 'application/vnd.mapbox-vector-tile',
        });
        completed += 1;
        this.emit('tilegen', total, completed, 0, `Imported tile ${t.z}/${t.x}/${t.y}`);
      });
    }, { concurrency });
  }

  private emit(stage: ProgressInfo['stage'], total: number, completed: number, failed: number, currentTask: string) {
    this.progressCb?.({
      nodeId: this.nodeId,
      stage,
      total,
      completed,
      failed,
      percentage: total > 0 ? (completed / total) * 100 : 0,
      currentTask,
      timestamp: Date.now(),
    });
  }

  // Control API (minimal)
  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }
}

// Helpers
function filterProps(obj: Record<string, unknown>, allow: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of allow) if (k in obj) {
    if(obj[k]){
      out[k] = obj[k];
    }
  }
  return out;
}

function computeBbox(pts: LocationPointInput[]): [number, number, number, number] {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const p of pts) {
    if (p.lon < minLon) minLon = p.lon;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lon > maxLon) maxLon = p.lon;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  return [minLon, minLat, maxLon, maxLat];
}

// Note: tile range enumeration and vt encoding moved to runtime-worker-worker side.

// Build columns and rows from normalized features
function determineColumns(features: LocationFeature[], allow?: string[]): string[] {
  const cols = new Set<string>(['id', 'lon', 'lat']);
  if (Array.isArray(allow) && allow.length > 0) {
    for (const k of allow) cols.add(k);
  } else {
    // Derive from data (cap at 64 distinct keys to keep light)
    for (const f of features) {
      const props = f?.properties || {};
      for (const k of Object.keys(props)) {
        cols.add(k);
        if (cols.size >= 64) break;
      }
      if (cols.size >= 64) break;
    }
  }
  return Array.from(cols);
}

function featuresToRows(features: LocationFeature[]): Array<Record<string, unknown>> {
  return features.map((f) => {
    const [lon, lat] = f.geometry.coordinates ?? [0, 0];
    return {
      id: f?.id,
      lon,
      lat,
      ...(f?.properties || {}),
    };
  });
}
