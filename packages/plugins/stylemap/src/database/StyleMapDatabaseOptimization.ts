/**
 * @file StyleMapDatabaseOptimization.ts
 * @description Database optimization and performance monitoring for StyleMap plugin using wrapper pattern
 * References:
 * - docs/spec/plugin-stylemap-requirements.md (TECH-004, TECH-006, NFR-001)
 * - packages/worker/src/WorkerAPIImpl.ts (hierarchidb database patterns)
 */

import type { UUID } from '@hierarchidb/core';
import type { StyleMapDatabase } from './StyleMapDatabase';
import type { StyleMapEntity, RowEntity } from '../types';
import { MonitoredStyleMapDatabase } from './MonitoredStyleMapDatabase';

/**
 * Database optimization configuration
 */
export interface DatabaseOptimizationConfig {
  // Index optimization
  enableCompoundIndexes: boolean;
  enableTextSearch: boolean;

  // Cache optimization
  maxCacheSize: number;
  cacheCleanupInterval: number;

  // Performance limits
  maxRowsPerTable: number;
  maxTablesPerNode: number;
  bulkInsertBatchSize: number;

  // Cleanup intervals
  workingCopyTTL: number;
  cacheTTL: number;
  unusedDataTTL: number;
}

/**
 * Default optimization configuration
 */
export const DEFAULT_OPTIMIZATION_CONFIG: DatabaseOptimizationConfig = {
  enableCompoundIndexes: true,
  enableTextSearch: true,
  maxCacheSize: 100 * 1024 * 1024, // 100MB
  cacheCleanupInterval: 300000, // 5 minutes
  maxRowsPerTable: 1000000, // 1M rows
  maxTablesPerNode: 10, // 10 tables per StyleMap
  bulkInsertBatchSize: 1000, // 1K rows per batch
  workingCopyTTL: 86400000, // 24 hours
  cacheTTL: 3600000, // 1 hour
  unusedDataTTL: 604800000, // 7 days
};

/**
 * Performance monitoring metrics
 */
export interface PerformanceMetrics {
  // Query performance
  avgQueryTime: number;
  slowQueries: number;
  totalQueries: number;

  // Cache performance
  cacheHitRate: number;
  cacheSize: number;
  cacheEvictions: number;
  cacheHits: number;
  cacheMisses: number;

  // Database size
  totalRows: number;
  totalTables: number;
  estimatedSize: number;

  // Operations
  bulkInserts: number;
  indexScans: number;
  fullTableScans: number;
}

/**
 * Database performance optimizer
 */
export class StyleMapDatabaseOptimizer {
  private db: StyleMapDatabase;
  private monitoredDb: MonitoredStyleMapDatabase;
  private config: DatabaseOptimizationConfig;
  private metrics: PerformanceMetrics;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    database: StyleMapDatabase,
    config: DatabaseOptimizationConfig = DEFAULT_OPTIMIZATION_CONFIG
  ) {
    this.db = database;
    this.monitoredDb = new MonitoredStyleMapDatabase(database);
    this.config = config;
    this.metrics = this.initializeMetrics();

    // Start background cleanup if enabled
    if (config.cacheCleanupInterval > 0) {
      this.startBackgroundCleanup();
    }
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      avgQueryTime: 0,
      slowQueries: 0,
      totalQueries: 0,
      cacheHitRate: 0,
      cacheSize: 0,
      cacheEvictions: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalRows: 0,
      totalTables: 0,
      estimatedSize: 0,
      bulkInserts: 0,
      indexScans: 0,
      fullTableScans: 0,
    };
  }

  /**
   * Optimize database schema with compound indexes
   */
  async optimizeSchema(): Promise<void> {
    if (!this.config.enableCompoundIndexes) return;

    // Create optimized version with compound indexes
    this.db.version(2).stores({
      // Enhanced entity storage with compound indexes
      entities:
        '&nodeId, filename, [keyColumn+valueColumn], tableMetadataId, cacheKey, [updatedAt+nodeId]',
      workingCopies: '&workingCopyId, nodeId, workingCopyOf, [copiedAt+isDirty], [nodeId+isDirty]',

      // Optimized table storage with better indexing
      tableMetadata:
        '&tableId, nodeId, filename, contentHash, [nodeId+importedAt], [lastAccessedAt+fileSize]',
      rows: '&rowId, tableId, [tableId+rowIndex], rowIndex',

      // Enhanced cache with compound indexing
      cache: '&cacheKey, [cachedAt+expiresAt], [expiresAt+hitCount]',
    });

    // Add database hooks for performance monitoring
    this.addPerformanceHooks();
  }

  /**
   * Add hooks for performance monitoring
   */
  private addPerformanceHooks(): void {
    // Performance monitoring is now delegated to MonitoredStyleMapDatabase
    // This method can be used to set up additional monitoring if needed
    console.log('Performance monitoring enabled via MonitoredStyleMapDatabase');
  }

  /**
   * Optimize table data insertion with batching
   */
  async optimizedBulkInsert(
    tableId: UUID,
    rows: Array<Array<string | number | null>>
  ): Promise<void> {
    const batchSize = this.config.bulkInsertBatchSize;
    const rowEntities: RowEntity[] = [];

    // Prepare row entities in batches
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const batchEntities = batch.map((rowData, index) => ({
        rowId: crypto.randomUUID() as UUID,
        tableId,
        rowIndex: i + index,
        rowData,
      }));

      rowEntities.push(...batchEntities);

      // Insert batch
      await this.db.batchInsertRows(batchEntities);

      // Yield control to prevent blocking
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  /**
   * Intelligent cache management
   */
  async optimizeCache(): Promise<void> {
    const cacheStats = await this.db.getCacheStats();

    // Update metrics
    this.metrics.cacheSize = cacheStats.totalEntries;
    this.metrics.cacheHitRate = cacheStats.totalHits / Math.max(1, cacheStats.totalEntries);

    // Check if cache size exceeds limit
    if ((await this.estimateCacheSize()) > this.config.maxCacheSize) {
      await this.evictLeastUsedCache();
    }

    // Clean up expired entries
    const expiredCount = await this.db.cleanupExpiredCache();
    if (expiredCount > 0) {
      this.metrics.cacheEvictions += expiredCount;
    }
  }

  private async estimateCacheSize(): Promise<number> {
    const entries = await this.db.cache.toArray();
    return entries.reduce((total, entry) => {
      // Rough estimation: JSON size + overhead
      const entrySize = JSON.stringify(entry.styleResult).length + 512;
      return total + entrySize;
    }, 0);
  }

  private async evictLeastUsedCache(): Promise<void> {
    // Get all cache entries sorted by hit count and age
    const entries = await this.db.cache.orderBy(['hitCount', 'cachedAt']).toArray();

    // Remove bottom 25% of entries
    const entriesToRemove = Math.floor(entries.length * 0.25);
    const keysToRemove = entries.slice(0, entriesToRemove).map((entry) => entry.cacheKey);

    await Promise.all(keysToRemove.map((key) => this.db.deleteCache(key)));
    this.metrics.cacheEvictions += entriesToRemove;
  }

  /**
   * Optimize queries with intelligent indexing
   */
  async getOptimizedEntityQuery(filters: {
    keyColumn?: string;
    valueColumn?: string;
    dateRange?: [number, number];
    hasTable?: boolean;
  }): Promise<StyleMapEntity[]> {
    let query = this.db.entities;

    // Use compound indexes when available
    if (filters.keyColumn && filters.valueColumn) {
      return await query
        .where('[keyColumn+valueColumn]')
        .equals([filters.keyColumn, filters.valueColumn])
        .toArray();
    }

    if (filters.dateRange) {
      const [start, end] = filters.dateRange;
      return await query.where('updatedAt').between(start, end).toArray();
    }

    if (filters.hasTable !== undefined) {
      if (filters.hasTable) {
        return await query.where('tableMetadataId').notEqual('').toArray();
      } else {
        return await query.where('tableMetadataId').equals('').toArray();
      }
    }

    // Fallback to full scan (should be monitored)
    this.metrics.fullTableScans++;
    return await query.toArray();
  }

  /**
   * Memory-efficient table querying with streaming
   */
  async *streamTableRows(
    tableId: UUID,
    batchSize: number = 1000
  ): AsyncGenerator<RowEntity[], void, unknown> {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const rows = await this.db.rows
        .where('tableId')
        .equals(tableId)
        .offset(offset)
        .limit(batchSize)
        .toArray();

      if (rows.length === 0) {
        hasMore = false;
      } else {
        yield rows;
        offset += batchSize;
        hasMore = rows.length === batchSize;
      }

      // Yield control
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  /**
   * Start background cleanup process
   */
  private startBackgroundCleanup(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.performBackgroundCleanup();
      } catch (error) {
        console.error('Background cleanup failed:', error);
      }
    }, this.config.cacheCleanupInterval);
  }

  private async performBackgroundCleanup(): Promise<void> {
    // Clean up expired working copies
    await this.db.cleanupExpiredWorkingCopies(this.config.workingCopyTTL);

    // Optimize cache
    await this.optimizeCache();

    // Clean up unused table data
    await this.cleanupUnusedTableData();

    // Update metrics
    await this.updateMetrics();
  }

  private async cleanupUnusedTableData(): Promise<void> {
    const cutoffTime = Date.now() - this.config.unusedDataTTL;

    // Find tables that haven't been accessed recently
    const unusedTables = await this.db.tableMetadata
      .where('lastAccessedAt')
      .below(cutoffTime)
      .toArray();

    // Check if these tables are still referenced by entities
    for (const table of unusedTables) {
      const referencingEntity = await this.db.entities
        .where('tableMetadataId')
        .equals(table.tableId)
        .first();

      if (!referencingEntity) {
        // Table is no longer referenced, safe to delete
        await this.db.deleteTable(table.tableId);
      }
    }
  }

  private async updateMetrics(): Promise<void> {
    const stats = await this.db.getDatabaseStats();
    this.metrics.totalRows = stats.rows;
    this.metrics.totalTables = stats.tables;
    this.metrics.estimatedSize = stats.estimatedSize;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get the monitored database instance
   */
  getMonitoredDatabase(): MonitoredStyleMapDatabase {
    return this.monitoredDb;
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(): Promise<{
    summary: string;
    metrics: PerformanceMetrics;
    recommendations: string[];
  }> {
    await this.updateMetrics();

    // Get metrics from monitored database
    const monitoredMetrics = this.monitoredDb.getMetrics();

    // Merge metrics
    this.metrics.totalQueries = monitoredMetrics.totalQueries;
    this.metrics.avgQueryTime = monitoredMetrics.averageQueryTime;
    this.metrics.cacheHits = monitoredMetrics.cacheHits;
    this.metrics.cacheMisses = monitoredMetrics.cacheMisses;

    const recommendations: string[] = [];

    // Analyze performance and generate recommendations
    if (this.metrics.slowQueries / Math.max(1, this.metrics.totalQueries) > 0.1) {
      recommendations.push('High number of slow queries detected. Consider adding more indexes.');
    }

    if (this.metrics.cacheHitRate < 0.8) {
      recommendations.push('Low cache hit rate. Consider increasing cache size or TTL.');
    }

    if (this.metrics.fullTableScans > this.metrics.indexScans) {
      recommendations.push('Many full table scans detected. Optimize query patterns.');
    }

    if (this.metrics.estimatedSize > 100 * 1024 * 1024) {
      recommendations.push('Large database size. Consider archiving old data.');
    }

    const summary = `
    Database Performance Summary:
    - Total Queries: ${this.metrics.totalQueries}
    - Average Query Time: ${this.metrics.avgQueryTime.toFixed(2)}ms
    - Cache Hit Rate: ${(this.metrics.cacheHitRate * 100).toFixed(1)}%
    - Database Size: ${(this.metrics.estimatedSize / 1024 / 1024).toFixed(1)}MB
    - Tables: ${this.metrics.totalTables}, Rows: ${this.metrics.totalRows}
    `;

    return {
      summary: summary.trim(),
      metrics: this.metrics,
      recommendations,
    };
  }

  /**
   * Cleanup and stop background processes
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
}

/**
 * Database migration utilities
 */
export class StyleMapDatabaseMigration {
  private db: StyleMapDatabase;

  constructor(database: StyleMapDatabase) {
    this.db = database;
  }

  /**
   * Migrate from version 1 to version 2 (with optimized indexes)
   */
  async migrateToV2(): Promise<void> {
    // This would be called automatically by Dexie when schema version changes
    console.log('Migrating StyleMap database to version 2 with optimized indexes');

    // Any data transformation logic would go here
    // For now, the schema change is handled by Dexie automatically
  }

  /**
   * Rebuild all indexes for performance
   */
  async rebuildIndexes(): Promise<void> {
    // Close and reopen database to rebuild indexes
    await this.db.close();
    await this.db.open();
    console.log('Database indexes rebuilt');
  }

  /**
   * Validate database integrity
   */
  async validateIntegrity(): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for orphaned rows
    const allRows = await this.db.rows.toArray();
    const tableIds = new Set((await this.db.tableMetadata.toArray()).map((t) => t.tableId));

    const orphanedRows = allRows.filter((row) => !tableIds.has(row.tableId));
    if (orphanedRows.length > 0) {
      errors.push(`Found ${orphanedRows.length} orphaned rows`);
    }

    // Check for orphaned working copies
    const workingCopies = await this.db.workingCopies.toArray();
    const entityIds = new Set((await this.db.entities.toArray()).map((e) => e.nodeId));

    const orphanedCopies = workingCopies.filter(
      (wc) => wc.workingCopyOf && !entityIds.has(wc.workingCopyOf)
    );
    if (orphanedCopies.length > 0) {
      warnings.push(`Found ${orphanedCopies.length} orphaned working copies`);
    }

    // Check cache consistency
    const expiredCacheEntries = await this.db.cache.where('expiresAt').below(Date.now()).count();

    if (expiredCacheEntries > 0) {
      warnings.push(`Found ${expiredCacheEntries} expired cache entries`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
