import type { DownloadWorkerAPI, SimplifyWorkerAPI, VectorTileWorkerAPI } from '../types';
import { createSharedDownloadService } from '@hierarchidb/runtime-shared-batch-processor';
import { TilesDB } from './TilesDB';

/**
 * StageProcessingService
 * Minimal worker-side surface for shape-plugin processing stages.
 *
 * NOTE: These are placeholders to define the contract and allow client wiring.
 *       Implementations can be incrementally replaced with real worker logic.
 */

class RealDownloadWorker implements DownloadWorkerAPI {
  private servicePromise: Promise<any> | null = null;

  private async getService(): Promise<any> {
    if (!this.servicePromise) {
      this.servicePromise = (async () => {
        const { service } = await createSharedDownloadService({ dbPrefix: 'hidb', perHostConcurrency: 4 });
        return service;
      })();
    }
    return this.servicePromise;
  }

  async download(url: string, fileId: string, opts?: { expectedHash?: string }) {
    const svc = await this.getService();
    const res = await svc.download(url, fileId, { expectedHash: opts?.expectedHash });
    return { fileId: res.fileId, sizeBytes: res.sizeBytes, hash: res.hash };
  }
}

// Minimal in-process registry to simulate buffer lineage across stages.
const bufferRegistry: Map<string, { parent?: string; stage: 's1' | 's2' | 'src'; ts: number }> = new Map();

class RealSimplifyWorker implements SimplifyWorkerAPI {
  async simplifyStage1(inputBufferId: string, _config: { tolerance: number; minArea: number }) {
    const out = `${inputBufferId}-s1`;
    bufferRegistry.set(out, { parent: inputBufferId, stage: 's1', ts: Date.now() });
    return { outputBufferId: out };
  }
  async simplifyStage2(inputBufferId: string, _config: { zoomLevels: number[]; tileSize: number }) {
    const out = `${inputBufferId}-s2`;
    bufferRegistry.set(out, { parent: inputBufferId, stage: 's2', ts: Date.now() });
    return { outputBufferId: out };
  }
}

class RealVectorTileWorker implements VectorTileWorkerAPI {
  private async readBuffer(fileId: string): Promise<ArrayBuffer | null> {
    try {
      const { service } = await createSharedDownloadService({ dbPrefix: 'hidb', perHostConcurrency: 2 });
      const storage = (service as any)?.store;
      if (storage?.readAll) return await storage.readAll(fileId);
    } catch {}
    return null;
  }

  private long2tile(lon: number, z: number) {
    return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
  }
  private lat2tile(lat: number, z: number) {
    const rad = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z));
  }

  async generateTiles(inputBufferId: string, config: { format: 'mvt'; compression?: 'gzip' | 'none' }) {
    const buf = await this.readBuffer(inputBufferId);
    if (!buf) return { tilesGenerated: 0, totalBytes: 0 };
    let geojson: any;
    try {
      const txt = new TextDecoder().decode(buf);
      geojson = JSON.parse(txt);
    } catch {
      return { tilesGenerated: 0, totalBytes: 0 };
    }

    const gjvt = (await import('geojson-vt')).default as any;
    // @maplibre/vt-pbf exposes named exports; use the module object directly
    const vtpbf = await import('@maplibre/vt-pbf');
    const extent = 4096;
    const index = gjvt(geojson, { maxZoom: 6, extent, indexMaxZoom: 6, promoteId: 'id' });

    // Compute bbox
    const fc = geojson;
    const feats = fc?.features || [];
    if (feats.length === 0) return { tilesGenerated: 0, totalBytes: 0 };
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    for (const f of feats) {
      const c = f?.geometry?.coordinates;
      if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') {
        const lon = c[0], lat = c[1];
        if (lon < minLon) minLon = lon;
        if (lat < minLat) minLat = lat;
        if (lon > maxLon) maxLon = lon;
        if (lat > maxLat) maxLat = lat;
      }
    }
    if (!isFinite(minLon) || !isFinite(minLat) || !isFinite(maxLon) || !isFinite(maxLat)) {
      return { tilesGenerated: 0, totalBytes: 0 };
    }

    const db = await TilesDB.getSingleton();
    let tiles = 0;
    let totalBytes = 0;
    const z = 4; // conservative default zoom
    const sessionId = inputBufferId.includes('-simplify2-')
      ? inputBufferId.substring(0, inputBufferId.lastIndexOf('-simplify2-'))
      : inputBufferId;
    const x1 = this.long2tile(minLon, z);
    const x2 = this.long2tile(maxLon, z);
    const y1 = this.lat2tile(maxLat, z);
    const y2 = this.lat2tile(minLat, z);
    for (let x = x1; x <= x2; x++) {
      for (let y = y1; y <= y2; y++) {
        const tile = index.getTile(z, x, y);
        if (tile && tile.features && tile.features.length) {
          const pbf = vtpbf.fromGeojsonVt({ layer0: tile } as any, { version: 2 } as any);
          const bytes = pbf as Uint8Array;
          tiles++;
          totalBytes += bytes.byteLength;
          const key = `${sessionId}-${z}-${x}-${y}`;
          await db.tiles.put({
            key,
            sessionId,
            z, x, y,
            // Ensure ArrayBuffer, not SharedArrayBuffer union
            data: bytes.slice().buffer,
            size: bytes.byteLength,
            contentType: 'application/vnd.mapbox-vector-tile',
            timestamp: Date.now(),
          });
        }
      }
    }
    return { tilesGenerated: tiles, totalBytes };
  }

  async getTile(sessionId: string, z: number, x: number, y: number) {
    const db = await TilesDB.getSingleton();
    const key = `${sessionId}-${z}-${x}-${y}`;
    const row = await db.tiles.get(key);
    if (!row) return null;
    return new Uint8Array(row.data);
  }

  async listTiles(sessionId: string) {
    const db = await TilesDB.getSingleton();
    const rows = await db.tiles.where('sessionId').equals(sessionId).toArray();
    return rows.map(r => ({ z: r.z, x: r.x, y: r.y, size: r.size, timestamp: r.timestamp }));
  }

  async getSummary(sessionId: string) {
    const db = await TilesDB.getSingleton();
    const rows = await db.tiles.where('sessionId').equals(sessionId).toArray();
    if (rows.length === 0) return { tiles: 0, totalBytes: 0 };
    const tiles = rows.length;
    const totalBytes = rows.reduce((s, r) => s + r.size, 0);
    const zooms = rows.map(r => r.z);
    return { tiles, totalBytes, zoomMin: Math.min(...zooms), zoomMax: Math.max(...zooms) };
  }
}

export type StageProcessingService = {
  download: DownloadWorkerAPI;
  simplify: SimplifyWorkerAPI;
  vectortile: VectorTileWorkerAPI;
};

let singleton: StageProcessingService | null = null;

export async function getStageProcessingService(): Promise<StageProcessingService> {
  if (!singleton) {
    singleton = {
      download: new RealDownloadWorker(),
      simplify: new RealSimplifyWorker(),
      vectortile: new RealVectorTileWorker(),
    };
  }
  return singleton;
}

/**
 * getStageProcessingClient
 * A thin alias for client-side code (adapters) to access the service in the
 * current thread/process. In a multi-threaded deployment, this can be swapped
 * to a Comlink proxy or message-port client without changing consumers.
 */
export async function getStageProcessingClient(): Promise<StageProcessingService> {
  return getStageProcessingService();
}

// Comlink-based client factory for browser Worker threads
export async function createStageWorkerClient(): Promise<StageProcessingService> {
  // Note: stageWorker.entry is built to JS and emitted alongside index.js
  const worker = new Worker(new URL('./stageWorker.entry.js', import.meta.url), { type: 'module' });
  const mod = await import('comlink');
  // @ts-ignore
  const client = mod.wrap<StageProcessingService>(worker);
  return client as unknown as StageProcessingService;
}
/// <reference path="../types/external.d.ts" />
