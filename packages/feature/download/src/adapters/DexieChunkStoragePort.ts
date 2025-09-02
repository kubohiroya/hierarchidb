import Dexie, { Table } from 'dexie';
import type { StoragePort } from '../ports';

type FileMeta = { id: string; sizeBytes?: number; committed?: boolean; createdAt: number; updatedAt: number; extra?: Record<string, any> };
type FileChunk = { fileId: string; index: number; data: ArrayBuffer };

class ChunkDB extends Dexie {
  files!: Table<FileMeta, string>;
  chunks!: Table<FileChunk, [string, number]>;
  constructor(name: string = 'hidb-chunks') {
    super(name);
    this.version(1).stores({
      files: '&id, committed, updatedAt',
      chunks: '&[fileId+index], fileId, index',
    });
  }
}

export class DexieChunkStoragePort implements StoragePort {
  private db: ChunkDB;
  constructor(dbName?: string) { this.db = new ChunkDB(dbName); }

  async putChunk(fileId: string, index: number, data: ArrayBuffer): Promise<void> {
    const now = Date.now();
    await this.db.transaction('rw', this.db.files, this.db.chunks, async () => {
      const f = await this.db.files.get(fileId);
      if (!f) await this.db.files.put({ id: fileId, createdAt: now, updatedAt: now });
      else await this.db.files.update(fileId, { updatedAt: now });
      await this.db.chunks.put({ fileId, index, data });
    });
  }

  async commit(fileId: string, metadata: Record<string, any>): Promise<void> {
    await this.db.files.update(fileId, { committed: true, sizeBytes: metadata?.sizeBytes, extra: metadata, updatedAt: Date.now() });
  }

  async getResumeInfo(fileId: string): Promise<{ nextIndex: number } | undefined> {
    const count = await this.db.chunks.where('fileId').equals(fileId).count();
    if (count === 0) return undefined;
    return { nextIndex: count };
  }

  async readAll(fileId: string): Promise<ArrayBuffer> {
    const chunks = await this.db.chunks.where('fileId').equals(fileId).sortBy('index');
    // Concatenate in order
    const total = chunks.reduce((s, c) => s + c.data.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { out.set(new Uint8Array(c.data), offset); offset += c.data.byteLength; }
    return out.buffer;
  }
}
