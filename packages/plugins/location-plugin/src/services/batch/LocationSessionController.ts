/**
 * Location SessionController - minimal point -> MVT pipeline
 */
import type { NodeId, ProgressEvent } from '@hierarchidb/common-types';
import { getEphemeralLocationDB } from '../database/EphemeralLocationDB.js';
import { TabularWriter } from '@hierarchidb/tabular-store';
// External libs (ambient types declared under types/external.d.ts)
import { DexieChunkStoragePort } from '@hierarchidb/download';
import { BatchService } from '@hierarchidb/batch';
import { getLocationRuntimeWorkerClient } from './adapters/RuntimeWorkerClient.js';
import { createLaneSemaphoreRegistry } from '@hierarchidb/batch-api';

export interface LocationPointInput {
  lon: number;
  lat: number;
  id?: string | number;
  ts?: number;
  properties?: Record<string, any>;
}

export interface LocationTileSettings {
  zoomMinGenerate: number;
  zoomMaxGenerate: number;
  zoomMaxServe?: number; // not used here but preserved in summary
  attributeAllowlist?: string[]; // optional; undefined means pass-through
  tileFeatureLimit?: number; // per tile; used by geojson-vt
  extent?: number; // MVT extent; encoded as 4096 default
}

// Use common progress event type to decouple worker from UI
export type ProgressInfo = ProgressEvent;

export interface SessionSummary {
  sessionId: string;
  nodeId: NodeId;
  zoomMin: number;
  zoomMax: number;
  zoomMaxServe?: number;
  bbox: [number, number, number, number];
  totalPoints: number;
  layers: string[];
}

export class LocationSessionController {
  private static readonly laneRegistry = createLaneSemaphoreRegistry({
    defaults: {
      tilegen: 4,
    },
    envKey: 'LOCATION_LANE_LIMITS',
    fallback: 4,
  });

  constructor(
    public readonly sessionId: string,
    private readonly nodeId: NodeId,
    private readonly points: LocationPointInput[],
    private readonly settings: LocationTileSettings,
  ) {
  }

  private progressCb?: (p: ProgressInfo) => void;
  private paused = false;
  private cancelled = false;

  setProgressCallback(cb: (p: ProgressInfo) => void) {
    this.progressCb = cb;
  }

  async start(): Promise<void> {
    // Stage 1: import (noop: we already have points)
    this.emit('import', 1, 1, 0, 'Loaded points');

    // Stage 2: normalize
    const norm = this.normalizePoints(this.points);
    this.emit('normalize', 1, 1, 0, `Normalized ${norm.features.length} points`);

    // Optional: persist tabular rows for column-wise search
    try {
      const columns = determineColumns(norm.features, this.settings.attributeAllowlist);
      const writer = new TabularWriter('location');
      await writer.begin({ filename: `location-${this.sessionId}.json`, columns });
      const rows = featuresToRows(norm.features);
      // Write in chunks
      const CHUNK = 2000;
      for (let i = 0; i < rows.length; i += CHUNK) {
        await writer.writeRows(rows.slice(i, i + CHUNK));
      }
      const { tableId: committedId } = await writer.commit();
      // Link tableId to session (best-effort)
        const db = getEphemeralLocationDB();
        await db.table('sessions').update(this.sessionId, { tableId: committedId });
    } catch (e) {
      console.warn('[Location][Session] tabular persist skipped:', e);
    }

    // Stage 3: tilegen
    await this.generateTiles(norm);
    this.emit('completed', 1, 1, 0, 'Tile generation completed');
  }

  private normalizePoints(points: LocationPointInput[]) {
    const allow = this.settings.attributeAllowlist;
    const features = points.map((p, i) => ({
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
    features: any[];
    bbox: [number, number, number, number]
  }) {
    const db = getEphemeralLocationDB();
    try {
      await db.clearVectorTilesForSession(this.sessionId);
    } catch (error) {
      console.warn('[Location][Session] failed to clear existing vector tiles for session', error);
    }
    // 1) Persist normalized GeoJSON into shared chunk store so worker can read it
    const json = JSON.stringify(fc);
    const bytes = new TextEncoder().encode(json).buffer;
    const fileId = this.sessionId; // worker uses this as sessionId
    try {
      const storage = new DexieChunkStoragePort('hidb-chunks');
      await storage.putChunk(fileId, 0, bytes);
      await storage.commit(fileId, { sizeBytes: bytes.byteLength, contentType: 'application/json' });
    } catch (e) {
      console.error('[Location][Session] Failed to write input buffer for worker:', e);
      return;
    }

    // 2) Delegate tile generation to runtime-worker
    const client = await getLocationRuntimeWorkerClient();
    if (!client) {
      console.warn('[Location][Session] runtime worker client unavailable; skipping worker delegation');
      return;
    }
    await LocationSessionController.laneRegistry.runWithLane('tilegen', async () => {
      await client.vectortile.generateTiles(fileId, { format: 'mvt', compression: 'none' });
    });

    // 3) Import generated tiles back into location DB for compatibility
    type VectorTileRecord = { z: number; x: number; y: number; size: number; timestamp?: number };
    const list: VectorTileRecord[] = await client.vectortile.listTiles(fileId);
    const total = list.length;
    let completed = 0;
    const batch = new BatchService();
    const laneName = 'tilegen';
    const concurrency = LocationSessionController.laneRegistry.recommendConcurrency([laneName], 4);

    await batch.mapChunks<VectorTileRecord, void>(list, async (t) => {
      await LocationSessionController.laneRegistry.runWithLane(laneName, async () => {
        if (this.cancelled) return;
        while (this.paused) await new Promise(r => setTimeout(r, 100));
        const u8 = await client.vectortile.getTile(fileId, t.z, t.x, t.y);
        if (!u8) return;
        const copy = new Uint8Array(u8);
        const data: ArrayBuffer = copy.buffer.slice(0);
        const id = `loc-mvt-${this.sessionId}-${t.z}-${t.x}-${t.y}`;
        const hash = await sha256Hex(new Uint8Array(data));
        await db.vectorTiles.put({
          id,
          sessionId: this.sessionId,
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
      sessionId: this.sessionId,
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

  cancel() {
    this.cancelled = true;
  }
}

// Helpers
function filterProps(obj: Record<string, any>, allow: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of allow) if (k in obj) out[k] = obj[k];
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

// Note: tile range enumeration and vt encoding moved to runtime-worker side.

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (typeof crypto !== 'undefined' && 'subtle' in crypto) {
    // Avoid BufferSource typing issues under libs that include SharedArrayBuffer by
    // passing a plain ArrayBuffer copy to SubtleCrypto.
    const h = await crypto.subtle.digest(
      'SHA-256',
      bytes.slice().buffer,
    );
    return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Node fallback
  const { createHash } = await import('crypto');
  return createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

// Build columns and rows from normalized features
function determineColumns(features: any[], allow?: string[]): string[] {
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

function featuresToRows(features: any[]): any[] {
  return features.map((f) => {
    const [lon, lat] = (f?.geometry?.coordinates ?? [0, 0]) as [number, number];
    return {
      id: f?.id,
      lon,
      lat,
      ...(f?.properties || {}),
    };
  });
}
