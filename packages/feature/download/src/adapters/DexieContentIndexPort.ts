import Dexie, { Table } from 'dexie';
import type { ContentIndexPort, ContentMeta, HashAlgorithm } from '../ports';

class CasDB extends Dexie {
  contents!: Table<ContentMeta, [string, string]>; // [hash, algo]
  urls!: Table<{ url: string; hash: string; algo: HashAlgorithm }, string>;
  constructor(name: string = 'hidb-cas') {
    super(name);
    this.version(1).stores({
      contents: '[hash+algo], hash, algo, refCount, createdAt',
      urls: '&url, hash, algo'
    });
  }
}

export class DexieContentIndexPort implements ContentIndexPort {
  private db: CasDB;
  constructor(dbName?: string) {
    this.db = new CasDB(dbName);
  }
  async getMeta(hash: string, algo: HashAlgorithm): Promise<ContentMeta | undefined> {
    return await this.db.contents.get([hash, algo] as any);
  }
  async putMeta(meta: ContentMeta): Promise<void> {
    await this.db.contents.put(meta);
  }
  async incRef(hash: string, algo: HashAlgorithm, by: number = 1): Promise<number> {
    return await this.db.transaction('rw', this.db.contents, async () => {
      const meta = (await this.db.contents.get([hash, algo] as any)) || ({ hash, algo, size: 0, createdAt: Date.now(), refCount: 0 } as ContentMeta);
      meta.refCount = (meta.refCount || 0) + by;
      await this.db.contents.put(meta);
      return meta.refCount;
    });
  }
  async decRef(hash: string, algo: HashAlgorithm, by: number = 1): Promise<number> {
    return await this.db.transaction('rw', this.db.contents, async () => {
      const meta = await this.db.contents.get([hash, algo] as any);
      if (!meta) return 0;
      meta.refCount = Math.max(0, (meta.refCount || 0) - by);
      await this.db.contents.put(meta);
      return meta.refCount;
    });
  }
  async mapUrl(url: string, hash: string, algo: HashAlgorithm): Promise<void> {
    await this.db.urls.put({ url, hash, algo });
  }
  async unmapUrl(url: string): Promise<void> {
    await this.db.urls.delete(url);
  }
  async getHashByUrl(url: string): Promise<{ hash: string; algo: HashAlgorithm } | undefined> {
    const rec = await this.db.urls.get(url);
    return rec ? { hash: rec.hash, algo: rec.algo } : undefined;
  }
}

