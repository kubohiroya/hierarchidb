import type { NodeId } from '@hierarchidb/common-types';
import {
  DexieChunkStore,
  type ChunkStoreMetadata,
  type ChunkStoreDeserializer,
  type ChunkStoreSerializer,
} from '@hierarchidb/chunk-store';

const bufferSerializer: ChunkStoreSerializer<ArrayBuffer> = (value) => value;
const bufferDeserializer: ChunkStoreDeserializer<ArrayBuffer> = (value) => value;

const DOWNLOAD_CONTENT_TYPE = 'application/flatgeobuf';

const createShapeChunkStore = (): DexieChunkStore<ArrayBuffer> => (
  new DexieChunkStore<ArrayBuffer>({
    dbName: 'shape-chunks',
    serializer: bufferSerializer,
    deserializer: bufferDeserializer,
  })
);

const decompressGzip = async (buffer: ArrayBuffer): Promise<ArrayBuffer> => {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('DecompressionStream is not available for gzip download buffers');
  }
  const stream = new DecompressionStream('gzip');
  const writer = stream.writable.getWriter();
  await writer.write(new Uint8Array(buffer));
  await writer.close();
  return new Response(stream.readable).arrayBuffer();
};

export const readDownloadBuffer = async (nodeId: NodeId, cacheKey: string): Promise<ArrayBuffer | null> => {
  const store = createShapeChunkStore();
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

export const storeDownloadBufferForNode = async (params: {
  nodeId: NodeId;
  cacheKey: string;
  buffer: ArrayBuffer;
}): Promise<{ contentType: string; sizeBytes: number }> => {
  const { nodeId, cacheKey, buffer } = params;
  const store = createShapeChunkStore();
  await store.setForNode(nodeId, cacheKey, buffer, {
    sizeBytes: buffer.byteLength,
    contentType: DOWNLOAD_CONTENT_TYPE,
    fetchedAt: Date.now(),
  });
  return { contentType: DOWNLOAD_CONTENT_TYPE, sizeBytes: buffer.byteLength };
};

export const listDownloadMetadataForNode = async (nodeId: NodeId): Promise<ChunkStoreMetadata[]> => {
  const store = createShapeChunkStore();
  return store.listMetadataForNode(nodeId);
};

export const countDownloadBuffersForNode = async (nodeId: NodeId): Promise<number> => {
  const store = createShapeChunkStore();
  return store.countForNode(nodeId);
};

export const hasDownloadBuffer = async (nodeId: NodeId, cacheKey: string): Promise<boolean> => {
  const store = createShapeChunkStore();
  return store.hasRelationForNode(nodeId, cacheKey);
};
