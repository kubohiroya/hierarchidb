import { DexieChunkStore } from '@hierarchidb/chunk-store';
import type { NodeId } from '@hierarchidb/core-types';
import type { TileEmitWorkerAPI, VectorTileProgress } from '~/types';

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
  generated: Awaited<ReturnType<TileEmitWorkerAPI['generateTiles']>>;
  tiles: Awaited<ReturnType<TileEmitWorkerAPI['listTiles']>>;
};

export type VectorTileStageOptions = {
  chunkStoreName: string;
  nodeId?: NodeId;
  tileId?: string;
};

export type VectorTileInputWriteOptions = {
  chunkStoreName: string;
  contentType?: string;
  inputFormat?: VectorTileInputFormat;
  inputCompression?: VectorTileInputCompression;
  nodeId?: NodeId;
  tileId?: string;
};

const DEFAULT_NODE_ID = 'tile-emit-shared' as NodeId;

type VectorTileInputFormat = 'geojson' | 'flatgeobuf';
type VectorTileInputCompression = 'gzip' | 'none';

const resolveInputContentType = (
  inputFormat: VectorTileInputFormat,
  inputCompression: VectorTileInputCompression
): string => {
  const base = inputFormat === 'flatgeobuf' ? 'application/flatgeobuf' : 'application/geo+json';
  return inputCompression === 'gzip' ? `${base}+gzip` : base;
};

const compressBuffer = async (
  buffer: ArrayBuffer,
  inputCompression: VectorTileInputCompression
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
  options: VectorTileInputWriteOptions
): Promise<void> {
  const inputFormat = options.inputFormat ?? 'geojson';
  const inputCompression = options.inputCompression ?? 'none';
  const contentType = options.contentType ?? resolveInputContentType(inputFormat, inputCompression);
  const nodeId = options.nodeId ?? DEFAULT_NODE_ID;
  const payload = await compressBuffer(buffer, inputCompression);
  const storageAdapter = new DexieChunkStore<ArrayBuffer>({
    dbName: options.chunkStoreName,
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
  client: TileEmitWorkerAPI,
  options: VectorTileStageOptions
): Promise<VectorTileStageResult> {
  const { bufferId, buffer, contentType, config, onProgress } = input;
  if (buffer) {
    const inputFormat = config.inputFormat ?? 'geojson';
    const inputCompression = config.inputCompression ?? 'none';
    const nodeId = options.nodeId ?? config.targetNodeId ?? DEFAULT_NODE_ID;
    const tileId = options.tileId ?? bufferId;
    await writeVectorTileInput(bufferId, buffer, {
      contentType,
      inputFormat,
      inputCompression,
      nodeId,
      tileId,
      chunkStoreName: options.chunkStoreName,
    });
  }
  const generated = await client.generateTiles(bufferId, config, onProgress);
  const resolvedNodeId = config.targetNodeId ?? (bufferId as NodeId);
  const tiles = await client.listTiles(resolvedNodeId, config.targetNodeType);
  return { generated, tiles };
}
