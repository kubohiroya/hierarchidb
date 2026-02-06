export interface ResponseLike {
  ok: boolean;
  status: number;
  headers: Record<string, string> | Headers;

  arrayBuffer(): Promise<ArrayBuffer>;
}

export type HashAlgorithm = 'sha3-256' | 'sha256';

export interface HashPort {
  digest(buffer: ArrayBuffer, algo: HashAlgorithm): Promise<string> | string; // hex
}

export interface CachePort {
  get(hash: string, algo: HashAlgorithm): Promise<ResponseLike | undefined>;

  put(hash: string, algo: HashAlgorithm, data: ArrayBuffer, contentType?: string): Promise<void>;

  delete(hash: string, algo: HashAlgorithm): Promise<void>;
}

export interface ContentMeta {
  hash: string;
  algo: HashAlgorithm;
  size: number;
  contentType?: string;
  etag?: string;
  lastModified?: number;
  createdAt: number;
  refCount: number;
}

export interface ContentIndexPort {
  getMeta(hash: string, algo: HashAlgorithm): Promise<ContentMeta | undefined>;

  putMeta(meta: ContentMeta): Promise<void>;

  incRef(hash: string, algo: HashAlgorithm, by?: number): Promise<number>; // returns new count
  decRef(hash: string, algo: HashAlgorithm, by?: number): Promise<number>; // returns new count
  mapUrl(url: string, hash: string, algo: HashAlgorithm): Promise<void>;

  unmapUrl(url: string): Promise<void>;

  getHashByUrl(url: string): Promise<{ hash: string; algo: HashAlgorithm } | undefined>;
}
