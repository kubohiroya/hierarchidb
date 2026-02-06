import type { IntegrityPort, NetworkPort, ResponseLike, StoragePort } from './ports.js';

export interface DownloadOptions {
  concurrency?: number; // for multi-part in future
  partSize?: number; // bytes
  expectedHash?: string;
  signal?: AbortSignal;
}

export interface DownloadResult {
  fileId: string;
  sizeBytes?: number;
  hash?: string;
}

export class DownloadService {
  constructor(private net: NetworkPort, private store: StoragePort, private integrity?: IntegrityPort) {
  }

  async download(url: string, fileId: string, opts: DownloadOptions = {}): Promise<DownloadResult> {
    // Use chunked download if partSize is provided
    const partSize = opts.partSize ?? 0;
    if (partSize > 0) return await this.downloadChunked(url, fileId, {
      ...opts,
      partSize,
      concurrency: opts.concurrency ?? 4,
    });

    // Serial download
    const res = await this.net.get(url, buildInit(opts.signal));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    await this.store.putChunk(fileId, 0, buf);
    let hash: string | undefined;
    if (opts.expectedHash && this.integrity) {
      hash = await this.integrity.compute(buf);
      if (hash !== opts.expectedHash) throw new Error('Integrity check failed');
    }
    await this.store.commit(fileId, { sizeBytes: buf.byteLength, hash });
    return { fileId, sizeBytes: buf.byteLength, hash };
  }

  private async downloadChunked(url: string, fileId: string, opts: Required<Pick<DownloadOptions, 'partSize' | 'concurrency'>> & DownloadOptions): Promise<DownloadResult> {
    if (opts.signal?.aborted) throw abortError();
    const head = await this.net.head(url, buildInit(opts.signal));
    // Fallback when HEAD not allowed
    const contentLengthValue = readHeader(head.headers, 'content-length');
    const contentLength = contentLengthValue ? Number(contentLengthValue) : 0;
    const totalSize = isFinite(contentLength) && contentLength > 0 ? contentLength : 0;
    const partSize = Math.max(64 * 1024, opts.partSize!);
    // Default moderate parallelism; callers can override explicitly
    const concurrency = Math.max(1, opts.concurrency ?? 4);

    const resume = await this.store.getResumeInfo(fileId);
    const startIndex = resume?.nextIndex ?? 0;
    const parts = totalSize > 0 ? Math.ceil(totalSize / partSize) : startIndex + 1; //  unknown size single part fallback

    // Simple worker pool
    let next = startIndex;
    const workers = new Array(concurrency).fill(0).map(async () => {
      while (totalSize === 0 ? next === 0 : next < parts) {
        if (opts.signal?.aborted) throw abortError();
        const idx = next++;
        const byteStart = totalSize === 0 ? 0 : idx * partSize;
        const byteEnd = totalSize === 0 ? undefined : Math.min((idx + 1) * partSize - 1, totalSize - 1);
      const res = byteEnd !== undefined
        ? await this.net.getRange(url, byteStart, byteEnd, buildInit(opts.signal))
        : await this.net.get(url, buildInit(opts.signal));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        await this.store.putChunk(fileId, idx, buf);
        if (totalSize === 0) break; // unknown size path
      }
    });
    await Promise.all(workers);

    // Commit
    let hash: string | undefined;
    if (opts.expectedHash && this.integrity && this.store.readAll) {
      const full = await this.store.readAll(fileId);
      hash = await this.integrity.compute(full);
      if (hash !== opts.expectedHash) throw new Error('Integrity check failed');
    }
    await this.store.commit(fileId, { sizeBytes: totalSize || undefined, hash });
    return { fileId, sizeBytes: totalSize || undefined, hash } as DownloadResult;
  }
}

const buildInit = (signal?: AbortSignal): RequestInit | undefined => (
  signal ? { signal } : undefined
);

function abortError(): Error {
  if (typeof DOMException === 'function') {
    return new DOMException('Download aborted', 'AbortError');
  }
  const error = new Error('Download aborted');
  (error as Error & { name: string }).name = 'AbortError';
  return error;
}

function readHeader(headers: ResponseLike['headers'], key: string): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(key) ?? undefined;
  }
  const target = key.toLowerCase();
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === target) {
      return value;
    }
  }
  return undefined;
}
