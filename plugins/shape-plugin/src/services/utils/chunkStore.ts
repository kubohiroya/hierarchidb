import type { NodeId } from '@hierarchidb/common-types';
import {
  DexieChunkStore,
  type ChunkStoreMetadata,
  type ChunkStoreDeserializer,
  type ChunkStoreEntry,
  type ChunkStoreFetchOptions,
  type ChunkStoreSerializer,
} from '@hierarchidb/chunk-store';
import { FetchNetworkPort, type FetchNetworkPortOptions, getCorsProxyBaseURL } from '@hierarchidb/download';
import { sleep } from '@hierarchidb/util';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let sharedNet: FetchNetworkPort | null = null;

// Auth is handled inside FetchNetworkPort via @hierarchidb/download smartFetch → AuthService.

export const createShapeNetworkPort = (options: FetchNetworkPortOptions = {}): FetchNetworkPort => {
  const corsProxyBaseURL = getCorsProxyBaseURL() || undefined;
  return new FetchNetworkPort({
    perHostConcurrency: 4,
    corsProxyBaseURL,
    auth: { scope: 'shape' },
    ...options,
  });
};

const getShapeNetworkPort = (): FetchNetworkPort => {
  if (sharedNet) return sharedNet;
  sharedNet = createShapeNetworkPort();
  return sharedNet;
};

export const createShapeChunkStore = <T>(
  serializer: ChunkStoreSerializer<T>,
  deserializer: ChunkStoreDeserializer<T>,
): DexieChunkStore<T> => (
  new DexieChunkStore<T>({
    dbName: 'shape-chunks',
    serializer,
    deserializer,
    networkPort: getShapeNetworkPort(),
  })
);

export const createShapeChunkStoreWithNetworkPort = <T>(
  serializer: ChunkStoreSerializer<T>,
  deserializer: ChunkStoreDeserializer<T>,
  networkPort: FetchNetworkPort,
): DexieChunkStore<T> => (
  new DexieChunkStore<T>({
    dbName: 'shape-chunks',
    serializer,
    deserializer,
    networkPort,
  })
);

export const jsonSerializer = (value: unknown): ArrayBuffer => (
  textEncoder.encode(JSON.stringify(value)).buffer
);

export const jsonDeserializer = <T>(buffer: ArrayBuffer): T => {
  const text = textDecoder.decode(new Uint8Array(buffer));
  return JSON.parse(text) as T;
};

export const textSerializer = (value: string): ArrayBuffer => (
  textEncoder.encode(value).buffer
);

export const textDeserializer = (buffer: ArrayBuffer): string => (
  textDecoder.decode(new Uint8Array(buffer))
);

export const bufferSerializer = (value: ArrayBuffer): ArrayBuffer => value;

export const bufferDeserializer = (value: ArrayBuffer): ArrayBuffer => value;

export const buildShapeCacheKey = (prefix: string, url: string): string => (
  `${prefix}:${hashString(url)}`
);

const DOWNLOAD_CONTENT_TYPE = 'application/flatgeobuf';
const DOWNLOAD_CONTENT_TYPE_GZIP = `${DOWNLOAD_CONTENT_TYPE}+gzip`;
const canUseCompressionStream = (): boolean => (
  typeof CompressionStream === 'function'
  && typeof window !== 'undefined'
  && typeof window.document !== 'undefined'
);

export type DownloadCacheKeyParams = {
  dataSource?: string;
  countryCode?: string;
  adminLevel?: number;
  url?: string;
  variant?: string;
};

export const buildDownloadCacheKey = (params: DownloadCacheKeyParams): string => {
  const dataSource = params.dataSource ?? 'unknown';
  const countryCode = params.countryCode?.toLowerCase() ?? 'all';
  const adminLevel = typeof params.adminLevel === 'number' ? `adm${params.adminLevel}` : 'adm-na';
  const variant = params.variant ? `:${params.variant}` : '';
  const prefix = `download:${dataSource}:${countryCode}:${adminLevel}${variant}`;
  return buildShapeCacheKey(prefix, params.url ?? '');
};

const compressGzip = async (buffer: ArrayBuffer): Promise<{ buffer: ArrayBuffer; contentType: string }> => {
  if (!canUseCompressionStream()) {
    return { buffer, contentType: DOWNLOAD_CONTENT_TYPE };
  }
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  await writer.write(new Uint8Array(buffer));
  await writer.close();
  return { buffer: await new Response(stream.readable).arrayBuffer(), contentType: DOWNLOAD_CONTENT_TYPE_GZIP };
};

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

export const storeDownloadBufferForNode = async (params: {
  nodeId: NodeId;
  cacheKey: string;
  buffer: ArrayBuffer;
}): Promise<{ contentType: string; sizeBytes: number }> => {
  const { nodeId, cacheKey, buffer } = params;
  const startedAt = Date.now();
  const store = createShapeChunkStore(bufferSerializer, bufferDeserializer);
  const compressed = await compressGzip(buffer);
  const compressedMs = Date.now() - startedAt;
  console.debug('[shape-chunk-store] Download buffer compressed', {
    cacheKey,
    bytes: compressed.buffer.byteLength,
    contentType: compressed.contentType,
    ms: compressedMs,
  });
  await store.setForNode(nodeId, cacheKey, compressed.buffer, {
    sizeBytes: compressed.buffer.byteLength,
    contentType: compressed.contentType,
    fetchedAt: Date.now(),
  });
  console.debug('[shape-chunk-store] Download buffer stored', {
    cacheKey,
    ms: Date.now() - startedAt,
  });
  return { contentType: compressed.contentType, sizeBytes: compressed.buffer.byteLength };
};

export const readDownloadBuffer = async (nodeId: NodeId, cacheKey: string): Promise<ArrayBuffer | null> => {
  const store = createShapeChunkStore(bufferSerializer, bufferDeserializer);
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

export const listDownloadMetadataForNode = async (nodeId: NodeId): Promise<ChunkStoreMetadata[]> => {
  const store = createShapeChunkStore(bufferSerializer, bufferDeserializer);
  return store.listMetadataForNode(nodeId);
};

export const countDownloadBuffersForNode = async (nodeId: NodeId): Promise<number> => {
  const store = createShapeChunkStore(bufferSerializer, bufferDeserializer);
  return store.countForNode(nodeId);
};

export const hasDownloadBuffer = async (nodeId: NodeId, cacheKey: string): Promise<boolean> => {
  const store = createShapeChunkStore(bufferSerializer, bufferDeserializer);
  return store.hasRelationForNode(nodeId, cacheKey);
};

export const ensureDownloadBufferForNode = async (
  nodeId: NodeId,
  cacheKey: string,
): Promise<boolean> => {
  const store = createShapeChunkStore(bufferSerializer, bufferDeserializer);
  const entry = await store.get(cacheKey);
  if (!entry) return false;
  await store.setForNode(nodeId, cacheKey, entry.value, {
    sizeBytes: entry.metadata?.sizeBytes,
    contentType: entry.metadata?.contentType,
    etag: entry.metadata?.etag,
    lastModified: entry.metadata?.lastModified,
    fetchedAt: entry.metadata?.fetchedAt,
    hash: entry.metadata?.hash,
  });
  return true;
};

export type RetryConfig = {
  count: number;
  delay: number;
  backoff?: 'linear' | 'exponential';
};

export const getOrFetchWithRetry = async <T>(
  store: { getOrFetchForNode: (nodeId: NodeId, url: string, options?: ChunkStoreFetchOptions) => Promise<ChunkStoreEntry<T>> },
  nodeId: NodeId,
  url: string,
  options: ChunkStoreFetchOptions,
  retries: RetryConfig,
): Promise<ChunkStoreEntry<T>> => {
  const attempts = Math.max(1, retries.count);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await store.getOrFetchForNode(nodeId, url, options);
    } catch (error) {
      if (options.signal?.aborted || isAbortError(error)) {
        throw error;
      }
      if (attempt === attempts - 1) {
        throw error;
      }
      const wait = retries.delay <= 0 ? 0 : computeDelay(retries, attempt);
      if (wait > 0) {
        await sleep(wait);
      }
    }
  }
  throw new Error('Download failed');
};

const hashString = (input: string): string => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
};

const isAbortError = (error: unknown): boolean => (
  error instanceof Error && error.name === 'AbortError'
);

const computeDelay = (retries: RetryConfig, attempt: number): number => {
  if (retries.backoff === 'linear') {
    return retries.delay * (attempt + 1);
  }
  return retries.delay * 2 ** attempt;
};
