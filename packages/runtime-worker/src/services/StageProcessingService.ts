import type { DownloadWorkerAPI, ExtractWorkerAPI, VectorTileProgress, VectorTileWorkerAPI } from '../types.js';
import {
  generateVectorTilesFromFgbBuffer,
  generateVectorTilesFromJsonBuffer,
  type VectorTileGenerateConfig,
  type VectorTileRow,
} from '@hierarchidb/gis-sdk';
import { storeRegistry } from '../entity/store-registry.js';
import type { VectorTileItemBase } from '../entity/store.js';
import { getEphemeralShapeDB, shapeDB } from '@hierarchidb/shape-store';
import { ShapeMutationService } from './ShapeMutationService.js';
import type { NodeId } from '@hierarchidb/common-types';
import type { FeatureMetadataRow } from '@hierarchidb/vectortile-store';

import type { SharedDownloadService } from './downloadAdapter.js';
import { createSharedDownloadService } from './downloadAdapter.js';

const getEphemeralDb = () => getEphemeralShapeDB();

type VectorTileStoreItem = VectorTileItemBase & {
  z: number;
  x: number;
  y: number;
  size?: number;
  timestamp?: number;
  generatedAt?: number;
  data?: ArrayBuffer | Uint8Array;
  data_Uint8Array?: Uint8Array;
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
    const tileInput = await db.vectorTileSourceBuffers.get(fileId);
    if (tileInput?.data) return tileInput.data;
    const extract2 = await db.extract2SourceBuffers.get(fileId);
    if (extract2?.data) return extract2.data;
    const extract1 = await db.extractedBuffers.get(fileId);
    return extract1?.data ?? null;
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

  private resolveNodeType(nodeType?: string): string {
    return nodeType ?? 'shape';
  }

  private async hashBytes(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data as ArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private async storeVectorTiles(
    nodeType: string,
    nodeId: NodeId,
    tiles: VectorTileRow[],
  ): Promise<void> {
    if (!tiles.length) return;
    const store = storeRegistry.getVectorTiles(nodeType);
    if (!store) {
      console.warn('[VectorTiles] store missing for nodeType', { nodeType });
      return;
    }
    const resolvedNodeId = nodeId;
    const now = Date.now();
    const items = await Promise.all(tiles.map(async (tile) => {
      const base = {
        id: `${nodeId}-${tile.z}-${tile.x}-${tile.y}`,
        z: tile.z,
        x: tile.x,
        y: tile.y,
      };
      if (nodeType === 'shape') {
        const contentHash = await this.hashBytes(tile.data);
        return {
          ...base,
          data_Uint8Array: tile.data,
          size: tile.size,
          features: 0,
          layers: [],
          generatedAt: now,
          contentHash,
          version: 1,
        };
      }
      if (nodeType === 'location') {
        const hash = await this.hashBytes(tile.data);
        return {
          ...base,
          data: tile.data.buffer.slice(tile.data.byteOffset, tile.data.byteOffset + tile.data.byteLength),
          size: tile.size,
          hash,
          featureCount: 0,
          timestamp: now,
          contentType: tile.contentType,
        };
      }
      return {
        ...base,
        data: tile.data.buffer.slice(tile.data.byteOffset, tile.data.byteOffset + tile.data.byteLength),
        size: tile.size,
        contentType: tile.contentType,
        timestamp: now,
      };
    }));
    await store.bulkUpsert(resolvedNodeId, items);
  }

  private async storeFeatureMetadata(
    nodeType: string,
    nodeId: NodeId,
    featureMetadata?: FeatureMetadataRow[],
    replace?: boolean,
  ): Promise<void> {
    if (nodeType !== 'shape' || !featureMetadata || featureMetadata.length === 0) return;
    const mutation = await ShapeMutationService.getSingleton(shapeDB);
    if (replace) {
      await mutation.deleteFeatureMetadataByNode(nodeId);
    }
    await mutation.putFeatureMetadata(featureMetadata);
  }

  private resolveItemBytes(item: VectorTileStoreItem): Uint8Array | null {
    const direct = item.data;
    if (direct instanceof Uint8Array) return direct;
    if (direct instanceof ArrayBuffer) return new Uint8Array(direct);
    const typed = item.data_Uint8Array;
    if (typed instanceof Uint8Array) return typed;
    return null;
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
      targetNodeId?: NodeId;
      targetNodeType?: string;
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
      const nodeId = (config.targetNodeId
        ?? (inputBufferId.includes('-extract2-')
          ? inputBufferId.substring(0, inputBufferId.lastIndexOf('-extract2-'))
          : inputBufferId)) as NodeId;
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
      const nodeType = this.resolveNodeType(config.targetNodeType);
      if (inputFormat === 'flatgeobuf') {
        const result = await generateVectorTilesFromFgbBuffer(nodeId, inputBuffer, sdkConfig, onProgress);
        await this.storeVectorTiles(nodeType, nodeId, result.tiles);
        await this.storeFeatureMetadata(nodeType, nodeId, result.featureMetadata, config.metadataReplace);
        return { tilesGenerated: result.tilesGenerated, totalBytes: result.totalBytes, metadataCount: result.metadataCount };
      }
      const result = await generateVectorTilesFromJsonBuffer(nodeId, inputBuffer, sdkConfig, onProgress);
      await this.storeVectorTiles(nodeType, nodeId, result.tiles);
      await this.storeFeatureMetadata(nodeType, nodeId, result.featureMetadata, config.metadataReplace);
      return { tilesGenerated: result.tilesGenerated, totalBytes: result.totalBytes, metadataCount: result.metadataCount };
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

  async getTile(nodeId: NodeId, z: number, x: number, y: number, nodeType?: string) {
    const store = storeRegistry.getVectorTiles<VectorTileStoreItem>(this.resolveNodeType(nodeType));
    if (!store) return null;
    const items = await store.list(nodeId);
    const item = items.find((entry) => entry.z === z && entry.x === x && entry.y === y);
    const bytes = item ? this.resolveItemBytes(item) : null;
    return bytes;
  }

  async listTiles(nodeId: NodeId, nodeType?: string) {
    const store = storeRegistry.getVectorTiles<VectorTileStoreItem>(this.resolveNodeType(nodeType));
    if (!store) return [];
    const items = await store.list(nodeId);
    return items
      .map((entry) => {
        const bytes = this.resolveItemBytes(entry);
        const size = typeof entry.size === 'number' ? entry.size : (bytes?.byteLength ?? 0);
        const timestamp = typeof entry.timestamp === 'number'
          ? entry.timestamp
          : (typeof entry.generatedAt === 'number' ? entry.generatedAt : Date.now());
        return {
          z: Number(entry.z),
          x: Number(entry.x),
          y: Number(entry.y),
          size,
          timestamp,
        };
      })
      .filter((entry) => Number.isFinite(entry.z) && Number.isFinite(entry.x) && Number.isFinite(entry.y));
  }

  async getSummary(nodeId: NodeId, nodeType?: string) {
    const tiles = await this.listTiles(nodeId, nodeType);
    if (tiles.length === 0) return { tiles: 0, totalBytes: 0 };
    const totalBytes = tiles.reduce((sum, tile) => sum + tile.size, 0);
    const zoomMin = Math.min(...tiles.map((tile) => tile.z));
    const zoomMax = Math.max(...tiles.map((tile) => tile.z));
    return { tiles: tiles.length, totalBytes, zoomMin, zoomMax };
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
