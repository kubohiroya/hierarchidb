import type { CachePort, ContentIndexPort, HashAlgorithm, HashPort, NetworkPort, ResponseLike } from '../ports.js';

export interface FetchToCasOptions {
  url: string;
  expectedHash?: string;
  algo?: HashAlgorithm;
  refKey?: string; // logical reference owner (e.g., nodeId/sessionId)
  contentTypeHint?: string;
}

export interface CasResult {
  hash: string;
  algo: HashAlgorithm;
  size: number;
  contentType?: string;
}

export class ContentAddressableStore {
  constructor(
    private net: NetworkPort,
    private cache: CachePort,
    private index: ContentIndexPort,
    private hash: HashPort,
  ) {
  }

  async fetchToCas(opts: FetchToCasOptions): Promise<CasResult> {
    const algo: HashAlgorithm = opts.algo || 'sha3-256';

    //  1) URL map hit inc ref and return
    const mapped = await this.index.getHashByUrl(opts.url);
    if (mapped) {
      const meta = await this.index.getMeta(mapped.hash, mapped.algo);
      if (meta) {
        await this.index.incRef(meta.hash, meta.algo, 1);
        return { hash: meta.hash, algo: meta.algo, size: meta.size, contentType: meta.contentType };
      }
    }

    // 2) Fetch
    const res: ResponseLike = await this.net.get(opts.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const ct = header(res.headers, 'content-type') || opts.contentTypeHint;

    // 3) Hash (SHA3-256 default)
    const hashHex = await this.hash.digest(buf, algo);

    //  4) Meta exists? map URL + inc ref, else cache + put meta + map URL
    const existing = await this.index.getMeta(hashHex, algo);
    if (!existing) {
      await this.cache.put(hashHex, algo, buf, ct);
      await this.index.putMeta({
        hash: hashHex,
        algo,
        size: buf.byteLength,
        contentType: ct,
        createdAt: Date.now(),
        refCount: 0,
      });
    }

    await this.index.mapUrl(opts.url, hashHex, algo);
    await this.index.incRef(hashHex, algo, 1);

    return { hash: hashHex, algo, size: buf.byteLength, contentType: ct };
  }

  async addRef(hash: string, algo: HashAlgorithm, by: number = 1): Promise<number> {
    return await this.index.incRef(hash, algo, by);
  }

  async release(hash: string, algo: HashAlgorithm, by: number = 1): Promise<void> {
    const count = await this.index.decRef(hash, algo, by);
    if (count <= 0) {
      //  Last reference removed delete from cache and index
      await this.cache.delete(hash, algo);
      // Minimal cleanup: leave URL maps as tombstones or remove separately if tracked.
    }
  }
}

function header(headers: Headers | Record<string, string> | undefined, key: string): string | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get(key) ?? undefined;
  const target = key.toLowerCase();
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === target) return value;
  }
  return undefined;
}
