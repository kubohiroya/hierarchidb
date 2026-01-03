import type { NodeId } from '@hierarchidb/common-types';
import {
  DexieChunkStore,
  type ChunkStoreDeserializer,
  type ChunkStoreEntry,
  type ChunkStoreFetchOptions,
  type ChunkStoreSerializer,
} from '@hierarchidb/chunk-store';
import { authFetch, FetchNetworkPort, type FetchNetworkPortOptions, getCorsProxyBaseURL } from '@hierarchidb/download';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let sharedNet: FetchNetworkPort | null = null;

export const SHARED_SHAPE_NODE_ID = 'shape-shared' as NodeId;

export const createShapeNetworkPort = (options: FetchNetworkPortOptions = {}): FetchNetworkPort => {
  const corsProxyBaseURL = getCorsProxyBaseURL() || undefined;
  return new FetchNetworkPort({
    perHostConcurrency: 4,
    corsProxyBaseURL,
    authFetch: (url, init) => authFetch('shape', url, init),
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

export type RetryConfig = {
  count: number;
  delay: number;
  backoff: 'linear' | 'exponential';
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

const sleep = (ms: number): Promise<void> => (
  new Promise((resolve) => setTimeout(resolve, ms))
);

const computeDelay = (retries: RetryConfig, attempt: number): number => {
  if (retries.backoff === 'linear') {
    return retries.delay * (attempt + 1);
  }
  return retries.delay * 2 ** attempt;
};
