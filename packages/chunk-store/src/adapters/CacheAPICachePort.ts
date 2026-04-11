import type { CachePort, HashAlgorithm, ResponseLike } from '~/types';

export class CacheAPICachePort implements CachePort {
  private key(hash: string, algo: HashAlgorithm) {
    return `${algo}:${hash}`;
  }

  async get(hash: string, algo: HashAlgorithm): Promise<ResponseLike | undefined> {
    const cache = await caches.open('hdb-cas');
    const res = await cache.match(this.key(hash, algo));
    if (!res) return undefined;
    return {
      ok: res.ok,
      status: res.status,
      headers: res.headers,
      arrayBuffer: () => res.arrayBuffer(),
    };
  }

  async put(hash: string, algo: HashAlgorithm, data: ArrayBuffer, contentType?: string): Promise<void> {
    const cache = await caches.open('hdb-cas');
    const body = new Blob([data], { type: contentType || 'application/octet-stream' });
    const res = new Response(body);
    await cache.put(this.key(hash, algo), res);
  }

  async delete(hash: string, algo: HashAlgorithm): Promise<void> {
    const cache = await caches.open('hdb-cas');
    await cache.delete(this.key(hash, algo));
  }
}
