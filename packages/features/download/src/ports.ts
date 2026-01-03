export interface NetworkPort {
  head(url: string, init?: RequestInit): Promise<ResponseLike>;

  get(url: string, init?: RequestInit): Promise<ResponseLike>;

  getRange(url: string, start: number, endInclusive: number, init?: RequestInit): Promise<ResponseLike>;
}

export interface ResponseLike {
  ok: boolean;
  status: number;
  headers: Record<string, string> | Headers;

  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface StoragePort {
  putChunk(fileId: string, index: number, data: ArrayBuffer): Promise<void>;

  commit(fileId: string, metadata: StorageCommitMetadata): Promise<void>;

  getResumeInfo(fileId: string): Promise<{ nextIndex: number } | undefined>;

  readAll?(fileId: string): Promise<ArrayBuffer>;

  getMetadata?(fileId: string): Promise<StorageMetadata | undefined>;
}

export interface IntegrityPort {
  compute(buffer: ArrayBuffer, algo?: 'sha256'): Promise<string>;
}

// CAS (Content Addressable Storage) extensions
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

export type StorageCommitMetadata = {
  sizeBytes?: number;
  hash?: string;
  etag?: string;
  lastModified?: string;
  contentType?: string;
  fetchedAt?: number;
};

export type StorageMetadata = StorageCommitMetadata & {
  createdAt?: number;
  updatedAt?: number;
  committed?: boolean;
};
