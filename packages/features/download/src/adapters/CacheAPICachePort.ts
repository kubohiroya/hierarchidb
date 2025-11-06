import type { CachePort, HashAlgorithm, ResponseLike } from '../ports.js';

const CACHE_NAME = 'hierarchidb-cas';

export class CacheAPICachePort implements CachePort {
  private key(hash: string, algo: HashAlgorithm) {
    return `cas://${algo}/${hash}`;
  }

  async get(hash: string, algo: HashAlgorithm): Promise<ResponseLike | undefined> {
    const cache = await caches.open(CACHE_NAME);
    const req = new Request(this.key(hash, algo));
    const res = await cache.match(req);
    if (!res) return undefined;
    return { ok: res.ok, status: res.status, headers: res.headers, arrayBuffer: () => res.arrayBuffer() };
  }

  async put(hash: string, algo: HashAlgorithm, data: ArrayBuffer, contentType?: string): Promise<void> {
    const cache = await caches.open(CACHE_NAME);
    const req = new Request(this.key(hash, algo));
    const res = new Response(data, { headers: contentType ? { 'content-type': contentType } : undefined });
    await cache.put(req, res);
  }

  async delete(hash: string, algo: HashAlgorithm): Promise<void> {
    const cache = await caches.open(CACHE_NAME);
    const req = new Request(this.key(hash, algo));
    await cache.delete(req);
  }
}

