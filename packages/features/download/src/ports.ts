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
