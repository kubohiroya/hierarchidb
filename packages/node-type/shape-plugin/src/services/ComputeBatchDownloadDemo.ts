import { BatchService } from '@hierarchidb/batch';
import { ComputeService } from '@hierarchidb/compute';
import { DownloadService, type IntegrityPort, type NetworkPort, type StoragePort } from '@hierarchidb/download';

class FetchNetworkPort implements NetworkPort {
  async head(url: string, init?: RequestInit) {
    const { authFetch } = await import('./utils/authFetch');
    const r = await authFetch(url, { method: 'HEAD', ...init });
    return wrap(r);
  }

  async get(url: string, init?: RequestInit) {
    const { authFetch } = await import('./utils/authFetch');
    const r = await authFetch(url, { method: 'GET', ...init });
    return wrap(r);
  }

  async getRange(url: string, start: number, end: number, init?: RequestInit) {
    const { authFetch } = await import('./utils/authFetch');
    const r = await authFetch(url, { method: 'GET', headers: { Range: `bytes=${start}-${end}` }, ...init });
    return wrap(r);
  }
}

function wrap(r: Response) {
  return {
    ok: r.ok,
    status: r.status,
    headers: r.headers,
    arrayBuffer: () => r.arrayBuffer(),
  };
}

class MemoryStoragePort implements StoragePort {
  private data = new Map<string, { chunks: Map<number, ArrayBuffer>; meta?: Record<string, any> }>();

  async putChunk(fileId: string, index: number, data: ArrayBuffer): Promise<void> {
    const entry = this.data.get(fileId) || { chunks: new Map() };
    entry.chunks.set(index, data);
    this.data.set(fileId, entry);
  }

  async commit(fileId: string, metadata: Record<string, any>): Promise<void> {
    const entry = this.data.get(fileId) || { chunks: new Map() };
    entry.meta = metadata;
    this.data.set(fileId, entry);
  }

  async getResumeInfo(_fileId: string): Promise<{ nextIndex: number } | undefined> {
    return undefined;
  }
}

class WebCryptoIntegrityPort implements IntegrityPort {
  async compute(buffer: ArrayBuffer, algo: 'sha256' = 'sha256'): Promise<string> {
    const digest = await crypto.subtle.digest(algo.toUpperCase(), buffer);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}

export async function runDownloadComputeBatch(urls: string[], opts: { concurrency?: number } = {}) {
  const batch = new BatchService();
  const compute = new ComputeService({ concurrency: opts.concurrency ?? 3 });
  const download = new DownloadService(new FetchNetworkPort(), new MemoryStoragePort(), new WebCryptoIntegrityPort());

  const results = await batch.mapChunks(urls, async (url, i) => {
    const fileId = `shape-${i}-${Date.now()}`;
    const dl = await download.download(url, fileId, {});
    // Simulate CPU-bound step on pool (e.g., lightweight transform)
    const handle = compute.submit({ input: dl.sizeBytes || 0, fn: async (size) => size * 2 });
    const processed = await handle.result();
    return { ...dl, processed };
  }, { concurrency: opts.concurrency ?? 3 });

  return results;
}
