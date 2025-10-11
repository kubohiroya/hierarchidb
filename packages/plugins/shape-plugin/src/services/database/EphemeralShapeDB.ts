/**
 * @file EphemeralShapeDB.ts
 * @description Ephemeral database for Shape Plugin temporary data storage
 */

import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';

/**
 * Raw feature buffer from download stage
 */
export interface RawFeatureBuffer {
  id: string;
  sessionId: string;
  nodeId: NodeId;
  data: string; // GeoJSON string
  featureCount: number;
  bbox: [number, number, number, number];
  downloadTime: number;
  size: number;
  timestamp: number;
}

/**
 * Simplified feature buffer from simplify stages
 */
export interface SimplifiedFeatureBuffer {
  id: string;
  sessionId: string;
  nodeId: NodeId;
  stage: 'simplify1' | 'simplify2';
  data: string; // GeoJSON string
  featureCount: number;
  simplificationRatio: number;
  tolerance: number;
  timestamp: number;
}

/**
 * Vector tile data
 */
export interface VectorTileData {
  id: string;
  sessionId: string;
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
  data: ArrayBuffer; // MVT binary data
  hash: string;
  size: number;
  featureCount: number;
  timestamp: number;
  contentType: string;
}

/**
 * Batch session metadata
 */
export interface BatchSessionMetadata {
  id: string;
  nodeId: NodeId;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  stage: 'download' | 'simplify1' | 'simplify2' | 'vectorTiles';
  progress: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  startTime: number;
  endTime?: number;
  config: Record<string, any>;
  tableId?: string; // optional: tabular-source store linkage
}

/**
 * Processing cache entry
 */
export interface ProcessingCache {
  key: string;
  data: ArrayBuffer | string;
  type: 'raw' | 'simplified' | 'tile';
  size: number;
  lastAccessed: number;
  ttl: number; // Time to live in milliseconds
}

/**
 * Ephemeral database for Shape Plugin
 */
export class EphemeralShapeDB extends Dexie {
  // Tables
  rawBuffers!: Table<RawFeatureBuffer>;
  simplifiedBuffers!: Table<SimplifiedFeatureBuffer>;
  vectorTiles!: Table<VectorTileData>;
  sessions!: Table<BatchSessionMetadata>;
  cache!: Table<ProcessingCache>;

  constructor() {
    super(getDBName('shape-ephemeral-db'));

    // Define schema
    this.version(1).stores({
      rawBuffers: '&id, sessionId, nodeId, timestamp',
      simplifiedBuffers: '&id, sessionId, nodeId, stage, timestamp',
      vectorTiles: '&id, sessionId, nodeId, [z+x+y], hash, timestamp',
      sessions: '&id, nodeId, status, stage, startTime',
      cache: '&key, type, lastAccessed, ttl',
    });
  }

  /**
   * Clear all data for a session
   */
  async clearSession(sessionId: string): Promise<void> {
    await this.transaction('rw', [
      this.rawBuffers,
      this.simplifiedBuffers,
      this.vectorTiles,
      this.sessions,
      this.cache,
    ], async () => {
        await this.rawBuffers.where('sessionId').equals(sessionId).delete();
        await this.simplifiedBuffers.where('sessionId').equals(sessionId).delete();
        await this.vectorTiles.where('sessionId').equals(sessionId).delete();
        await this.sessions.where('id').equals(sessionId).delete();

        // Clear cache entries related to session
        const cacheKeys = await this.cache
          .filter(entry => entry.key.includes(sessionId))
          .primaryKeys();
        await this.cache.bulkDelete(cacheKeys);
      },
    );

    console.log(`Cleared all data for session ${sessionId}`);
  }

  /**
   * Clear expired cache entries
   */
  async clearExpiredCache(): Promise<number> {
    const now = Date.now();
    const expired = await this.cache
      .filter(entry => entry.lastAccessed + entry.ttl < now)
      .toArray();

    if (expired.length > 0) {
      await this.cache.bulkDelete(expired.map(e => e.key));
      console.log(`Cleared ${expired.length} expired cache entries`);
    }

    return expired.length;
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<{
    rawBuffers: number;
    simplifiedBuffers: number;
    vectorTiles: number;
    sessions: number;
    cacheEntries: number;
    totalSize: number;
  }> {
    const [rawCount, simplifiedCount, tileCount, sessionCount, cacheCount] = await Promise.all([
      this.rawBuffers.count(),
      this.simplifiedBuffers.count(),
      this.vectorTiles.count(),
      this.sessions.count(),
      this.cache.count(),
    ]);

    // Calculate approximate total size
    let totalSize = 0;

    const rawBuffers = await this.rawBuffers.toArray();
    totalSize += rawBuffers.reduce((sum, b) => sum + (b.size || 0), 0);

    const tiles = await this.vectorTiles.toArray();
    totalSize += tiles.reduce((sum, t) => sum + t.size, 0);

    const cacheEntries = await this.cache.toArray();
    totalSize += cacheEntries.reduce((sum, c) => sum + c.size, 0);

    return {
      rawBuffers: rawCount,
      simplifiedBuffers: simplifiedCount,
      vectorTiles: tileCount,
      sessions: sessionCount,
      cacheEntries: cacheCount,
      totalSize,
    };
  }

  /**
   * Clear all data (complete reset)
   */
  async clearAll(): Promise<void> {
    await this.transaction('rw', [
      this.rawBuffers,
      this.simplifiedBuffers,
      this.vectorTiles,
      this.sessions,
      this.cache,
    ], async () => {
        await Promise.all([
          this.rawBuffers.clear(),
          this.simplifiedBuffers.clear(),
          this.vectorTiles.clear(),
          this.sessions.clear(),
          this.cache.clear(),
        ]);
      });

    console.log('Cleared all EphemeralShapeDB data');
  }
}

// Singleton instance
let ephemeralDBInstance: EphemeralShapeDB | null = null;

/**
 * Get or create EphemeralShapeDB instance
 */
export function getEphemeralShapeDB(): EphemeralShapeDB {
  if (!ephemeralDBInstance) {
    ephemeralDBInstance = new EphemeralShapeDB();
  }
  return ephemeralDBInstance;
}

/**
 * Close and cleanup database
 */
export async function closeEphemeralShapeDB(): Promise<void> {
  if (ephemeralDBInstance) {
    await ephemeralDBInstance.close();
    ephemeralDBInstance = null;
  }
}
