import { createDownloadService, resolveNetworkUrl, getCorsProxyBaseURL } from '@hierarchidb/download';
import type { DownloadServiceBundle } from '@hierarchidb/download';

type BackoffMode = 'linear' | 'exponential';

type DownloadRetryOptions = {
  retries?: number;
  delayMs?: number;
  backoff?: BackoffMode;
};

let cachedService: Promise<DownloadServiceBundle> | undefined;

const getShapeDownloadService = async (): Promise<DownloadServiceBundle> => {
  if (!cachedService) {
    const corsProxyBaseURL = getCorsProxyBaseURL() || undefined;
    console.debug('[ShapeDownload] init', {
      corsProxyBaseURL,
    });
    cachedService = createDownloadService({
      dbPrefix: 'shape',
      corsProxyBaseURL,
    });
  }
  return cachedService;
};

const hashString = (input: string): string => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
};

const buildDownloadFileId = (prefix: string, url: string): string => (
  `shape:${prefix}:${hashString(url)}`
);

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const isAbortError = (error: unknown): boolean => (
  error instanceof Error && error.name === 'AbortError'
);

export const downloadArrayBuffer = async (
  url: string,
  prefix: string,
  retryOptions: DownloadRetryOptions = {},
  signal?: AbortSignal,
): Promise<ArrayBuffer> => {
  const { service, readAll } = await getShapeDownloadService();
  const corsProxyBaseURL = getCorsProxyBaseURL();
  console.debug('[ShapeDownload] request', {
    url,
    resolvedUrl: resolveNetworkUrl(url, { corsProxyBaseURL }),
    corsProxyBaseURL,
  });
  const retries = Math.max(1, retryOptions.retries ?? 1);
  const delayMs = Math.max(0, retryOptions.delayMs ?? 0);
  const backoff: BackoffMode = retryOptions.backoff ?? 'exponential';
  const fileId = buildDownloadFileId(prefix, url);

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      await service.download(url, fileId, { signal });
      return await readAll(fileId);
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) {
        throw error;
      }
      if (attempt === retries - 1) {
        throw error;
      }
      if (delayMs > 0) {
        const wait = backoff === 'exponential'
          ? delayMs * 2 ** attempt
          : delayMs * (attempt + 1);
        await sleep(wait);
      }
    }
  }

  throw new Error('Download failed');
};

export const downloadJson = async <T>(
  url: string,
  prefix: string,
  retryOptions: DownloadRetryOptions = {},
  signal?: AbortSignal,
): Promise<T> => {
  const buffer = await downloadArrayBuffer(url, prefix, retryOptions, signal);
  const text = new TextDecoder('utf-8').decode(buffer);
  return JSON.parse(text) as T;
};
