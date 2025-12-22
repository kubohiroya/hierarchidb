/**
 * @file RouteDatabase.ts
 * @description Database schema and operations for Route plugin
 */

import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type { RouteEntity, RouteUpdaterPayload } from '../../common/entities/RouteEntity.js';

/**
 * Route cache entry
 */
export interface RouteCacheEntry {
  id: string;
  routeId: NodeId;
  cacheKey: string;
  data: unknown;
  createdAt: number;
  expiresAt: number;
}

export interface RouteCursorRow {
  sessionId: string;
  completed: number;
  total: number;
  paused?: boolean;
  updatedAt: number;
  /** Optional reference to persisted result table (set on commit). */
  tableId?: string;
}

export interface RouteResultRow {
  id: string;
  routeId: NodeId;
  sessionId: string;
  taskId: string;
  method: string;
  lineGeometry?: [number, number][];
  distance?: number;
  duration?: number;
  createdAt: number;
  result?: {
    name?: string;
    coordinates?: [number, number];
    payload?: Record<string, unknown>;
  };
}

/**
 * Route database schema
 */
export interface PendingRouteSessionRecord {
  nodeId: NodeId;
  config: unknown;
  routes: unknown;
  storedAt: number;
}

export class RouteDatabase extends Dexie {
  routes!: Table<RouteEntity, NodeId>;
  workingCopies!: Table<RouteUpdaterPayload, NodeId>;
  routeCache!: Table<RouteCacheEntry, string>;
  // Batch session tracking (cursor/progress)
  routeCursors!: Table<RouteCursorRow, string>;
  // Optional results storage for batch-generated routes
  routeResults!: Table<RouteResultRow, string>;
  pendingSessions!: Table<PendingRouteSessionRecord, NodeId>;

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
      routeResults: '&id, sessionId, taskId, method, createdAt',
    });
    this.version(3).stores({
      pendingSessions: '&nodeId, storedAt',
    });
    this.version(4).stores({
      routes: '&id, nodeId, startLocationId, endLocationId, transportMode, [startLocationId+endLocationId], processingStatus, createdAt, updatedAt',
      workingCopies: '&id, nodeId, copiedAt',
      routeCache: '&id, routeId, cacheKey, expiresAt',
      routeCursors: '&sessionId, completed, total, updatedAt',
      routeResults: '&id, routeId, sessionId, taskId, method, createdAt',
      pendingSessions: '&nodeId, storedAt',
    });

    this.routes = this.table('routes');
    this.workingCopies = this.table('workingCopies');
    this.routeCache = this.table('routeCache');
    this.routeCursors = this.table('routeCursors');
    this.routeResults = this.table('routeResults');
    this.pendingSessions = this.table('pendingSessions');
  }

  async savePendingSession(record: PendingRouteSessionRecord): Promise<void> {
    await this.pendingSessions.put(record);
  }

  async takePendingSession(nodeId: NodeId): Promise<PendingRouteSessionRecord | undefined> {
    const record = await this.pendingSessions.get(nodeId);
    if (record) {
      await this.pendingSessions.delete(nodeId);
    }
    return record;
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
  async cleanupRouteCache(routeId: NodeId): Promise<void> {
    await this.routeCache
      .where('routeId')
      .equals(routeId)
      .delete();
  }

  /**
   * Get cached data for route
   */
  async getCachedData(routeId: NodeId, cacheKey: string): Promise<unknown | null> {
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
    routeId: NodeId,
    cacheKey: string,
    data: unknown,
    ttl: number = 3600000, // 1 hour default
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
  async cleanupExpiredDrafts(maxAge: number = 86400000): Promise<void> {
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
    totalDrafts: number;
    totalCacheEntries: number;
    cacheSize: number;
  }> {
    const [totalRoutes, totalDrafts, totalCacheEntries] = await Promise.all([
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
      totalDrafts,
      totalCacheEntries,
      cacheSize,
    };
  }
}
