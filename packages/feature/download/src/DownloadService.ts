import type { IntegrityPort, NetworkPort, StoragePort } from './ports';

export interface DownloadOptions {
  concurrency?: number; // for multi-part in future
  partSize?: number; // bytes
  expectedHash?: string;
}

export interface DownloadResult {
  fileId: string;
  sizeBytes?: number;
  hash?: string;
}

export class DownloadService {
  constructor(private net: NetworkPort, private store: StoragePort, private integrity?: IntegrityPort) {}

  async download(url: string, fileId: string, opts: DownloadOptions = {}): Promise<DownloadResult> {
    // Use chunked download if partSize is provided
    const partSize = opts.partSize ?? 0;
    if (partSize > 0) return await this.downloadChunked(url, fileId, { ...opts, partSize });

    // Serial download
    const res = await this.net.get(url);
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
    const head = await this.net.head(url);
    // Fallback when HEAD not allowed
    const contentLength = Number((head.headers as any)?.get?.('content-length') || 0);
    const totalSize = isFinite(contentLength) && contentLength > 0 ? contentLength : 0;
    const partSize = Math.max(64 * 1024, opts.partSize!);
    const concurrency = Math.max(1, opts.concurrency ?? 4);

    const resume = await this.store.getResumeInfo(fileId);
    const startIndex = resume?.nextIndex ?? 0;
    const parts = totalSize > 0 ? Math.ceil(totalSize / partSize) : startIndex + 1; // unknown size → single part fallback

    // Simple worker pool
    let next = startIndex;
    const workers = new Array(concurrency).fill(0).map(async () => {
      while (totalSize === 0 ? next === 0 : next < parts) {
        const idx = next++;
        const byteStart = totalSize === 0 ? 0 : idx * partSize;
        const byteEnd = totalSize === 0 ? undefined : Math.min((idx + 1) * partSize - 1, totalSize - 1);
        const res = byteEnd !== undefined ? await this.net.getRange(url, byteStart, byteEnd) : await this.net.get(url);
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
