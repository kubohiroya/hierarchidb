import type { NodeId } from '@hierarchidb/core-types';
import {
  generateVectorTilesFromFgbBuffer,
  generateVectorTilesFromJsonBuffer,
  type VectorTileRow,
  type VTGenerateConfig,
} from '@hierarchidb/gis-sdk';
import { type LayerInfo, shapeDB } from '@hierarchidb/shape-store';
import type { FeatureMetadataRow } from '@hierarchidb/vectortile-store';
import type { VectorTileItemBase } from '../entity/store.js';
import { getRouteDB } from '@hierarchidb/route-store';
import type {
  FetchWorkerAPI,
  TransformWorkerAPI,
  VectorTileProgress,
  VTWorkerAPI,
} from '../types.js';
import type { SharedFetchService } from './downloadAdapter.js';
import { createSharedDownloadService } from './downloadAdapter.js';
import { ShapeMutationService } from './ShapeMutationService.js';

const buildShapeTileId = (nodeId: NodeId, z: number, x: number, y: number): string =>
  `${nodeId}-${z}-${x}-${y}`;

const ensureShapeVectorTileStore = async (): Promise<void> => {
  await shapeDB.open?.();
};

type VectorTileStoreItem = VectorTileItemBase & {
  z: number;
  x: number;
  y: number;
  size?: number;
  timestamp?: number;
  generatedAt?: number;
  data?: ArrayBuffer | Uint8Array;
  data_Uint8Array?: Uint8Array;
  features?: number;
  layers?: LayerInfo[];
  contentHash?: string;
  contentEncoding?: 'gzip' | 'br';
  version?: number;
};

/**
 * StageProcessingService
 * Minimal worker-side surface for shape-plugin processing stages.
 *
 * NOTE: These are placeholders to define the contract and allow client wiring.
 *       Implementations can be incrementally replaced with real worker logic.
 */

class RealFetchWorker implements FetchWorkerAPI {
  private sharedPromise: Promise<SharedFetchService> | null = null;

  private async getShared(): Promise<SharedFetchService> {
    if (!this.sharedPromise) {
      this.sharedPromise = createSharedDownloadService({
        dbPrefix: 'hidb',
        perHostConcurrency: 4,
        scope: 'shape',
      });
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

class RealTransformWorker implements TransformWorkerAPI {
  async transformStage(inputBufferId: string, _config: { tolerance: number; minArea: number }) {
    const out = `${inputBufferId}-s1`;
    bufferRegistry.set(out, { parent: inputBufferId, stage: 's1', ts: Date.now() });
    return { outputBufferId: out };
  }
  async transformStage2(
    inputBufferId: string,
    _config: { zoomLevels: number[]; tileSize: number }
  ) {
    const out = `${inputBufferId}-s2`;
    bufferRegistry.set(out, { parent: inputBufferId, stage: 's2', ts: Date.now() });
    return { outputBufferId: out };
  }
}

class RealVTWorker implements VTWorkerAPI {
  private sharedPromise: Promise<SharedFetchService> | null = null;
  private readonly abortControllers = new Map<string, AbortController>();

  private async getShared(): Promise<SharedFetchService> {
    if (!this.sharedPromise) {
      this.sharedPromise = createSharedDownloadService({
        dbPrefix: 'hidb',
        perHostConcurrency: 2,
        scope: 'shape',
      });
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
    return null;
  }

  private async decodeInputBuffer(
    buffer: ArrayBuffer,
    inputCompression?: 'gzip' | 'none'
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
    tiles: VectorTileRow[]
  ): Promise<void> {
    if (!tiles.length) return;
    const resolvedNodeId = nodeId;
    const now = Date.now();
    if (nodeType === 'shape') {
      await shapeDB.open?.();
      const rows = await Promise.all(
        tiles.map(async (tile) => {
          const contentHash = await this.hashBytes(tile.data);
          return {
            tileId: buildShapeTileId(resolvedNodeId, tile.z, tile.x, tile.y),
            nodeId: resolvedNodeId,
            z: tile.z,
            x: tile.x,
            y: tile.y,
            data_Uint8Array: tile.data,
            size: tile.size,
            features: 0,
            layers: [] as LayerInfo[],
            generatedAt: now,
            contentHash,
            contentEncoding: undefined,
            version: 1,
          };
        })
      );
      await shapeDB.vectorTiles.bulkPut(rows);
      await shapeDB.rebuildVectorTileSummary(resolvedNodeId);
      return;
    }
    if (nodeType === 'route') {
      const db = getRouteDB();
      await db.open?.();
      const rows = tiles.map((tile) => ({
        tileId: `${resolvedNodeId}-${tile.z}-${tile.x}-${tile.y}`,
        nodeId: resolvedNodeId,
        z: tile.z,
        x: tile.x,
        y: tile.y,
        data: tile.data.buffer.slice(
          tile.data.byteOffset,
          tile.data.byteOffset + tile.data.byteLength
        ),
        size: tile.size,
        contentType: tile.contentType ?? 'application/vnd.mapbox-vector-tile',
        timestamp: now,
      }));
      await db.vectorTiles.bulkPut(rows);
      return;
    }
    console.warn('[VectorTiles] unsupported nodeType', { nodeType });
  }

  private async storeFeatureMetadata(
    nodeType: string,
    nodeId: NodeId,
    featureMetadata?: FeatureMetadataRow[],
    replace?: boolean
  ): Promise<void> {
    if (nodeType !== 'shape' || !featureMetadata || featureMetadata.length === 0) return;
    const mutation = await ShapeMutationService.getSingleton(shapeDB);
    if (replace) {
      await mutation.deleteFeatureMetadataByNode(nodeId);
    }
    await mutation.putFeatureMetadata(featureMetadata);
  }

  async storeTiles(
    nodeId: NodeId,
    nodeType: string,
    tiles: Array<{
      z: number;
      x: number;
      y: number;
      data: Uint8Array;
      size: number;
      contentType?: 'application/vnd.mapbox-vector-tile';
      timestamp?: number;
    }>,
    metadata?: {
      featureMetadata?: FeatureMetadataRow[];
      metadataReplace?: boolean;
    }
  ): Promise<{ tilesStored: number }> {
    if (!tiles.length) return { tilesStored: 0 };
    const resolvedNodeType = this.resolveNodeType(nodeType);
    const now = Date.now();
    const normalizedTiles: VectorTileRow[] = tiles.map((tile) => ({
      ...tile,
      contentType: tile.contentType ?? 'application/vnd.mapbox-vector-tile',
      timestamp: tile.timestamp ?? now,
    }));
    await this.storeVectorTiles(resolvedNodeType, nodeId, normalizedTiles);
    if (metadata?.featureMetadata?.length) {
      await this.storeFeatureMetadata(
        resolvedNodeType,
        nodeId,
        metadata.featureMetadata,
        metadata.metadataReplace
      );
    }
    return { tilesStored: normalizedTiles.length };
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
    onProgress?: (progress: VectorTileProgress) => void
  ) {
    const startedAt = Date.now();
    const shouldLogDebug =
      typeof console !== 'undefined' &&
      typeof console.debug === 'function' &&
      !(globalThis as { __HDB_SILENCE_WORKER_LOGS__?: boolean })
        .__HDB_SILENCE_WORKER_LOGS__;
    const abortKey = config.abortKey;
    const controller = abortKey ? new AbortController() : null;
    if (abortKey && controller) {
      this.abortControllers.set(abortKey, controller);
    }
    try {
      const readStart = Date.now();
      const buf = await this.readBuffer(inputBufferId);
      if (shouldLogDebug) {
        console.debug('[VectorTiles] readInputBuffer', {
          bufferId: inputBufferId,
          ms: Date.now() - readStart,
        });
      }
      if (!buf) return { tilesGenerated: 0, totalBytes: 0 };
      const decodeStart = Date.now();
      const inputBuffer = await this.decodeInputBuffer(buf, config.inputCompression);
      if (shouldLogDebug) {
        console.debug('[VectorTiles] decodeInputBuffer', { ms: Date.now() - decodeStart });
      }
      const nodeId = (config.targetNodeId ??
        (inputBufferId.includes('-extract2-')
          ? inputBufferId.substring(0, inputBufferId.lastIndexOf('-extract2-'))
          : inputBufferId)) as NodeId;
      const sdkConfig: VTGenerateConfig = {
        buffer: config.buffer,
        minZoom: config.minZoom,
        maxZoom: config.maxZoom,
        metadataEnabled: config.metadataEnabled,
        metadataReplace: config.metadataReplace,
        metadataContext: config.metadataContext,
        geometryEngine: config.geometryEngine,
        signal: controller?.signal,
      };
      const inputFormat = config.inputFormat ?? 'geojson';
      const nodeType = this.resolveNodeType(config.targetNodeType);
      if (inputFormat === 'flatgeobuf') {
        const genStart = Date.now();
        const result = await generateVectorTilesFromFgbBuffer(
          nodeId,
          inputBuffer,
          sdkConfig,
          onProgress
        );
        if (shouldLogDebug) {
          console.debug('[VectorTiles] generateFromFgb', {
            tilesGenerated: result.tilesGenerated,
            totalBytes: result.totalBytes,
            ms: Date.now() - genStart,
          });
        }
        const storeStart = Date.now();
        await this.storeVectorTiles(nodeType, nodeId, result.tiles);
        if (shouldLogDebug) {
          console.debug('[VectorTiles] storeTiles', { ms: Date.now() - storeStart });
        }
        const metaStart = Date.now();
        await this.storeFeatureMetadata(
          nodeType,
          nodeId,
          result.featureMetadata,
          config.metadataReplace
        );
        if (shouldLogDebug) {
          console.debug('[VectorTiles] storeMetadata', { ms: Date.now() - metaStart });
        }
        return {
          tilesGenerated: result.tilesGenerated,
          totalBytes: result.totalBytes,
          metadataCount: result.metadataCount,
        };
      }
      const genStart = Date.now();
      const result = await generateVectorTilesFromJsonBuffer(
        nodeId,
        inputBuffer,
        sdkConfig,
        onProgress
      );
      if (shouldLogDebug) {
        console.debug('[VectorTiles] generateFromJson', {
          tilesGenerated: result.tilesGenerated,
          totalBytes: result.totalBytes,
          ms: Date.now() - genStart,
        });
      }
      const storeStart = Date.now();
      await this.storeVectorTiles(nodeType, nodeId, result.tiles);
      if (shouldLogDebug) {
        console.debug('[VectorTiles] storeTiles', { ms: Date.now() - storeStart });
      }
      const metaStart = Date.now();
      await this.storeFeatureMetadata(
        nodeType,
        nodeId,
        result.featureMetadata,
        config.metadataReplace
      );
      if (shouldLogDebug) {
        console.debug('[VectorTiles] storeMetadata', { ms: Date.now() - metaStart });
      }
      if (shouldLogDebug) {
        console.debug('[VectorTiles] generateTiles total', { ms: Date.now() - startedAt });
      }
      return {
        tilesGenerated: result.tilesGenerated,
        totalBytes: result.totalBytes,
        metadataCount: result.metadataCount,
      };
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
    const resolvedType = this.resolveNodeType(nodeType);
    if (resolvedType === 'shape') {
      await shapeDB.open?.();
      const tile = await shapeDB.vectorTiles
        .where('[nodeId+z+x+y]')
        .equals([nodeId, z, x, y])
        .first();
      return tile?.data_Uint8Array ?? null;
    }
    if (resolvedType === 'route') {
      const db = getRouteDB();
      await db.open?.();
      const tile = await db.vectorTiles
        .where('[nodeId+z+x+y]')
        .equals([nodeId, z, x, y])
        .first();
      return tile?.data ? new Uint8Array(tile.data) : null;
    }
    return null;
  }

  async listTiles(nodeId: NodeId, nodeType?: string) {
    const resolvedType = this.resolveNodeType(nodeType);
    if (resolvedType === 'shape') {
      await shapeDB.open?.();
      const items = await shapeDB.vectorTiles.where('nodeId').equals(nodeId).toArray();
      return items.map((entry) => ({
        z: Number(entry.z),
        x: Number(entry.x),
        y: Number(entry.y),
        size: entry.size ?? 0,
        timestamp: entry.generatedAt ?? Date.now(),
      }));
    }
    if (resolvedType === 'route') {
      const db = getRouteDB();
      await db.open?.();
      const items = await db.vectorTiles.where('nodeId').equals(nodeId).toArray();
      return items.map((entry) => ({
        z: Number(entry.z),
        x: Number(entry.x),
        y: Number(entry.y),
        size: entry.size ?? 0,
        timestamp: entry.timestamp ?? Date.now(),
      }));
    }
    return [];
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
  download: FetchWorkerAPI;
  extract: TransformWorkerAPI;
  vectortile: VTWorkerAPI;
};

let singleton: StageProcessingService | null = null;

export async function getStageProcessingService(): Promise<StageProcessingService> {
  if (!singleton) {
    await ensureShapeVectorTileStore();
    singleton = {
      download: new RealFetchWorker(),
      extract: new RealTransformWorker(),
      vectortile: new RealVTWorker(),
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
  handler: T
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
