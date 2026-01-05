import type { VectorTileProgress, VectorTileWorkerAPI } from '../types.js';
import { DexieChunkStore } from '@hierarchidb/chunk-store';
import type { NodeId } from '@hierarchidb/common-types';
import { getEphemeralShapeDB } from '@hierarchidb/shape-store';

export type VectorTileStageInput = {
  bufferId: string;
  buffer?: ArrayBuffer;
  contentType?: string;
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
  };
  onProgress?: (progress: VectorTileProgress) => void;
};

export type VectorTileStageResult = {
  generated: Awaited<ReturnType<VectorTileWorkerAPI['generateTiles']>>;
  tiles: Awaited<ReturnType<VectorTileWorkerAPI['listTiles']>>;
};

export type VectorTileStageOptions = {
  chunkStoreName?: string;
  nodeId?: NodeId;
  tileId?: string;
  storage?: 'chunk-store' | 'ephemeral';
};

const DEFAULT_NODE_ID = 'vectortile-shared' as NodeId;
const DEFAULT_CHUNK_STORE = 'hidb-chunks';

type VectorTileInputFormat = 'geojson' | 'flatgeobuf';
type VectorTileInputCompression = 'gzip' | 'none';

const resolveInputContentType = (
  inputFormat: VectorTileInputFormat,
  inputCompression: VectorTileInputCompression,
): string => {
  const base = inputFormat === 'flatgeobuf' ? 'application/flatgeobuf' : 'application/geo+json';
  return inputCompression === 'gzip' ? `${base}+gzip` : base;
};

const compressBuffer = async (
  buffer: ArrayBuffer,
  inputCompression: VectorTileInputCompression,
): Promise<ArrayBuffer> => {
  if (inputCompression !== 'gzip') return buffer;
  if (typeof CompressionStream !== 'function') {
    throw new Error('CompressionStream is not available for gzip input compression');
  }
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  await writer.write(new Uint8Array(buffer));
  await writer.close();
  return new Response(stream.readable).arrayBuffer();
};

export async function writeVectorTileInput(
  bufferId: string,
  buffer: ArrayBuffer,
  contentTypeOrOptions: string | {
    contentType?: string;
    inputFormat?: VectorTileInputFormat;
    inputCompression?: VectorTileInputCompression;
    nodeId?: NodeId;
    tileId?: string;
    storage?: 'chunk-store' | 'ephemeral';
    chunkStoreName?: string;
  } = 'application/json',
): Promise<void> {
  const options = typeof contentTypeOrOptions === 'string' ? null : contentTypeOrOptions;
  const inputFormat = options?.inputFormat ?? 'geojson';
  const inputCompression = options?.inputCompression ?? 'none';
  const contentType = (typeof contentTypeOrOptions === 'string'
    ? contentTypeOrOptions
    : options?.contentType
  ) ?? resolveInputContentType(inputFormat, inputCompression);
  const nodeId = options?.nodeId ?? DEFAULT_NODE_ID;
  const tileId = options?.tileId ?? bufferId;
  const storage = options?.storage ?? 'chunk-store';
  const payload = await compressBuffer(buffer, inputCompression);
  if (storage === 'ephemeral') {
    const db = getEphemeralShapeDB();
    await db.vectorTileSourceBuffers.put({
      id: bufferId,
      nodeId,
      tileId,
      data: payload,
      size: payload.byteLength,
      timestamp: Date.now(),
      contentType,
    });
    return;
  }
  const resolvedChunkStoreName = options?.chunkStoreName ?? DEFAULT_CHUNK_STORE;
  const storageAdapter = new DexieChunkStore<ArrayBuffer>({
    dbName: resolvedChunkStoreName,
    serializer: (value) => value,
    deserializer: (value) => value,
    networkOptions: {
      auth: { enabled: false },
    },
  });
  await storageAdapter.setForNode(nodeId, bufferId, payload, {
    sizeBytes: payload.byteLength,
    contentType,
    fetchedAt: Date.now(),
  });
}

export async function runVectorTileStage(
  input: VectorTileStageInput,
  client: VectorTileWorkerAPI,
  options: VectorTileStageOptions = {},
): Promise<VectorTileStageResult> {
  const { bufferId, buffer, contentType, config, onProgress } = input;
  if (buffer) {
    const inputFormat = config.inputFormat ?? 'geojson';
    const inputCompression = config.inputCompression ?? 'none';
    const nodeId = options.nodeId ?? config.targetNodeId ?? DEFAULT_NODE_ID;
    const tileId = options.tileId ?? bufferId;
    await writeVectorTileInput(
      bufferId,
      buffer,
      {
        contentType,
        inputFormat,
        inputCompression,
        nodeId,
        tileId,
        storage: options.storage ?? 'chunk-store',
        chunkStoreName: options.chunkStoreName ?? DEFAULT_CHUNK_STORE,
      },
    );
  }
  const generated = await client.generateTiles(bufferId, config, onProgress);
  const resolvedNodeId = config.targetNodeId ?? (bufferId as NodeId);
  const tiles = await client.listTiles(resolvedNodeId, config.targetNodeType);
  return { generated, tiles };
}
