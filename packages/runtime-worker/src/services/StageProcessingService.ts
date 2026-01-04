import type { DownloadWorkerAPI, ExtractWorkerAPI, VectorTileProgress, VectorTileWorkerAPI } from '../types.js';
import { getDBName } from '@hierarchidb/util';
import {
  generateVectorTilesFromFgbBuffer,
  generateVectorTilesFromJsonBuffer,
  getVectorTile,
  listVectorTiles,
  getVectorTileSummary,
  EphemeralGisDB,
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
      this.sharedPromise = createSharedDownloadService({ dbPrefix: 'hidb', perHostConcurrency: 4, scope: 'shape' });
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

class RealExtractWorker implements ExtractWorkerAPI {
  async extractStage1(inputBufferId: string, _config: { tolerance: number; minArea: number }) {
    const out = `${inputBufferId}-s1`;
    bufferRegistry.set(out, { parent: inputBufferId, stage: 's1', ts: Date.now() });
    return { outputBufferId: out };
  }
  async extractStage2(inputBufferId: string, _config: { zoomLevels: number[]; tileSize: number }) {
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
      this.sharedPromise = createSharedDownloadService({ dbPrefix: 'hidb', perHostConcurrency: 2, scope: 'shape' });
    }
    return this.sharedPromise;
  }

  private async readBuffer(fileId: string): Promise<ArrayBuffer | null> {
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
    const row = await db.extractedBuffers.get(fileId);
    return row?.data ?? null;
  }

  private async decodeInputBuffer(
    buffer: ArrayBuffer,
    inputCompression?: 'gzip' | 'none',
  ): Promise<ArrayBuffer> {
    if (inputCompression !== 'gzip') return buffer;
    if (typeof DecompressionStream !== 'function') {
      throw new Error('DecompressionStream is not available for gzip input compression');
    }
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    await writer.write(new Uint8Array(buffer));
    await writer.close();
    return new Response(stream.readable).arrayBuffer();
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
      inputFormat?: 'geojson' | 'flatgeobuf';
      inputCompression?: 'gzip' | 'none';
      metadataEnabled?: boolean;
      metadataReplace?: boolean;
      metadataContext?: {
        dataSource?: string;
        countryCode?: string;
        countryName?: string;
        adminLevel?: number;
      };
      targetNodeId?: string;
      abortKey?: string;
    },
    onProgress?: (progress: VectorTileProgress) => void,
    ) {
    const abortKey = config.abortKey;
    const controller = abortKey ? new AbortController() : null;
    if (abortKey && controller) {
      this.abortControllers.set(abortKey, controller);
    }
    try {
      const buf = await this.readBuffer(inputBufferId);
      if (!buf) return { tilesGenerated: 0, totalBytes: 0 };
      const inputBuffer = await this.decodeInputBuffer(buf, config.inputCompression);
      const nodeId = config.targetNodeId
        ?? (inputBufferId.includes('-extract2-')
          ? inputBufferId.substring(0, inputBufferId.lastIndexOf('-extract2-'))
          : inputBufferId);
      const sdkConfig: VectorTileGenerateConfig = {
        buffer: config.buffer,
        minZoom: config.minZoom,
        maxZoom: config.maxZoom,
        metadataEnabled: config.metadataEnabled,
        metadataReplace: config.metadataReplace,
        metadataContext: config.metadataContext,
        signal: controller?.signal,
      };
      const inputFormat = config.inputFormat ?? 'geojson';
      if (inputFormat === 'flatgeobuf') {
        return generateVectorTilesFromFgbBuffer(nodeId, inputBuffer, sdkConfig, onProgress);
      }
      return generateVectorTilesFromJsonBuffer(nodeId, inputBuffer, sdkConfig, onProgress);
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
  extract: ExtractWorkerAPI;
  vectortile: VectorTileWorkerAPI;
};

let singleton: StageProcessingService | null = null;

export async function getStageProcessingService(): Promise<StageProcessingService> {
  if (!singleton) {
    singleton = {
      download: new RealDownloadWorker(),
      extract: new RealExtractWorker(),
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

let comlinkModule: typeof import('comlink') | null = null;

const getComlinkModule = async (): Promise<typeof import('comlink')> => {
  if (!comlinkModule) {
    comlinkModule = (await import('comlink')) as typeof import('comlink');
  }
  return comlinkModule;
};

export async function getStageWorkerProxy<T extends (...args: never[]) => unknown>(
  handler: T,
): Promise<T> {
  const mod = await getComlinkModule();
  return mod.proxy(handler) as T;
}

// Comlink-based client factory for browser Worker threads
export async function createStageWorkerClient(): Promise<StageProcessingService> {
  // Note: stageWorker.entry is built to JS and emitted alongside index.ts
  const worker = new Worker(new URL('./stageWorker.entry.js', import.meta.url), { type: 'module' });
  const mod = await getComlinkModule();
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
