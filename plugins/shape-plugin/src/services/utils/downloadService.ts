import {
  configurePluginDownloadDefaults,
  downloadArrayBuffer as downloadArrayBufferForPlugin,
  downloadJson as downloadJsonForPlugin,
  getCorsProxyBaseURL,
} from '@hierarchidb/download';

type BackoffMode = 'linear' | 'exponential';

type DownloadRetryOptions = {
  retries?: number;
  delayMs?: number;
  backoff?: BackoffMode;
};

const SHAPE_PLUGIN_ID = 'shape';

const ensureShapeDownloadDefaults = (): void => {
  const corsProxyBaseURL = getCorsProxyBaseURL() || undefined;
  configurePluginDownloadDefaults(SHAPE_PLUGIN_ID, {
    dbPrefix: 'shape',
    corsProxyBaseURL,
  });
};

export const downloadArrayBuffer = async (
  url: string,
  prefix: string,
  retryOptions: DownloadRetryOptions = {},
  signal?: AbortSignal,
): Promise<ArrayBuffer> => {
  ensureShapeDownloadDefaults();
  return downloadArrayBufferForPlugin(SHAPE_PLUGIN_ID, url, prefix, retryOptions, signal);
};

export const downloadJson = async <T>(
  url: string,
  prefix: string,
  retryOptions: DownloadRetryOptions = {},
  signal?: AbortSignal,
): Promise<T> => {
  ensureShapeDownloadDefaults();
  return downloadJsonForPlugin<T>(SHAPE_PLUGIN_ID, url, prefix, retryOptions, signal);
};
