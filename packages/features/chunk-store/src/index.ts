import { Dexie, type Table } from 'dexie';
import type { NodeId } from '@hierarchidb/common-types';
import {
  FetchNetworkPort,
  type FetchNetworkPortOptions,
  type NetworkPort,
  type StorageCommitMetadata,
  type StorageMetadata,
  type StoragePort,
} from '@hierarchidb/download';
import { getDBName } from '@hierarchidb/util';
import { NobleSha3HashPort } from './adapters/NobleSha3HashPort.js';
import type { HashAlgorithm, HashPort } from './ports.js';

export type ChunkStoreMetadataId = string;
export type ChunkStoreIdentity = 'url' | 'etag' | 'url+etag' | 'hash';

export type ChunkStoreSerializer<T> = (value: T) => ArrayBuffer;
export type ChunkStoreDeserializer<T> = (buffer: ArrayBuffer) => T;

export type ChunkStoreMetadata = StorageMetadata & {
  metadataId: ChunkStoreMetadataId;
  cacheKey?: string;
  hash?: string;
  hashAlgorithm?: HashAlgorithm;
};

export type ChunkStoreEntry<T> = {
  key: string;
  metadataId: ChunkStoreMetadataId;
  value: T;
  metadata: ChunkStoreMetadata;
};

export type ChunkStoreRelation = {
  nodeId: NodeId;
  metadataId: ChunkStoreMetadataId;
  createdAt: number;
};

export type ChunkStoreFetchOptions = {
  accept?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  allowStale?: boolean;
  cacheKey?: string;
  fetchUrl?: string;
  identity?: ChunkStoreIdentity;
};

export type ChunkStoreSetOptions = {
  identity?: ChunkStoreIdentity;
};

export type DexieChunkStoreTables = {
  files: string;
  chunks: string;
  relations: string;
  keys: string;
};

export type DexieChunkStoreOptions<T> = {
  serializer: ChunkStoreSerializer<T>;
  deserializer: ChunkStoreDeserializer<T>;
  db?: Dexie;
  dbName?: string;
  tables?: Partial<DexieChunkStoreTables>;
  networkPort?: NetworkPort;
  networkOptions?: FetchNetworkPortOptions;
  hashPort?: HashPort;
  hashAlgorithm?: HashAlgorithm;
};

type FileRecord = {
  metadataId: ChunkStoreMetadataId;
  cacheKey?: string;
  sizeBytes?: number;
  contentType?: string;
  etag?: string;
  lastModified?: string;
  fetchedAt?: number;
  createdAt: number;
  updatedAt: number;
  committed?: boolean;
  hash?: string;
  hashAlgorithm?: HashAlgorithm;
};

type ChunkRecord = {
  metadataId: ChunkStoreMetadataId;
  index: number;
  data: ArrayBuffer;
};

type RelationRecord = ChunkStoreRelation;

type KeyType = ChunkStoreIdentity;

type KeyRecord = {
  key: string;
  type: KeyType;
  metadataId: ChunkStoreMetadataId;
  createdAt: number;
};

class ChunkStoreDB extends Dexie {
  files!: Table<FileRecord, ChunkStoreMetadataId>;
  chunks!: Table<ChunkRecord, [ChunkStoreMetadataId, number]>;
  relations!: Table<RelationRecord, [NodeId, ChunkStoreMetadataId]>;
  keys!: Table<KeyRecord, [string, KeyType]>;

  constructor(name: string, tables: DexieChunkStoreTables) {
    super(name);
    this.version(1).stores({
      [tables.files]: '&metadataId, cacheKey, etag, hash, updatedAt',
      [tables.chunks]: '&[metadataId+index], metadataId, index',
      [tables.relations]: '&[nodeId+metadataId], nodeId, metadataId',
      [tables.keys]: '&[key+type], key, type, metadataId',
    });
  }
}

const DEFAULT_TABLES: DexieChunkStoreTables = {
  files: 'files',
  chunks: 'chunks',
  relations: 'relations',
  keys: 'keys',
};

export class DexieChunkStore<T> implements StoragePort {
  private readonly files: Table<FileRecord, ChunkStoreMetadataId>;
  private readonly chunks: Table<ChunkRecord, [ChunkStoreMetadataId, number]>;
  private readonly relations: Table<RelationRecord, [NodeId, ChunkStoreMetadataId]>;
  private readonly keys: Table<KeyRecord, [string, KeyType]>;
  private readonly serializer: ChunkStoreSerializer<T>;
  private readonly deserializer: ChunkStoreDeserializer<T>;
  private readonly network: NetworkPort;
  private readonly hashPort: HashPort;
  private readonly hashAlgorithm: HashAlgorithm;

  constructor(options: DexieChunkStoreOptions<T>) {
    const tables: DexieChunkStoreTables = {
      files: options.tables?.files ?? DEFAULT_TABLES.files,
      chunks: options.tables?.chunks ?? DEFAULT_TABLES.chunks,
      relations: options.tables?.relations ?? DEFAULT_TABLES.relations,
      keys: options.tables?.keys ?? DEFAULT_TABLES.keys,
    };
    const db = options.db
      ? options.db
      : new ChunkStoreDB(options.dbName ?? getDBName('chunk-store'), tables);

    this.files = options.db ? (db.table(tables.files) as Table<FileRecord, ChunkStoreMetadataId>) : (db as ChunkStoreDB).files;
    this.chunks = options.db ? (db.table(tables.chunks) as Table<ChunkRecord, [ChunkStoreMetadataId, number]>) : (db as ChunkStoreDB).chunks;
    this.relations = options.db ? (db.table(tables.relations) as Table<RelationRecord, [NodeId, ChunkStoreMetadataId]>) : (db as ChunkStoreDB).relations;
    this.keys = options.db ? (db.table(tables.keys) as Table<KeyRecord, [string, KeyType]>) : (db as ChunkStoreDB).keys;
    this.serializer = options.serializer;
    this.deserializer = options.deserializer;
    this.network = options.networkPort ?? new FetchNetworkPort(options.networkOptions);
    this.hashPort = options.hashPort ?? new NobleSha3HashPort();
    this.hashAlgorithm = options.hashAlgorithm ?? 'sha3-256';
  }

  async get(cacheKey: string): Promise<ChunkStoreEntry<T> | undefined> {
    const metadataId = await this.getMetadataIdByCacheKey(cacheKey);
    if (!metadataId) return undefined;
    const metadata = await this.getMetadata(metadataId);
    if (!metadata) return undefined;
    const buffer = await this.readAll(metadataId);
    return { key: cacheKey, metadataId, value: this.deserializer(buffer), metadata: metadata as ChunkStoreMetadata };
  }

  async setForNode(
    nodeId: NodeId,
    cacheKey: string,
    value: T,
    metadata?: Partial<ChunkStoreMetadata>,
    options: ChunkStoreSetOptions = {},
  ): Promise<ChunkStoreEntry<T>> {
    const buffer = this.serializer(value);
    const stored = await this.storeBufferForNode(
      nodeId,
      cacheKey,
      buffer,
      metadata as Partial<FileRecord> | undefined,
      options.identity ?? 'url+etag',
    );
    return {
      key: cacheKey,
      metadataId: stored.metadataId,
      value,
      metadata: stored.metadata,
    };
  }

  async deleteForNode(nodeId: NodeId, cacheKey: string): Promise<void> {
    const metadataId = await this.getMetadataIdByCacheKey(cacheKey);
    if (!metadataId) return;
    await this.relations.delete([nodeId, metadataId]);
    const remaining = await this.relations.where('metadataId').equals(metadataId).count();
    if (remaining > 0) return;
    await this.files.delete(metadataId);
    await this.chunks.where('metadataId').equals(metadataId).delete();
    await this.keys.where('metadataId').equals(metadataId).delete();
  }

  async getOrFetchForNode(
    nodeId: NodeId,
    url: string,
    options: ChunkStoreFetchOptions = {},
  ): Promise<ChunkStoreEntry<T>> {
    const cacheKey = options.cacheKey ?? url;
    const fetchUrl = options.fetchUrl ?? url;
    const identity = options.identity ?? 'url+etag';
    const cachedMetadataId = await this.getMetadataIdByCacheKey(cacheKey);
    const cachedMeta = cachedMetadataId ? await this.files.get(cachedMetadataId) : undefined;

    const attemptFetch = async (useConditional: boolean): Promise<{ buffer: ArrayBuffer; meta: Partial<FileRecord> }> => {
      const headers = buildHeaders(
        options.accept,
        options.headers,
        useConditional && cachedMeta ? { etag: cachedMeta.etag, lastModified: cachedMeta.lastModified } : undefined,
      );
      const response = await this.network.get(fetchUrl, { headers, signal: options.signal });
      if (response.status === 304) {
        if (cachedMetadataId) {
          const cachedBuffer = await this.readAll(cachedMetadataId);
          return { buffer: cachedBuffer, meta: { ...cachedMeta } };
        }
        return attemptFetch(false);
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      return {
        buffer,
        meta: {
          contentType: readHeader(response.headers, 'content-type'),
          etag: readHeader(response.headers, 'etag'),
          lastModified: readHeader(response.headers, 'last-modified'),
          fetchedAt: Date.now(),
          sizeBytes: buffer.byteLength,
        },
      };
    };

    try {
      const useConditional = Boolean(cachedMeta?.etag || cachedMeta?.lastModified);
      const fetched = await attemptFetch(useConditional);
      const stored = await this.storeBufferForNode(nodeId, cacheKey, fetched.buffer, fetched.meta, identity);
      return {
        key: cacheKey,
        metadataId: stored.metadataId,
        value: this.deserializer(fetched.buffer),
        metadata: stored.metadata,
      };
    } catch (error) {
      if (options.allowStale !== false && cachedMetadataId && cachedMeta) {
        const buffer = await this.readAll(cachedMetadataId);
        await this.ensureRelation(nodeId, cachedMetadataId);
        return {
          key: cacheKey,
          metadataId: cachedMetadataId,
          value: this.deserializer(buffer),
          metadata: this.toMetadata(cachedMetadataId, cachedMeta),
        };
      }
      throw error;
    }
  }

  async putChunk(fileId: string, index: number, data: ArrayBuffer): Promise<void> {
    const now = Date.now();
    await this.files.put({ metadataId: fileId, createdAt: now, updatedAt: now, committed: false });
    await this.chunks.put({ metadataId: fileId, index, data });
  }

  async commit(fileId: string, metadata: StorageCommitMetadata): Promise<void> {
    const now = Date.now();
    const existing = await this.files.get(fileId);
    if (!existing) {
      await this.files.put({
        metadataId: fileId,
        createdAt: now,
        updatedAt: now,
        committed: true,
        sizeBytes: metadata.sizeBytes,
        contentType: metadata.contentType,
        etag: metadata.etag,
        lastModified: metadata.lastModified,
        fetchedAt: metadata.fetchedAt,
        hash: metadata.hash,
      });
      return;
    }
    await this.files.update(fileId, {
      committed: true,
      sizeBytes: metadata.sizeBytes ?? existing.sizeBytes,
      contentType: metadata.contentType ?? existing.contentType,
      etag: metadata.etag ?? existing.etag,
      lastModified: metadata.lastModified ?? existing.lastModified,
      fetchedAt: metadata.fetchedAt ?? existing.fetchedAt,
      hash: metadata.hash ?? existing.hash,
      updatedAt: now,
    });
  }

  async getResumeInfo(fileId: string): Promise<{ nextIndex: number } | undefined> {
    const count = await this.chunks.where('metadataId').equals(fileId).count();
    if (count === 0) return undefined;
    return { nextIndex: count };
  }

  async readAll(fileId: string): Promise<ArrayBuffer> {
    const chunks = await this.chunks.where('metadataId').equals(fileId).sortBy('index');
    const total = chunks.reduce((sum, chunk) => sum + chunk.data.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(new Uint8Array(chunk.data), offset);
      offset += chunk.data.byteLength;
    }
    return out.buffer;
  }

  async getMetadata(fileId: string): Promise<StorageMetadata | undefined> {
    const record = await this.files.get(fileId);
    if (!record) return undefined;
    return this.toMetadata(fileId, record);
  }

  private async storeBufferForNode(
    nodeId: NodeId,
    cacheKey: string,
    buffer: ArrayBuffer,
    metadata: Partial<FileRecord> | undefined,
    identity: ChunkStoreIdentity,
  ): Promise<{ metadataId: ChunkStoreMetadataId; metadata: ChunkStoreMetadata }> {
    const now = Date.now();
    const resolved = await this.resolveIdentity(cacheKey, buffer, metadata, identity);
    const existingId = await this.getMetadataIdByKey(resolved.key, resolved.type);

    if (existingId) {
      await this.keys.put({ key: cacheKey, type: 'url', metadataId: existingId, createdAt: now });
      await this.ensureRelation(nodeId, existingId);
      const existingMeta = await this.files.get(existingId);
      if (!existingMeta) {
        await this.chunks.put({ metadataId: existingId, index: 0, data: buffer });
        await this.files.put({
          metadataId: existingId,
          cacheKey,
          createdAt: now,
          updatedAt: now,
          committed: true,
          sizeBytes: metadata?.sizeBytes ?? buffer.byteLength,
          contentType: metadata?.contentType,
          etag: metadata?.etag,
          lastModified: metadata?.lastModified,
          fetchedAt: metadata?.fetchedAt,
          hash: resolved.hash,
          hashAlgorithm: resolved.hashAlgorithm,
        });
        await this.keys.put({ key: resolved.key, type: resolved.type, metadataId: existingId, createdAt: now });
      }
      return {
        metadataId: existingId,
        metadata: this.toMetadata(existingId, existingMeta ?? {
          metadataId: existingId,
          cacheKey,
          createdAt: now,
          updatedAt: now,
          committed: true,
        }),
      };
    }

    const metadataId = generateMetadataId();
    await this.chunks.put({ metadataId, index: 0, data: buffer });
    await this.files.put({
      metadataId,
      cacheKey,
      createdAt: now,
      updatedAt: now,
      committed: true,
      sizeBytes: metadata?.sizeBytes ?? buffer.byteLength,
      contentType: metadata?.contentType,
      etag: metadata?.etag,
      lastModified: metadata?.lastModified,
      fetchedAt: metadata?.fetchedAt,
      hash: resolved.hash,
      hashAlgorithm: resolved.hashAlgorithm,
    });
    await this.keys.put({ key: cacheKey, type: 'url', metadataId, createdAt: now });
    await this.keys.put({ key: resolved.key, type: resolved.type, metadataId, createdAt: now });
    await this.ensureRelation(nodeId, metadataId);
    return {
      metadataId,
      metadata: this.toMetadata(metadataId, {
        metadataId,
        cacheKey,
        createdAt: now,
        updatedAt: now,
        committed: true,
        sizeBytes: metadata?.sizeBytes ?? buffer.byteLength,
        contentType: metadata?.contentType,
        etag: metadata?.etag,
        lastModified: metadata?.lastModified,
        fetchedAt: metadata?.fetchedAt,
        hash: resolved.hash,
        hashAlgorithm: resolved.hashAlgorithm,
      }),
    };
  }

  private async ensureRelation(nodeId: NodeId, metadataId: ChunkStoreMetadataId): Promise<void> {
    await this.relations.put({ nodeId, metadataId, createdAt: Date.now() });
  }

  private async getMetadataIdByCacheKey(cacheKey: string): Promise<ChunkStoreMetadataId | undefined> {
    return await this.getMetadataIdByKey(cacheKey, 'url');
  }

  private async getMetadataIdByKey(key: string, type: KeyType): Promise<ChunkStoreMetadataId | undefined> {
    const record = await this.keys.get([key, type]);
    return record?.metadataId;
  }

  private async resolveIdentity(
    cacheKey: string,
    buffer: ArrayBuffer,
    metadata: Partial<FileRecord> | undefined,
    identity: ChunkStoreIdentity,
  ): Promise<{ key: string; type: KeyType; hash?: string; hashAlgorithm?: HashAlgorithm }> {
    const etag = metadata?.etag;
    if (identity === 'url') {
      return { key: cacheKey, type: 'url' };
    }
    if (identity === 'etag') {
      if (etag) {
        return { key: etag, type: 'etag' };
      }
      const hash = await this.hashPort.digest(buffer, this.hashAlgorithm);
      return { key: `${this.hashAlgorithm}:${hash}`, type: 'hash', hash, hashAlgorithm: this.hashAlgorithm };
    }
    if (identity === 'url+etag') {
      if (etag) {
        return { key: `${cacheKey}:${etag}`, type: 'url+etag' };
      }
      const hash = await this.hashPort.digest(buffer, this.hashAlgorithm);
      return { key: `${this.hashAlgorithm}:${hash}`, type: 'hash', hash, hashAlgorithm: this.hashAlgorithm };
    }
    const hash = await this.hashPort.digest(buffer, this.hashAlgorithm);
    return { key: `${this.hashAlgorithm}:${hash}`, type: 'hash', hash, hashAlgorithm: this.hashAlgorithm };
  }

  private toMetadata(metadataId: ChunkStoreMetadataId, record: FileRecord): ChunkStoreMetadata {
    return {
      metadataId,
      cacheKey: record.cacheKey,
      sizeBytes: record.sizeBytes,
      contentType: record.contentType,
      etag: record.etag,
      lastModified: record.lastModified,
      fetchedAt: record.fetchedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      committed: record.committed,
      hash: record.hash,
      hashAlgorithm: record.hashAlgorithm,
    };
  }
}

const buildHeaders = (
  accept: string | undefined,
  extra: Record<string, string> | undefined,
  conditional?: { etag?: string; lastModified?: string },
): Headers => {
  const headers = new Headers(extra);
  if (accept) headers.set('Accept', accept);
  if (conditional?.etag) headers.set('If-None-Match', conditional.etag);
  if (conditional?.lastModified) headers.set('If-Modified-Since', conditional.lastModified);
  return headers;
};

const readHeader = (headers: Headers | Record<string, string>, key: string): string | undefined => {
  if (headers instanceof Headers) {
    return headers.get(key) ?? undefined;
  }
  const target = key.toLowerCase();
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === target) return value;
  }
  return undefined;
};

const generateMetadataId = (): ChunkStoreMetadataId => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `meta-${Date.now().toString(36)}-${rand}`;
};

export * from './ports.js';
export * from './cas/ContentAddressableStore.js';
export * from './adapters/DexieContentIndexPort.js';
export * from './adapters/CacheAPICachePort.js';
export * from './adapters/NobleSha3HashPort.js';
