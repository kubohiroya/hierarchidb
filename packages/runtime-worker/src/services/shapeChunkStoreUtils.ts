import {
  type ChunkStoreDeserializer,
  type ChunkStoreMetadata,
  type ChunkStoreSerializer,
  DexieChunkStore,
} from '@hierarchidb/chunk-store';
import type { NodeId } from '@hierarchidb/core-types';

const bufferSerializer: ChunkStoreSerializer<ArrayBuffer> = (value) => value;
const bufferDeserializer: ChunkStoreDeserializer<ArrayBuffer> = (value) => value;

const RAW_DATA_DEFAULT_CONTENT_TYPE = 'application/octet-stream';
const RAW_DATA_CACHE_PREFIX = 'download:';

const createShapeChunkStore = (databaseName: string): DexieChunkStore<ArrayBuffer> =>
  new DexieChunkStore<ArrayBuffer>({
    dbName: databaseName,
    serializer: bufferSerializer,
    deserializer: bufferDeserializer,
  });

const decompressGzip = async (buffer: ArrayBuffer): Promise<ArrayBuffer> => {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('DecompressionStream is not available for gzip raw data buffers');
  }
  const stream = new DecompressionStream('gzip');
  const writer = stream.writable.getWriter();
  await writer.write(new Uint8Array(buffer));
  await writer.close();
  return new Response(stream.readable).arrayBuffer();
};

export const readRawDataDataSourceBuffer = async (
  databaseName: string,
  nodeId: NodeId,
  cacheKey: string
): Promise<ArrayBuffer | null> => {
  const store = createShapeChunkStore(databaseName);
  const hasRelation = await store.hasRelationForNode(nodeId, cacheKey);
  if (!hasRelation) return null;
  const entry = await store.get(cacheKey);
  if (!entry) return null;
  const contentType = entry.metadata?.contentType ?? '';
  if (contentType.includes('+gzip')) {
    return await decompressGzip(entry.value);
  }
  return entry.value;
};

export const storeRawDataDataSourceBufferForNode = async (params: {
  databaseName: string;
  nodeId: NodeId;
  cacheKey: string;
  buffer: ArrayBuffer;
  contentType?: string;
}): Promise<{ contentType: string; sizeBytes: number }> => {
  const { nodeId, cacheKey, buffer } = params;
  const store = createShapeChunkStore(params.databaseName);
  const resolvedContentType = params.contentType ?? RAW_DATA_DEFAULT_CONTENT_TYPE;
  await store.setForNode(nodeId, cacheKey, buffer, {
    sizeBytes: buffer.byteLength,
    contentType: resolvedContentType,
    fetchedAt: Date.now(),
  });
  return { contentType: resolvedContentType, sizeBytes: buffer.byteLength };
};

export const listRawDataDataSourceMetadataForNode = async (
  databaseName: string,
  nodeId: NodeId
): Promise<ChunkStoreMetadata[]> => {
  const store = createShapeChunkStore(databaseName);
  return store.listMetadataForNode(nodeId);
};

export const countSourceDataSourceBuffersForNode = async (
  databaseName: string,
  nodeId: NodeId
): Promise<number> => {
  const metadata = await listRawDataDataSourceMetadataForNode(databaseName, nodeId);
  return metadata.filter((entry) => entry.cacheKey?.startsWith(RAW_DATA_CACHE_PREFIX)).length;
};

export const hasRawDataDataSourceBuffer = async (
  databaseName: string,
  nodeId: NodeId,
  cacheKey: string
): Promise<boolean> => {
  const store = createShapeChunkStore(databaseName);
  return store.hasRelationForNode(nodeId, cacheKey);
};
