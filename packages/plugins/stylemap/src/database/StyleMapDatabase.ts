/**
 * @file StyleMapDatabase.ts
 * @description Dexie-based database implementation for StyleMap plugin
 * Follows hierarchidb patterns with normalized table design
 * References:
 * - packages/plugins/basemap/src/database/BaseMapDatabase.ts
 * - docs/spec/plugin-stylemap-requirements.md (REQ-401, TECH-005, TECH-006)
 */

import Dexie, { Table } from 'dexie';
import type { TreeNodeId, UUID } from '@hierarchidb/core';
import type {
  StyleMapEntity,
  StyleMapWorkingCopy,
  TableMetadataEntity,
  RowEntity,
  StyleCacheEntry,
  TableQueryOptions,
  TableQueryResult,
} from '../types';

/**
 * StyleMap database schema
 * Implements normalized design for optimal performance and storage
 */
export class StyleMapDatabase extends Dexie {
  // Core tables
  entities!: Table<StyleMapEntity, TreeNodeId>;
  workingCopies!: Table<StyleMapWorkingCopy, string>;

  // Data tables (normalized design)
  tableMetadata!: Table<TableMetadataEntity, UUID>;
  rows!: Table<RowEntity, UUID>;

  // Cache table
  cache!: Table<StyleCacheEntry, string>;

  constructor(databaseName: string = 'StyleMapDB') {
    super(databaseName);

    this.version(1).stores({
      // Core entity storage
      entities: '&nodeId, filename, keyColumn, valueColumn, tableMetadataId, cacheKey, updatedAt',
      workingCopies: '&workingCopyId, nodeId, workingCopyOf, copiedAt, isDirty',

      // Normalized table storage
      tableMetadata: '&tableId, nodeId, filename, contentHash, importedAt, lastAccessedAt',
      rows: '&rowId, tableId, rowIndex',

      // Performance cache
      cache: '&cacheKey, cachedAt, expiresAt',
    });

    // Define hooks for automatic cleanup and validation
    this.entities.hook('creating', (_primKey, obj, _trans) => {
      const now = Date.now();
      obj.createdAt = obj.createdAt || now;
      obj.updatedAt = now;
      obj.version = obj.version || 1;
    });

    this.entities.hook('updating', (modifications, _primKey, obj, _trans) => {
      (modifications as any).updatedAt = Date.now();
      if ((obj as any).version) {
        (modifications as any).version = (obj as any).version + 1;
      }
    });

    this.workingCopies.hook('creating', (_primKey, obj, _trans) => {
      obj.copiedAt = obj.copiedAt || Date.now();
      obj.updatedAt = Date.now();
    });

    this.workingCopies.hook('updating', (modifications, _primKey, _obj, _trans) => {
      (modifications as any).updatedAt = Date.now();
      (modifications as any).isDirty = true;
    });

    this.tableMetadata.hook('creating', (_primKey, obj, _trans) => {
      const now = Date.now();
      obj.importedAt = obj.importedAt || now;
      obj.lastAccessedAt = now;
    });

    this.tableMetadata.hook('reading', (obj) => {
      // Update last accessed time when reading
      obj.lastAccessedAt = Date.now();
    });
  }

  /**
   * Singleton pattern for main instance
   */
  private static instance: StyleMapDatabase | null = null;

  public static getInstance(): StyleMapDatabase {
    if (!StyleMapDatabase.instance) {
      StyleMapDatabase.instance = new StyleMapDatabase();
    }
    return StyleMapDatabase.instance;
  }

  /**
   * Create worker instance (separate from main instance)
   */
  public static createWorkerInstance(): StyleMapDatabase {
    return new StyleMapDatabase('StyleMapDB_Worker');
  }

  /**
   * Close database and cleanup singleton
   */
  public static async close(): Promise<void> {
    if (StyleMapDatabase.instance) {
      await StyleMapDatabase.instance.close();
      StyleMapDatabase.instance = null;
    }
  }

  // ==================
  // Entity Operations
  // ==================

  /**
   * Save a StyleMap entity
   */
  async saveEntity(entity: StyleMapEntity): Promise<void> {
    await this.entities.put(entity);
  }

  /**
   * Get a StyleMap entity by node ID
   */
  async getEntity(nodeId: TreeNodeId): Promise<StyleMapEntity | undefined> {
    return await this.entities.get(nodeId);
  }

  /**
   * Update a StyleMap entity
   */
  async updateEntity(nodeId: TreeNodeId, updates: Partial<StyleMapEntity>): Promise<void> {
    await this.entities.update(nodeId, updates);
  }

  /**
   * Delete a StyleMap entity and cascade delete related data
   */
  async deleteEntity(nodeId: TreeNodeId): Promise<void> {
    await this.transaction(
      'rw',
      [this.entities, this.workingCopies, this.tableMetadata, this.rows, this.cache],
      async () => {
        const entity = await this.entities.get(nodeId);

        if (entity) {
          // Delete working copies
          await this.workingCopies.where('nodeId').equals(nodeId).delete();

          // Delete table data if exists
          if (entity.tableMetadataId) {
            await this.rows.where('tableId').equals(entity.tableMetadataId).delete();
            await this.tableMetadata.delete(entity.tableMetadataId);
          }

          // Clear cache entries
          if (entity.cacheKey) {
            await this.cache.delete(entity.cacheKey);
          }

          // Delete entity
          await this.entities.delete(nodeId);
        }
      }
    );
  }

  /**
   * Get all StyleMap entities
   */
  async getAllEntities(): Promise<StyleMapEntity[]> {
    return await this.entities.toArray();
  }

  /**
   * Get entities by parent node
   */
  async getEntitiesByParent(_parentNodeId: TreeNodeId): Promise<StyleMapEntity[]> {
    // Note: This would require belongsToNode field in schema if needed
    return await this.entities.toArray();
  }

  // ==================
  // Working Copy Operations
  // ==================

  /**
   * Create a working copy
   */
  async createWorkingCopy(workingCopy: StyleMapWorkingCopy): Promise<void> {
    await this.workingCopies.put(workingCopy);
  }

  /**
   * Get working copy by node ID
   */
  async getWorkingCopy(nodeId: TreeNodeId): Promise<StyleMapWorkingCopy | undefined> {
    return await this.workingCopies.where('nodeId').equals(nodeId).first();
  }

  /**
   * Update working copy
   */
  async updateWorkingCopy(
    workingCopyId: string,
    updates: Partial<StyleMapWorkingCopy>
  ): Promise<void> {
    await this.workingCopies.update(workingCopyId, updates);
  }

  /**
   * Delete working copy
   */
  async deleteWorkingCopy(nodeId: TreeNodeId): Promise<void> {
    await this.workingCopies.where('nodeId').equals(nodeId).delete();
  }

  /**
   * Get all working copies
   */
  async getAllWorkingCopies(): Promise<StyleMapWorkingCopy[]> {
    return await this.workingCopies.toArray();
  }

  /**
   * Clean up expired working copies (older than TTL)
   */
  async cleanupExpiredWorkingCopies(ttlMs: number = 86400000): Promise<number> {
    const expiredTime = Date.now() - ttlMs;
    const expiredCopies = await this.workingCopies.where('copiedAt').below(expiredTime).delete();

    return expiredCopies;
  }

  // ==================
  // Table Data Operations
  // ==================

  /**
   * Save table metadata
   */
  async saveTableMetadata(metadata: TableMetadataEntity): Promise<void> {
    await this.tableMetadata.put(metadata);
  }

  /**
   * Get table metadata by table ID
   */
  async getTableMetadata(tableId: UUID): Promise<TableMetadataEntity | undefined> {
    return await this.tableMetadata.get(tableId);
  }

  /**
   * Get table metadata by node ID
   */
  async getTableMetadataByNode(nodeId: TreeNodeId): Promise<TableMetadataEntity | undefined> {
    return await this.tableMetadata.where('nodeId').equals(nodeId).first();
  }

  /**
   * Batch insert table rows
   */
  async batchInsertRows(rows: RowEntity[]): Promise<void> {
    await this.rows.bulkPut(rows);
  }

  /**
   * Query table rows with options
   */
  async queryTableRows(tableId: UUID, options: TableQueryOptions = {}): Promise<TableQueryResult> {
    const { limit = 1000, offset = 0, sortBy, sortDirection = 'asc', columns } = options;

    let query = this.rows.where('tableId').equals(tableId);

    // Apply sorting if specified
    if (sortBy) {
      query = this.rows.orderBy('rowIndex').and((row) => row.tableId === tableId);
      if (sortDirection === 'desc') {
        query = query.reverse();
      }
    }

    // Get total count
    const totalRows = await query.count();

    // Apply pagination
    const rows = await query.offset(offset).limit(limit).toArray();

    // Extract row data and apply column filtering
    const tableMetadata = await this.getTableMetadata(tableId);
    const allColumns = tableMetadata?.columns.map((col) => col.name) || [];
    const selectedColumns = columns || allColumns;

    const resultRows = rows.map((row) => {
      if (columns) {
        // Filter columns
        const columnIndices = columns
          .map((col) => allColumns.indexOf(col))
          .filter((idx) => idx >= 0);
        return columnIndices.map((idx) => row.rowData[idx] ?? null);
      }
      return row.rowData.map((val) => val ?? null);
    });

    return {
      rows: resultRows,
      totalRows,
      columns: selectedColumns,
      hasMore: offset + rows.length < totalRows,
    };
  }

  /**
   * Delete table and all its rows
   */
  async deleteTable(tableId: UUID): Promise<void> {
    await this.transaction('rw', [this.tableMetadata, this.rows], async () => {
      await this.rows.where('tableId').equals(tableId).delete();
      await this.tableMetadata.delete(tableId);
    });
  }

  /**
   * Get row count for a table
   */
  async getTableRowCount(tableId: UUID): Promise<number> {
    return await this.rows.where('tableId').equals(tableId).count();
  }

  // ==================
  // Cache Operations
  // ==================

  /**
   * Save cache entry
   */
  async saveCache(entry: StyleCacheEntry): Promise<void> {
    await this.cache.put(entry);
  }

  /**
   * Get cache entry by key
   */
  async getCache(cacheKey: string): Promise<StyleCacheEntry | undefined> {
    const entry = await this.cache.get(cacheKey);

    if (entry) {
      // Check if expired
      if (Date.now() > entry.expiresAt) {
        await this.cache.delete(cacheKey);
        return undefined;
      }

      // Update hit count
      await this.cache.update(cacheKey, {
        hitCount: entry.hitCount + 1,
      });
    }

    return entry;
  }

  /**
   * Delete cache entry
   */
  async deleteCache(cacheKey: string): Promise<void> {
    await this.cache.delete(cacheKey);
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredCache(): Promise<number> {
    const now = Date.now();
    return await this.cache.where('expiresAt').below(now).delete();
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalEntries: number;
    totalHits: number;
    averageAge: number;
    expiredEntries: number;
  }> {
    const entries = await this.cache.toArray();
    const now = Date.now();

    const totalEntries = entries.length;
    const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0);
    const averageAge =
      totalEntries > 0
        ? entries.reduce((sum, entry) => sum + (now - entry.cachedAt), 0) / totalEntries
        : 0;
    const expiredEntries = entries.filter((entry) => now > entry.expiresAt).length;

    return {
      totalEntries,
      totalHits,
      averageAge,
      expiredEntries,
    };
  }

  // ==================
  // Database Maintenance
  // ==================

  /**
   * Cleanup all expired data
   */
  async cleanup(): Promise<{
    expiredWorkingCopies: number;
    expiredCacheEntries: number;
  }> {
    const [expiredWorkingCopies, expiredCacheEntries] = await Promise.all([
      this.cleanupExpiredWorkingCopies(),
      this.cleanupExpiredCache(),
    ]);

    return {
      expiredWorkingCopies,
      expiredCacheEntries,
    };
  }

  /**
   * Get database size statistics
   */
  async getDatabaseStats(): Promise<{
    entities: number;
    workingCopies: number;
    tables: number;
    rows: number;
    cacheEntries: number;
    estimatedSize: number;
  }> {
    const [entities, workingCopies, tables, rows, cacheEntries] = await Promise.all([
      this.entities.count(),
      this.workingCopies.count(),
      this.tableMetadata.count(),
      this.rows.count(),
      this.cache.count(),
    ]);

    // Rough estimation of database size
    const estimatedSize =
      entities * 1024 + // ~1KB per entity
      workingCopies * 1024 + // ~1KB per working copy
      tables * 512 + // ~512B per table metadata
      rows * 256 + // ~256B per row (average)
      cacheEntries * 2048; // ~2KB per cache entry

    return {
      entities,
      workingCopies,
      tables,
      rows,
      cacheEntries,
      estimatedSize,
    };
  }

  /**
   * Optimize database (compact and rebuild indices)
   */
  async optimize(): Promise<void> {
    // Cleanup expired data first
    await this.cleanup();

    // Note: Dexie doesn't provide direct compaction API
    // This could be extended with specific optimization logic
    console.log('Database optimization completed');
  }

  /**
   * Export database data for backup
   */
  async exportData(): Promise<{
    entities: StyleMapEntity[];
    tableMetadata: TableMetadataEntity[];
    rows: RowEntity[];
  }> {
    const [entities, tableMetadata, rows] = await Promise.all([
      this.entities.toArray(),
      this.tableMetadata.toArray(),
      this.rows.toArray(),
    ]);

    return {
      entities,
      tableMetadata,
      rows,
    };
  }

  /**
   * Import database data from backup
   */
  async importData(data: {
    entities: StyleMapEntity[];
    tableMetadata: TableMetadataEntity[];
    rows: RowEntity[];
  }): Promise<void> {
    await this.transaction('rw', [this.entities, this.tableMetadata, this.rows], async () => {
      await this.entities.bulkPut(data.entities);
      await this.tableMetadata.bulkPut(data.tableMetadata);
      await this.rows.bulkPut(data.rows);
    });
  }
}
