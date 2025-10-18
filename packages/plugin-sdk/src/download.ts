import { createDownloadService } from '@hierarchidb/download';
import type { DownloadOptions, DownloadResult } from '@hierarchidb/download';

export type DownloadServiceHandle = Awaited<ReturnType<typeof createDownloadService>>;

export interface DownloadTaskOptions {
  /**
   * Allows callers to rewrite the requested URL (e.g., to route through a proxy).
   */
  transformUrl?: (url: string) => string | Promise<string>;
  /**
   * Override the file identifier used when storing chunks. Accepts a string or factory.
   */
  fileId?: string | ((resolvedUrl: string) => string);
  /**
   * Additional download options forwarded to the underlying service.
   */
  downloadOptions?: DownloadOptions;
  /**
   * Whether to issue a lightweight HEAD request to collect response headers (default: true).
   */
  captureMetadata?: boolean;
  /**
   * Hook invoked after the download completes, with helpers to read the stored content.
   */
  onComplete?: (outcome: ManagedDownloadOutcome) => Promise<void> | void;
}

export interface ManagedDownloadOutcome extends DownloadResult {
  /** Final URL after any transforms. */
  url: string;
  /** Lazily reads the full downloaded payload from storage. */
  readAll: () => Promise<ArrayBuffer>;
  /** Content-Type derived from HEAD response (if available). */
  contentType?: string;
}

const DEFAULT_METADATA_CAPTURE = true;

export async function downloadWithService(
  service: DownloadServiceHandle,
  originalUrl: string,
  options: DownloadTaskOptions = {},
): Promise<ManagedDownloadOutcome> {
  const resolvedUrl = options.transformUrl ? await options.transformUrl(originalUrl) : originalUrl;
  const fileId = typeof options.fileId === 'function'
    ? options.fileId(resolvedUrl)
    : options.fileId ?? generateFileId(resolvedUrl);

  let contentType: string | undefined;
  const shouldCapture = options.captureMetadata ?? DEFAULT_METADATA_CAPTURE;
  if (shouldCapture) {
    try {
      const head = await service.net.head(resolvedUrl);
      if (head?.headers) {
        if (head.headers instanceof Headers) {
          contentType = head.headers.get('content-type') ?? undefined;
        } else if (typeof head.headers === 'object') {
          const candidate = Object.entries(head.headers).find(([name]) => name.toLowerCase() === 'content-type');
          contentType = candidate ? String(candidate[1]) : undefined;
        }
      }
    } catch {
      // Ignore HEAD failures (CORS, 4xx, etc.) and continue.
    }
  }

  const result = await service.service.download(resolvedUrl, fileId, options.downloadOptions);
  const readAll = async (): Promise<ArrayBuffer> => {
    if (typeof service.readAll !== 'function') {
      throw new Error('Download storage does not expose readAll()');
    }
    return service.readAll(fileId);
  };

  const outcome: ManagedDownloadOutcome = {
    ...result,
    url: resolvedUrl,
    readAll,
    contentType,
  };

  if (options.onComplete) {
    await options.onComplete(outcome);
  }

  return outcome;
}

export { createDownloadService };
export type { DownloadServiceOptions } from '@hierarchidb/download';

function generateFileId(resolvedUrl: string): string {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `download:${uuid}`;
}
