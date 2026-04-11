import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { ContentIndexPort, ContentMeta, HashAlgorithm } from '~/types';

class ContentIndexDB extends Dexie {
  contents!: Table<ContentMeta, [string, HashAlgorithm]>;
  urls!: Table<{ url: string; hash: string; algo: HashAlgorithm }, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      contents: '[hash+algo], hash, algo, refCount, createdAt',
      urls: '&url, hash, algo',
    });
  }
}

export class DexieContentIndexPort implements ContentIndexPort {
  private db: ContentIndexDB;

  constructor(name: string = getDBName('cas-db')) {
    this.db = new ContentIndexDB(name);
  }

  async getMeta(hash: string, algo: HashAlgorithm): Promise<ContentMeta | undefined> {
    return await this.db.contents.get([hash, algo]);
  }

  async putMeta(meta: ContentMeta): Promise<void> {
    await this.db.contents.put(meta);
  }

  async incRef(hash: string, algo: HashAlgorithm, by: number = 1): Promise<number> {
    return await this.db.transaction('rw', this.db.contents, async () => {
      const meta = await this.db.contents.get([hash, algo]);
      if (!meta) {
        await this.db.contents.put({
          hash,
          algo,
          size: 0,
          createdAt: Date.now(),
          refCount: 0,
        });
        return by;
      }
      meta.refCount = (meta.refCount || 0) + by;
      await this.db.contents.put(meta);
      return meta.refCount;
    });
  }

  async decRef(hash: string, algo: HashAlgorithm, by: number = 1): Promise<number> {
    return await this.db.transaction('rw', this.db.contents, async () => {
      const meta = await this.db.contents.get([hash, algo]);
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
    const row = await this.db.urls.get(url);
    if (!row) return undefined;
    return { hash: row.hash, algo: row.algo };
  }
}
