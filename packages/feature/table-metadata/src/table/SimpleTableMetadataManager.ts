import Dexie, { type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';

// Minimal structural type to avoid coupling to UI packages
export type CSVTableMetadataLike = {
  id: string;
  filename?: string;
  columns?: any[];
  totalRows?: number;
  contentHash?: string;
  createdAt?: number;
  fileSizeBytes?: number;
  referencingPlugins?: string[];
  referenceCount?: number;
  isChunked?: boolean;
  chunkCount?: number;
  [key: string]: any;
};

class CSVMetadataDB extends Dexie {
  csvMetadata!: Table<CSVTableMetadataLike, string>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({
      csvMetadata: '&id, contentHash, filename, createdAt, *referencingPlugins',
    });
  }
}

/**
 * Unified metadata manager used by both Spreadsheet and Styler plugins.
 * Provides a superset API to remain backward compatible with both implementations.
 */
export class SimpleTableMetadataManager {
  private db: CSVMetadataDB;

  constructor(dbName: string = getDBName('spreadsheet-metadata-db')) {
    this.db = new CSVMetadataDB(dbName);
  }

  // ---- Common helpers ----
  private ensureRefs(m?: CSVTableMetadataLike): Required<Pick<CSVTableMetadataLike, 'referencingPlugins' | 'referenceCount'>> {
    return {
      referencingPlugins: Array.isArray(m?.referencingPlugins) ? [...(m!.referencingPlugins as string[])] : [],
      referenceCount: typeof m?.referenceCount === 'number' ? (m!.referenceCount as number) : (m?.referencingPlugins?.length || 0),
    };
  }

  // ---- Spreadsheet-style API ----
  async create(metadata: CSVTableMetadataLike, pluginId: string): Promise<CSVTableMetadataLike> {
    return await this.db.transaction('rw', this.db.csvMetadata, async () => {
      const id = metadata.id || crypto.randomUUID();
      const base: CSVTableMetadataLike = {
        ...metadata,
        id,
        createdAt: metadata.createdAt ?? Date.now(),
      };
      const refs = this.ensureRefs(base);
      if (!refs.referencingPlugins.includes(pluginId)) refs.referencingPlugins.push(pluginId);
      base.referencingPlugins = refs.referencingPlugins;
      base.referenceCount = refs.referencingPlugins.length;
      await this.db.csvMetadata.put(base);
      return base;
    });
  }

  async get(id: string): Promise<CSVTableMetadataLike | undefined> {
    return await this.db.csvMetadata.get(id);
  }

  async list(): Promise<CSVTableMetadataLike[]> {
    return await this.db.csvMetadata.orderBy('createdAt').reverse().toArray();
  }

  async findByHash(contentHash: string): Promise<CSVTableMetadataLike | undefined> {
    return await this.db.csvMetadata.where('contentHash').equals(contentHash).first();
  }

  async addReference(tableId: string, pluginId: string): Promise<void> {
    await this.db.transaction('rw', this.db.csvMetadata, async () => {
      const m = await this.db.csvMetadata.get(tableId);
      if (!m) throw new Error('Table not found');
      const refs = this.ensureRefs(m);
      if (!refs.referencingPlugins.includes(pluginId)) {
        refs.referencingPlugins.push(pluginId);
        await this.db.csvMetadata.update(tableId, {
          referencingPlugins: refs.referencingPlugins,
          referenceCount: refs.referencingPlugins.length,
        });
      }
    });
  }

  /**
   * Remove a reference; when the count reaches zero, delete the record.
   * Returns true when the record has been deleted.
   */
  async removeReference(tableId: string, pluginId: string): Promise<boolean> {
    return await this.db.transaction('rw', this.db.csvMetadata, async () => {
      const m = await this.db.csvMetadata.get(tableId);
      if (!m) throw new Error('Table not found');
      const refs = this.ensureRefs(m);
      const next = refs.referencingPlugins.filter((p) => p !== pluginId);
      if (next.length === 0) {
        await this.db.csvMetadata.delete(tableId);
        return true;
      }
      await this.db.csvMetadata.update(tableId, {
        referencingPlugins: next,
        referenceCount: next.length,
      });
      return false;
    });
  }

  async update(tableId: string, updates: Partial<CSVTableMetadataLike>): Promise<void> {
    await this.db.csvMetadata.update(tableId, updates);
  }

  async getStatistics(): Promise<{
    totalTables: number;
    totalRows: number;
    totalSize: number;
    pluginReferenceCounts: Record<string, number>;
  }> {
    const all = await this.db.csvMetadata.toArray();
    const stats = {
      totalTables: all.length,
      totalRows: all.reduce((s, t) => s + (t.totalRows || 0), 0),
      totalSize: all.reduce((s, t) => s + (t.fileSizeBytes || 0), 0),
      pluginReferenceCounts: {} as Record<string, number>,
    };
    for (const t of all) {
      for (const p of t.referencingPlugins || []) {
        stats.pluginReferenceCounts[p] = (stats.pluginReferenceCounts[p] || 0) + 1;
      }
    }
    return stats;
  }

  async cleanupOrphanedTables(): Promise<string[]> {
    const deleted: string[] = [];
    await this.db.transaction('rw', this.db.csvMetadata, async () => {
      const all = await this.db.csvMetadata.toArray();
      for (const t of all) {
        if (!t.referencingPlugins || t.referencingPlugins.length === 0) {
          await this.db.csvMetadata.delete(t.id);
          deleted.push(t.id);
        }
      }
    });
    return deleted;
  }

  async forceDelete(tableId: string): Promise<void> {
    await this.db.csvMetadata.delete(tableId);
  }

  // ---- Styler-style compatibility API ----
  async store(metadata: CSVTableMetadataLike): Promise<void> {
    const m = {
      ...metadata,
      id: metadata.id || crypto.randomUUID(),
      createdAt: metadata.createdAt ?? Date.now(),
      referencingPlugins: metadata.referencingPlugins || [],
      referenceCount: metadata.referenceCount ?? (metadata.referencingPlugins?.length || 0),
    } as CSVTableMetadataLike;
    await this.db.csvMetadata.put(m);
  }

  async getAll(): Promise<CSVTableMetadataLike[]> {
    return await this.db.csvMetadata.toArray();
  }

  async delete(id: string): Promise<void> {
    await this.db.csvMetadata.delete(id);
  }

  async findByContentHash(hash: string): Promise<CSVTableMetadataLike | null> {
    const r = await this.findByHash(hash);
    return r || null;
  }

  async clear(): Promise<void> {
    await this.db.csvMetadata.clear();
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}
