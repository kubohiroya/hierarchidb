import { shapeDB } from '@hierarchidb/shape-store';
import type { TabularTableMetadataLike } from '@hierarchidb/tabular-store';

/**
 * Metadata manager dedicated to Shape plugin tabular datasets.
 * Stores metadata in the explicitly initialized persistent ShapeDB.
 */
export class ShapeTabularMetadataManager {
  private table = shapeDB.tabularMetadata;

  private ensureRefs(
    m?: TabularTableMetadataLike
  ): Required<Pick<TabularTableMetadataLike, 'referencingPlugins' | 'referenceCount'>> {
    return {
      referencingPlugins: Array.isArray(m?.referencingPlugins)
        ? [...(m!.referencingPlugins as string[])]
        : [],
      referenceCount:
        typeof m?.referenceCount === 'number'
          ? (m!.referenceCount as number)
          : m?.referencingPlugins?.length || 0,
    };
  }

  async create(
    metadata: TabularTableMetadataLike,
    pluginId: string
  ): Promise<TabularTableMetadataLike> {
    return await shapeDB.transaction('rw', this.table, async () => {
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
      await this.table.put(base);
      return base;
    });
  }

  async get(id: string): Promise<TabularTableMetadataLike | undefined> {
    return await this.table.get(id);
  }

  async list(): Promise<TabularTableMetadataLike[]> {
    return await this.table.orderBy('createdAt').reverse().toArray();
  }

  async findByHash(contentHash: string): Promise<TabularTableMetadataLike | undefined> {
    return await this.table.where('contentHash').equals(contentHash).first();
  }

  async addReference(tableId: string, pluginId: string): Promise<void> {
    await shapeDB.transaction('rw', this.table, async () => {
      const m = await this.table.get(tableId);
      if (!m) throw new Error('Table not found');
      const refs = this.ensureRefs(m);
      if (!refs.referencingPlugins.includes(pluginId)) {
        refs.referencingPlugins.push(pluginId);
        await this.table.update(tableId, {
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
    return await shapeDB.transaction('rw', this.table, async () => {
      const m = await this.table.get(tableId);
      if (!m) throw new Error('Table not found');
      const refs = this.ensureRefs(m);
      const next = refs.referencingPlugins.filter((p) => p !== pluginId);
      if (next.length === 0) {
        await this.table.delete(tableId);
        return true;
      }
      await this.table.update(tableId, {
        referencingPlugins: next,
        referenceCount: next.length,
      });
      return false;
    });
  }

  async update(tableId: string, updates: Partial<TabularTableMetadataLike>): Promise<void> {
    await this.table.update(tableId, updates);
  }

  async getStatistics(): Promise<{
    totalTables: number;
    totalRows: number;
    totalSize: number;
    pluginReferenceCounts: Record<string, number>;
  }> {
    const all = await this.table.toArray();
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
    await shapeDB.transaction('rw', this.table, async () => {
      const all = await this.table.toArray();
      for (const t of all) {
        if (!t.referencingPlugins || t.referencingPlugins.length === 0) {
          await this.table.delete(t.id);
          deleted.push(t.id);
        }
      }
    });
    return deleted;
  }

  async forceDelete(tableId: string): Promise<void> {
    await this.table.delete(tableId);
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
    await this.table.put(m);
  }

  async getAll(): Promise<TabularTableMetadataLike[]> {
    return await this.table.toArray();
  }

  async delete(id: string): Promise<void> {
    await this.table.delete(id);
  }

  async findByContentHash(hash: string): Promise<TabularTableMetadataLike | null> {
    const r = await this.findByHash(hash);
    return r || null;
  }

  async clear(): Promise<void> {
    await this.table.clear();
  }

  async close(): Promise<void> {
    await shapeDB.close();
  }
}
