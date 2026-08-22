import type { NodeId } from '@hierarchidb/core-types';
import { NobleSha3HashPort, type ChunkStoreMetadata, type HashAlgorithm } from '@hierarchidb/chunk-store';
import { sleep } from '@hierarchidb/util';
import type { FetchOptions, RawDataPipeline, RetryConfig } from '~/services/datasources/DataSourceStrategy';
import {
  bufferDeserializer,
  bufferSerializer,
  createShapeChunkStore,
} from './chunkStore.js';
import { createShapeNetworkPort } from './createShapeNetworkPort.js';

export type RawDataPipelineResult<TRawData> = {
  decoded: TRawData;
  cacheKey: string;
  metadata: ChunkStoreMetadata;
};

const SOURCE_HASH_ALGORITHM: HashAlgorithm = 'sha3-256';

const hashPort = new NobleSha3HashPort();

const isOffline = (): boolean => (
  typeof navigator !== 'undefined' && navigator.onLine === false
);

const resolveTimeoutSignal = (signal: AbortSignal | undefined, timeoutMs: number | undefined) => {
  if (!timeoutMs || timeoutMs <= 0) {
    return { signal, cleanup: undefined as undefined | (() => void) };
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  const cleanup = () => clearTimeout(timeoutId);
  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
    }
  }
  return { signal: controller.signal, cleanup };
};

export const fetchRawDataWithPipeline = async <TRawData>(params: {
  nodeId: NodeId;
  fetchOptions: FetchOptions;
  pipeline: RawDataPipeline<TRawData>;
  retryConfig?: RetryConfig;
  onRetryAttempt?: (attempt: number, error: unknown) => void | Promise<void>;
  onDownloadProgress?: (percentage: number) => void | Promise<void>;
}): Promise<RawDataPipelineResult<TRawData>> => {
  const {
    nodeId,
    fetchOptions,
    pipeline,
    retryConfig,
    onRetryAttempt,
  } = params;
  const request = pipeline.prepareRequest(fetchOptions);
  const store = createShapeChunkStore(bufferSerializer, bufferDeserializer);

  const hasRelation = await store.hasRelationForNode(nodeId, request.cacheKey);
  if (hasRelation) {
    const entry = await store.get(request.cacheKey);
    if (entry) {
      const decoded = await pipeline.decodeBuffer(entry.value, entry.metadata);
      return { decoded, cacheKey: request.cacheKey, metadata: entry.metadata };
    }
  }

  if (isOffline()) {
    throw new Error('Offline: raw data cache is missing.');
  }
  const network = createShapeNetworkPort();
  const { signal, cleanup } = resolveTimeoutSignal(fetchOptions.signal, fetchOptions.timeout);
  try {
    const response = await fetchWithRetry({
      network,
      request,
      retryConfig,
      signal,
      onRetryAttempt,
      onDownloadProgress: params.onDownloadProgress,
    });
    const rawBuffer = await response.arrayBuffer();
    const sourceHash = hashPort.digest(rawBuffer, SOURCE_HASH_ALGORITHM);
    const rawStream = bufferToStream(rawBuffer);
    const transformed = await pipeline.transformStream(rawStream, fetchOptions);
    const storedBuffer = await streamToBuffer(transformed.stream);

    const stored = await store.setForNode(nodeId, request.cacheKey, storedBuffer, {
      sizeBytes: storedBuffer.byteLength,
      contentType: transformed.contentType,
      fetchedAt: Date.now(),
      sourceHash,
      sourceHashAlgorithm: SOURCE_HASH_ALGORITHM,
    });
    const decoded = await pipeline.decodeBuffer(storedBuffer, stored.metadata);
    return { decoded, cacheKey: request.cacheKey, metadata: stored.metadata };
  } finally {
    cleanup?.();
  }
};

export const bufferToStream = (buffer: ArrayBuffer): ReadableStream<Uint8Array> => (
  new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    },
  })
);

export const streamToBuffer = async (stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
};

type FetchWithRetryParams = {
  network: ReturnType<typeof createShapeNetworkPort>;
  request: { url: string; headers?: Record<string, string>; accept?: string };
  retryConfig?: RetryConfig;
  signal?: AbortSignal;
  onRetryAttempt?: (attempt: number, error: unknown) => void | Promise<void>;
  onDownloadProgress?: (percentage: number) => void | Promise<void>;
};

const fetchWithRetry = async (params: FetchWithRetryParams) => {
  const { network, request, retryConfig, signal } = params;
  const attempts = Math.max(1, retryConfig?.count ?? 1);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const headers = new Headers(request.headers ?? {});
      if (request.accept) headers.set('Accept', request.accept);
      const response = await network.get(request.url, {
        headers,
        signal,
        onDownloadProgress: ({ percentage }) => {
          if (typeof percentage === 'number' && Number.isFinite(percentage)) {
            return params.onDownloadProgress?.(percentage);
          }
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response;
    } catch (error) {
      if (signal?.aborted) throw error;
      if (attempt === attempts - 1) throw error;
      if (params.onRetryAttempt) {
        try {
          await params.onRetryAttempt(attempt + 1, error);
        } catch (callbackError) {
          console.warn('[ShapeNetwork] retry callback failed', callbackError);
        }
      }
      const delay = retryConfig?.delay ?? 0;
      if (delay > 0) {
        await sleep(computeDelay(retryConfig, attempt));
      }
    }
  }
  throw new Error('Download failed.');
};

const computeDelay = (retryConfig: RetryConfig | undefined, attempt: number): number => {
  if (!retryConfig) return 0;
  if (retryConfig.backoff === 'linear') {
    return retryConfig.delay * (attempt + 1);
  }
  return retryConfig.delay * 2 ** attempt;
};
