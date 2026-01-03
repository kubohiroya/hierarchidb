import type { VectorTileWorkerAPI } from '../types.js';
import type { VectorTileProgress } from '@hierarchidb/gis-sdk';
import type { NodeId } from '@hierarchidb/common-types';
import { DexieChunkStore } from '@hierarchidb/chunk-store';

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
    targetNodeId?: string;
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
};

const DEFAULT_CHUNK_STORE = 'hidb-chunks';
const DEFAULT_NODE_ID = 'vectortile-shared' as NodeId;

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
    chunkStoreName?: string;
    inputFormat?: VectorTileInputFormat;
    inputCompression?: VectorTileInputCompression;
    nodeId?: NodeId;
  } = 'application/json',
  chunkStoreName = DEFAULT_CHUNK_STORE,
): Promise<void> {
  const options = typeof contentTypeOrOptions === 'string' ? null : contentTypeOrOptions;
  const inputFormat = options?.inputFormat ?? 'geojson';
  const inputCompression = options?.inputCompression ?? 'none';
  const contentType = (typeof contentTypeOrOptions === 'string'
    ? contentTypeOrOptions
    : options?.contentType
  ) ?? resolveInputContentType(inputFormat, inputCompression);
  const resolvedChunkStoreName = options?.chunkStoreName ?? chunkStoreName;
  const nodeId = options?.nodeId ?? DEFAULT_NODE_ID;
  const payload = await compressBuffer(buffer, inputCompression);
  const storage = new DexieChunkStore<ArrayBuffer>({
    dbName: resolvedChunkStoreName,
    serializer: (value) => value,
    deserializer: (value) => value,
  });
  await storage.setForNode(nodeId, bufferId, payload, {
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
    await writeVectorTileInput(
      bufferId,
      buffer,
      {
        contentType,
        inputFormat,
        inputCompression,
        chunkStoreName: options.chunkStoreName ?? DEFAULT_CHUNK_STORE,
        nodeId,
      },
    );
  }
  const generated = await client.generateTiles(bufferId, config, onProgress);
  const tiles = await client.listTiles(bufferId);
  return { generated, tiles };
}
