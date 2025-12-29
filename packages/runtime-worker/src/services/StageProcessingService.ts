import type { DownloadWorkerAPI, SimplifyWorkerAPI, VectorTileWorkerAPI } from '../types.js';
import { getDBName } from '@hierarchidb/util';
import {
  generateVectorTilesFromJsonBuffer,
  getVectorTile,
  listVectorTiles,
  getVectorTileSummary,
  EphemeralGisDB,
  TilesDB,
  type VectorTileGenerateConfig,
} from '@hierarchidb/gis-sdk';

import type { SharedDownloadService } from './downloadAdapter.js';
import { createSharedDownloadService } from './downloadAdapter.js';

let ephemeralDb: EphemeralGisDB | null = null;
const getEphemeralDb = (): EphemeralGisDB => {
  if (!ephemeralDb) {
    ephemeralDb = new EphemeralGisDB(getDBName('shape-ephemeral'));
  }
  return ephemeralDb;
};

/**
 * StageProcessingService
 * Minimal worker-side surface for shape-plugin processing stages.
 *
 * NOTE: These are placeholders to define the contract and allow client wiring.
 *       Implementations can be incrementally replaced with real worker logic.
 */

class RealDownloadWorker implements DownloadWorkerAPI {
  private sharedPromise: Promise<SharedDownloadService> | null = null;

  private async getShared(): Promise<SharedDownloadService> {
    if (!this.sharedPromise) {
      this.sharedPromise = createSharedDownloadService({ dbPrefix: 'hidb', perHostConcurrency: 4 });
    }
    return this.sharedPromise;
  }

  async download(url: string, fileId: string, opts?: { expectedHash?: string }) {
    const shared = await this.getShared();
    const res = await shared.service.download(url, fileId, { expectedHash: opts?.expectedHash });
    return { fileId: res.fileId, sizeBytes: res.sizeBytes, hash: res.hash };
  }
}

// Minimal in-process registry to simulate buffer lineage across stages.
const bufferRegistry: Map<string, { parent?: string; stage: 's1' | 's2' | 'src'; ts: number }> =
  new Map();

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
  private sharedPromise: Promise<SharedDownloadService> | null = null;
  private readonly abortControllers = new Map<string, AbortController>();

  private async getShared(): Promise<SharedDownloadService> {
    if (!this.sharedPromise) {
      this.sharedPromise = createSharedDownloadService({ dbPrefix: 'hidb', perHostConcurrency: 2 });
    }
    return this.sharedPromise;
  }

  private async readBuffer(fileId: string): Promise<ArrayBuffer | null> {
    if (fileId.startsWith('stage-tile:')) {
      const key = fileId.slice('stage-tile:'.length);
      const tilesDb = await TilesDB.getSingleton();
      const row = await tilesDb.tiles.get(key);
      if (row?.data && row.data.byteLength > 0) {
        return row.data;
      }
    }
    try {
      const shared = await this.getShared();
      const data = await shared.readAll(fileId);
      if (data && data.byteLength > 0) {
        return data;
      }
    } catch {
      // Ignore and fall back to ephemeral buffers.
    }
    const db = getEphemeralDb();
    const row = await db.simplifiedBuffers.get(fileId) ?? await db.rawBuffers.get(fileId);
    return row?.data ?? null;
  }

  async generateTiles(
    inputBufferId: string,
    config: {
      format: 'mvt' | 'pbf';
      compression?: 'gzip' | 'none';
      tileSize?: number;
      buffer?: number;
      minZoom?: number;
      maxZoom?: number;
      metadataEnabled?: boolean;
      metadataReplace?: boolean;
      metadataContext?: {
        dataSource?: string;
        countryCode?: string;
        countryName?: string;
        adminLevel?: number;
      };
      abortKey?: string;
    }
  ) {
    const abortKey = config.abortKey;
    const controller = abortKey ? new AbortController() : null;
    if (abortKey && controller) {
      this.abortControllers.set(abortKey, controller);
    }
    try {
      const buf = await this.readBuffer(inputBufferId);
      if (!buf) return { tilesGenerated: 0, totalBytes: 0 };
      const resolveStageTileNodeId = (key: string): string | null => {
        const match = key.match(/^input:(.+)-(\d+)-(\d+)-(\d+)$/);
        if (match) return match[1] ?? null;
        const fallback = key.match(/^(.+)-(\d+)-(\d+)-(\d+)$/);
        return fallback?.[1] ?? null;
      };
      const nodeId = inputBufferId.startsWith('stage-tile:')
        ? resolveStageTileNodeId(inputBufferId.slice('stage-tile:'.length)) ?? inputBufferId
        : inputBufferId.includes('-simplify2-')
          ? inputBufferId.substring(0, inputBufferId.lastIndexOf('-simplify2-'))
          : inputBufferId;
      const sdkConfig: VectorTileGenerateConfig = {
        buffer: config.buffer,
        minZoom: config.minZoom,
        maxZoom: config.maxZoom,
        metadataEnabled: config.metadataEnabled,
        metadataReplace: config.metadataReplace,
        metadataContext: config.metadataContext,
        signal: controller?.signal,
      };
      return generateVectorTilesFromJsonBuffer(nodeId, buf, sdkConfig);
    } finally {
      if (abortKey) {
        this.abortControllers.delete(abortKey);
      }
    }
  }

  async abortGenerateTiles(abortKey: string): Promise<void> {
    const controller = this.abortControllers.get(abortKey);
    if (controller && !controller.signal.aborted) {
      controller.abort();
    }
  }

  async getTile(nodeId: string, z: number, x: number, y: number) {
    return getVectorTile(nodeId, z, x, y);
  }

  async listTiles(nodeId: string) {
    return listVectorTiles(nodeId);
  }

  async getSummary(nodeId: string) {
    return getVectorTileSummary(nodeId);
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
  // Note: stageWorker.entry is built to JS and emitted alongside index.ts
  const worker = new Worker(new URL('./stageWorker.entry.js', import.meta.url), { type: 'module' });
  const mod = (await import('comlink')) as typeof import('comlink');
  const client = mod.wrap<StageProcessingService>(worker);
  const proxy = new Proxy({} as StageProcessingService & { terminate?: () => void }, {
    get: (_target, prop) => {
      if (prop === 'terminate') {
        return () => worker.terminate();
      }
      return (client as unknown as Record<string | symbol, unknown>)[prop as string | symbol];
    },
  });
  return proxy as StageProcessingService;
}
