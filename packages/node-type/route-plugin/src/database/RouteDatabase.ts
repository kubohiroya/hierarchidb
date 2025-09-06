/**
 * @file RouteDatabase.ts
 * @description Database schema and operations for Route plugin
 */

import Dexie, { type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { EntityId } from '@hierarchidb/common-type';
import type { RouteEntity, RouteWorkingCopy } from '../entities/RouteEntity';

/**
 * Route cache entry
 */
export interface RouteCacheEntry {
  id: string;
  routeId: EntityId;
  cacheKey: string;
  data: any;
  createdAt: number;
  expiresAt: number;
}

/**
 * Route database schema
 */
export class RouteDatabase extends Dexie {
  routes!: Table<RouteEntity, EntityId>;
  workingCopies!: Table<RouteWorkingCopy, EntityId>;
  routeCache!: Table<RouteCacheEntry, string>;
  // Batch session tracking (cursor/progress)
  routeCursors!: Table<{ sessionId: string; completed: number; total: number; paused?: boolean; updatedAt: number }, string>;
  // Optional results storage for batch-generated routes
  routeResults!: Table<{ id: string; sessionId: string; taskId: string; method: string; lineGeometry: [number, number][]; distance?: number; duration?: number; createdAt: number }, string>;

  constructor(dbName: string = getDBName('route-db')) {
    super(dbName);
    
    this.version(1).stores({
      routes: '&id, nodeId, startLocationId, endLocationId, transportMode, [startLocationId+endLocationId], processingStatus, createdAt, updatedAt',
      workingCopies: '&id, nodeId, copiedAt',
      routeCache: '&id, routeId, cacheKey, expiresAt',
    });
    // v2: add cursor/results tables for batch processing (idempotency, pause/resume, observability)
    this.version(2).stores({
      routeCursors: '&sessionId, completed, total, updatedAt',
      routeResults: '&id, sessionId, taskId, method, createdAt'
    });
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredCache(): Promise<void> {
    const now = Date.now();
    await this.routeCache
      .where('expiresAt')
      .below(now)
      .delete();
  }

  /**
   * Clean up route-specific cache
   */
  async cleanupRouteCache(routeId: EntityId): Promise<void> {
    await this.routeCache
      .where('routeId')
      .equals(routeId)
      .delete();
  }

  /**
   * Get cached data for route
   */
  async getCachedData(routeId: EntityId, cacheKey: string): Promise<any | null> {
    const entry = await this.routeCache
      .where('[routeId+cacheKey]')
      .equals([routeId, cacheKey])
      .first();
    
    if (!entry) return null;
    
    // Check if expired
    if (entry.expiresAt < Date.now()) {
      await this.routeCache.delete(entry.id);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set cached data for route
   */
  async setCachedData(
    routeId: EntityId,
    cacheKey: string,
    data: any,
    ttl: number = 3600000 // 1 hour default
  ): Promise<void> {
    const now = Date.now();
    const entry: RouteCacheEntry = {
      id: `${routeId}_${cacheKey}`,
      routeId,
      cacheKey,
      data,
      createdAt: now,
      expiresAt: now + ttl,
    };
    
    await this.routeCache.put(entry);
  }

  /**
   * Clean up expired working copies
   */
  async cleanupExpiredWorkingCopies(maxAge: number = 86400000): Promise<void> {
    const cutoff = Date.now() - maxAge;
    await this.workingCopies
      .where('copiedAt')
      .below(cutoff)
      .delete();
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<{
    totalRoutes: number;
    totalWorkingCopies: number;
    totalCacheEntries: number;
    cacheSize: number;
  }> {
    const [totalRoutes, totalWorkingCopies, totalCacheEntries] = await Promise.all([
      this.routes.count(),
      this.workingCopies.count(),
      this.routeCache.count(),
    ]);
    
    // Estimate cache size
    const cacheEntries = await this.routeCache.toArray();
    const cacheSize = cacheEntries.reduce((sum, entry) => {
      return sum + JSON.stringify(entry.data).length;
    }, 0);
    
    return {
      totalRoutes,
      totalWorkingCopies,
      totalCacheEntries,
      cacheSize,
    };
  }
}
