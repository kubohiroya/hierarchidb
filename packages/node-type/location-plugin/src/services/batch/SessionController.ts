/**
 * Location SessionController - minimal point -> MVT pipeline
 */
import { BatchService } from '@hierarchidb/batch';
import type { NodeId, ProgressEvent } from '@hierarchidb/common-type';
import { getEphemeralLocationDB } from '../database/EphemeralLocationDB';
import { TabularWriter } from '@hierarchidb/tabular-store';
// External libs (ambient types declared under types/external.d.ts)
import vtpbf from '@maplibre/vt-pbf';
import geojsonvt from 'geojson-vt';

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

export class SessionController {
  constructor(
    public readonly sessionId: string,
    private readonly nodeId: NodeId,
    private readonly points: LocationPointInput[],
    private readonly settings: LocationTileSettings,
  ) {
  }

  private batch = new BatchService();
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
      const enabled =
        (typeof process !== 'undefined' && (process as any)?.env?.LOCATION_TABULAR === '1') ||
        (typeof globalThis !== 'undefined' && (globalThis as any)?.FEATURE_FLAGS?.LOCATION_TABULAR === true);
      if (enabled) {
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
        try {
          const db = getEphemeralLocationDB();
          // @ts-ignore
          await db.table('sessions').update(this.sessionId, { tableId: committedId });
        } catch {
        }
      }
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
    const zmin = this.settings.zoomMinGenerate;
    const zmax = this.settings.zoomMaxGenerate;
    const extent = this.settings.extent ?? 4096;
    const tileLimit = this.settings.tileFeatureLimit ?? 10000;

    // Build tile index once
    const index = geojsonvt(fc as any, {
      maxZoom: zmax,
      indexMaxZoom: Math.min(14, zmax),
      indexMaxPoints: 100000,
      tolerance: 0, // no simplification for points
      extent,
      buffer: 64,
      lineMetrics: false,
      promoteId: 'id',
      maxPointsPerTile: tileLimit,
    } as any);

    let total = 0;
    let done = 0;
    // Estimate tiles to process from bbox ranges
    const ranges = enumerateTilesForBbox(fc.bbox, zmin, zmax);
    total = ranges.reduce((s, r) => s + (r.x2 - r.x1 + 1) * (r.y2 - r.y1 + 1), 0);

    const tasks = ranges.flatMap(r => {
      const list: Array<{ z: number, x: number, y: number }> = [];
      for (let z = r.z; z <= r.z; z++) {
        for (let x = r.x1; x <= r.x2; x++) {
          for (let y = r.y1; y <= r.y2; y++) list.push({ z, x, y });
        }
      }
      return list;
    });

    await this.batch.mapChunks(tasks, async ({ z, x, y }: { z: number; x: number; y: number }) => {
      if (this.cancelled) return;
      while (this.paused) await new Promise(r => setTimeout(r, 100));
      const tile = index.getTile(z, x, y);
      done++;
      this.emit('tilegen', total, done, 0, `Tile ${z}/${x}/${y}`);
      if (!tile || !tile.features || tile.features.length === 0) return;

      const pbf = vtpbf.fromGeojsonVt({ location_points: tile }, { version: 2 });
      const data = (pbf as Uint8Array).buffer.slice(0);
      const id = `loc-mvt-${this.sessionId}-${z}-${x}-${y}`;
      const hash = await sha256Hex(new Uint8Array(data));
      await db.vectorTiles.put({
        id,
        sessionId: this.sessionId,
        nodeId: this.nodeId,
        z, x, y,
        data,
        hash,
        size: data.byteLength,
        featureCount: tile.features.length,
        timestamp: Date.now(),
        contentType: 'application/vnd.mapbox-vector-tile',
      });
    }, { concurrency: 4, progress: (c: number) => this.emit('tilegen', total, c, 0, 'Generating tiles') });
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

function enumerateTilesForBbox(bbox: [number, number, number, number], zmin: number, zmax: number) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const ranges: Array<{ z: number; x1: number; y1: number; x2: number; y2: number }> = [];
  for (let z = zmin; z <= zmax; z++) {
    const x1 = long2tile(minLon, z);
    const x2 = long2tile(maxLon, z);
    const y1 = lat2tile(maxLat, z); // note: TMS convention
    const y2 = lat2tile(minLat, z);
    ranges.push({ z, x1, y1, x2, y2 });
  }
  return ranges;
}

function long2tile(lon: number, z: number) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}

function lat2tile(lat: number, z: number) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * Math.pow(2, z));
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (typeof crypto !== 'undefined' && 'subtle' in crypto) {
    const h = await crypto.subtle.digest('SHA-256', bytes);
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
