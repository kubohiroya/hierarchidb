import { Dexie, type Table } from 'dexie';
import type { TabularTableMetadataLike } from './types.js';

class CSVMetadataDB extends Dexie {
  tabularMetadata!: Table<TabularTableMetadataLike, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      tabularMetadata: '&id, contentHash, filename, createdAt, *referencingPlugins',
    });
  }
}

/**
 * Unified metadata manager used by both Spreadsheet and Styler plugin-loader.
 * Provides a superset API to remain backward compatible with both implementations.
 */
export class TabularDatabaseManager {
  private db: CSVMetadataDB;
  readonly databaseName: string;

  constructor(dbName: string) {
    this.databaseName = dbName;
    this.db = new CSVMetadataDB(dbName);
  }

  // ---- Common helpers ----
  private ensureRefs(m?: TabularTableMetadataLike): Required<Pick<TabularTableMetadataLike, 'referencingPlugins' | 'referenceCount'>> {
    return {
      referencingPlugins: Array.isArray(m?.referencingPlugins) ? [...(m!.referencingPlugins as string[])] : [],
      referenceCount: typeof m?.referenceCount === 'number' ? (m!.referenceCount as number) : (m?.referencingPlugins?.length || 0),
    };
  }

  // ---- Spreadsheet-style API ----
  async create(metadata: TabularTableMetadataLike, pluginId: string): Promise<TabularTableMetadataLike> {
    return await this.db.transaction('rw', this.db.tabularMetadata, async () => {
      const id = metadata.id || crypto.randomUUID();
      const base: TabularTableMetadataLike = {
        ...metadata,
        id,
        createdAt: metadata.createdAt ?? Date.now(),
      };
      const refs = this.ensureRefs(base);
      if (!refs.referencingPlugins.includes(pluginId)) refs.referencingPlugins.push(pluginId);
      base.referencingPlugins = refs.referencingPlugins;
      base.referenceCount = refs.referencingPlugins.length;
      await this.db.tabularMetadata.put(base);
      return base;
    });
  }

  async get(id: string): Promise<TabularTableMetadataLike | undefined> {
    return await this.db.tabularMetadata.get(id);
  }

  async list(): Promise<TabularTableMetadataLike[]> {
    return await this.db.tabularMetadata.orderBy('createdAt').reverse().toArray();
  }

  async findByHash(contentHash: string): Promise<TabularTableMetadataLike | undefined> {
    return await this.db.tabularMetadata.where('contentHash').equals(contentHash).first();
  }

  async addReference(tableId: string, pluginId: string): Promise<void> {
    await this.db.transaction('rw', this.db.tabularMetadata, async () => {
      const m = await this.db.tabularMetadata.get(tableId);
      if (!m) throw new Error('Table not found');
      const refs = this.ensureRefs(m);
      if (!refs.referencingPlugins.includes(pluginId)) {
        refs.referencingPlugins.push(pluginId);
        await this.db.tabularMetadata.update(tableId, {
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
    return await this.db.transaction('rw', this.db.tabularMetadata, async () => {
      const m = await this.db.tabularMetadata.get(tableId);
      if (!m) throw new Error('Table not found');
      const refs = this.ensureRefs(m);
      const next = refs.referencingPlugins.filter((p) => p !== pluginId);
      if (next.length === 0) {
        await this.db.tabularMetadata.delete(tableId);
        return true;
      }
      await this.db.tabularMetadata.update(tableId, {
        referencingPlugins: next,
        referenceCount: next.length,
      });
      return false;
    });
  }

  async update(tableId: string, updates: Partial<TabularTableMetadataLike>): Promise<void> {
    await this.db.tabularMetadata.update(tableId, updates);
  }

  async getStatistics(): Promise<{
    totalTables: number;
    totalRows: number;
    totalSize: number;
    pluginReferenceCounts: Record<string, number>;
  }> {
    const all = await this.db.tabularMetadata.toArray();
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
    await this.db.transaction('rw', this.db.tabularMetadata, async () => {
      const all = await this.db.tabularMetadata.toArray();
      for (const t of all) {
        if (!t.referencingPlugins || t.referencingPlugins.length === 0) {
          await this.db.tabularMetadata.delete(t.id);
          deleted.push(t.id);
        }
      }
    });
    return deleted;
  }

  async forceDelete(tableId: string): Promise<void> {
    await this.db.tabularMetadata.delete(tableId);
  }

  // ---- Styler-style compatibility API ----
  async store(metadata: TabularTableMetadataLike): Promise<void> {
    const m = {
      ...metadata,
      id: metadata.id || crypto.randomUUID(),
      createdAt: metadata.createdAt ?? Date.now(),
      referencingPlugins: metadata.referencingPlugins || [],
      referenceCount: metadata.referenceCount ?? (metadata.referencingPlugins?.length || 0),
    } as TabularTableMetadataLike;
    await this.db.tabularMetadata.put(m);
  }

  async getAll(): Promise<TabularTableMetadataLike[]> {
    return await this.db.tabularMetadata.toArray();
  }

  async delete(id: string): Promise<void> {
    await this.db.tabularMetadata.delete(id);
  }

  async findByContentHash(hash: string): Promise<TabularTableMetadataLike | null> {
    const r = await this.findByHash(hash);
    return r || null;
  }

  async clear(): Promise<void> {
    await this.db.tabularMetadata.clear();
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}
