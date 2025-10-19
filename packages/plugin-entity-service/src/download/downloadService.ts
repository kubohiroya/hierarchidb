import { createDownloadService } from '@hierarchidb/download';
import type { DownloadOptions, DownloadResult } from '@hierarchidb/download';

export type DownloadServiceHandle = Awaited<ReturnType<typeof createDownloadService>>;

export interface DownloadTaskOptions {
  transformUrl?: (url: string) => string | Promise<string>;
  fileId?: string | ((resolvedUrl: string) => string);
  downloadOptions?: DownloadOptions;
  captureMetadata?: boolean;
  onComplete?: (outcome: ManagedDownloadOutcome) => Promise<void> | void;
}

export interface ManagedDownloadOutcome extends DownloadResult {
  url: string;
  readAll: () => Promise<ArrayBuffer>;
  contentType?: string;
}

const DEFAULT_METADATA_CAPTURE = true;

export async function downloadWithService(
  service: DownloadServiceHandle,
  originalUrl: string,
  options: DownloadTaskOptions = {},
): Promise<ManagedDownloadOutcome> {
  const resolvedUrl = options.transformUrl ? await options.transformUrl(originalUrl) : originalUrl;
  const fileId =
    typeof options.fileId === 'function'
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
          const entry = Object.entries(head.headers).find(
            ([name]) => name.toLowerCase() === 'content-type',
          );
          contentType = entry ? String(entry[1]) : undefined;
        }
      }
    } catch {
      // HEAD failure is non-fatal; continue without metadata.
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

function generateFileId(_resolvedUrl: string): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `download:${uuid}`;
}

export { createDownloadService };
