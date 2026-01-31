import type { NodeId } from '@hierarchidb/core-types';
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

const RAW_DATA_DEFAULT_CONTENT_TYPE = 'application/octet-stream';
const RAW_DATA_CACHE_PREFIX = 'download:';

export type RawDataDataSourceCacheKeyParams = {
  dataSource?: string;
  countryCode?: string;
  adminLevel?: number;
  url?: string;
  variant?: string;
};

export const buildRawDataDataSourceCacheKey = (params: RawDataDataSourceCacheKeyParams): string => {
  const dataSource = params.dataSource ?? 'unknown';
  const countryCode = params.countryCode?.toLowerCase() ?? 'all';
  const adminLevel = typeof params.adminLevel === 'number' ? `adm${params.adminLevel}` : 'adm-na';
  const variant = params.variant ? `:${params.variant}` : '';
  const prefix = `download:${dataSource}:${countryCode}:${adminLevel}${variant}`;
  return buildShapeCacheKey(prefix, params.url ?? '');
};

export const isRawDataDataSourceCacheKey = (cacheKey?: string | null): boolean => (
  Boolean(cacheKey && cacheKey.startsWith(RAW_DATA_CACHE_PREFIX))
);

const compressGzip = async (buffer: ArrayBuffer): Promise<{ buffer: ArrayBuffer; contentType: string }> => (
  { buffer, contentType: RAW_DATA_DEFAULT_CONTENT_TYPE }
);

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

export const storeRawDataDataSourceBufferForNode = async (params: {
  nodeId: NodeId;
  cacheKey: string;
  buffer: ArrayBuffer;
  contentType?: string;
}): Promise<{ contentType: string; sizeBytes: number }> => {
  const { nodeId, cacheKey, buffer } = params;
  const startedAt = Date.now();
  const store = createShapeChunkStore(bufferSerializer, bufferDeserializer);
  const compressed = await compressGzip(buffer);
  const resolvedContentType = params.contentType ?? compressed.contentType ?? RAW_DATA_DEFAULT_CONTENT_TYPE;
  const compressedMs = Date.now() - startedAt;
  console.debug('[shape-chunk-store] Raw data buffer compressed', {
    cacheKey,
    bytes: compressed.buffer.byteLength,
    contentType: resolvedContentType,
    ms: compressedMs,
  });
  await store.setForNode(nodeId, cacheKey, compressed.buffer, {
    sizeBytes: compressed.buffer.byteLength,
    contentType: resolvedContentType,
    fetchedAt: Date.now(),
  });
  console.debug('[shape-chunk-store] Raw data buffer stored', {
    cacheKey,
    ms: Date.now() - startedAt,
  });
  return { contentType: resolvedContentType, sizeBytes: compressed.buffer.byteLength };
};

export const readRawDataDataSourceBuffer = async (nodeId: NodeId, cacheKey: string): Promise<ArrayBuffer | null> => {
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

export const listRawDataDataSourceMetadataForNode = async (nodeId: NodeId): Promise<ChunkStoreMetadata[]> => {
  const store = createShapeChunkStore(bufferSerializer, bufferDeserializer);
  return store.listMetadataForNode(nodeId);
};

export const countRawDataDataSourceBuffersForNode = async (nodeId: NodeId): Promise<number> => {
  const metadata = await listRawDataDataSourceMetadataForNode(nodeId);
  return metadata.filter((entry) => isRawDataDataSourceCacheKey(entry.cacheKey)).length;
};

export const hasRawDataDataSourceBuffer = async (nodeId: NodeId, cacheKey: string): Promise<boolean> => {
  const store = createShapeChunkStore(bufferSerializer, bufferDeserializer);
  return store.hasRelationForNode(nodeId, cacheKey);
};

export const deleteRawDataDataSourceBuffersForDataSource = async (
  nodeId: NodeId,
  dataSource: string,
): Promise<number> => {
  const normalized = (dataSource ?? '').toLowerCase();
  if (!normalized) return 0;
  const store = createShapeChunkStore(bufferSerializer, bufferDeserializer);
  const prefix = `download:${normalized}:`;
  const metadata = await store.listMetadataForNode(nodeId);
  const keys = metadata
    .map((entry) => entry.cacheKey)
    .filter((key): key is string => Boolean(key && key.startsWith(prefix)));
  for (const key of keys) {
    await store.deleteForNode(nodeId, key);
  }
  return keys.length;
};

export const deleteRawDataDataSourceBuffersForNodeKeys = async (
  nodeId: NodeId,
  cacheKeys: string[],
): Promise<number> => {
  if (!cacheKeys.length) return 0;
  const store = createShapeChunkStore(bufferSerializer, bufferDeserializer);
  const uniqueKeys = Array.from(new Set(cacheKeys)).filter((key) => key.length > 0);
  for (const key of uniqueKeys) {
    await store.deleteForNode(nodeId, key);
  }
  return uniqueKeys.length;
};

export const deleteRawDataDataSourceBuffersForNode = async (nodeId: NodeId): Promise<number> => {
  const metadata = await listRawDataDataSourceMetadataForNode(nodeId);
  const cacheKeys = metadata
    .map((entry) => entry.cacheKey)
    .filter((key): key is string => isRawDataDataSourceCacheKey(key));
  return deleteRawDataDataSourceBuffersForNodeKeys(nodeId, cacheKeys);
};

export const ensureRawDataDataSourceBufferForNode = async (
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
