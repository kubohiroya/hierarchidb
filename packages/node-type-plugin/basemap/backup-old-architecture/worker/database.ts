/**
 * BaseMap database configuration and migrations
 */

import type { Dexie } from 'dexie';
import { BaseMapEntity } from '../shared';

/**
 * Type for database with basemaps table
 */
type BaseMapDB = Dexie & {
  basemaps: Dexie.Table<BaseMapEntity>;
};

/**
 * Database configuration for BaseMap entities
 */
export const BaseMapDatabaseConfig = {
  entityStore: 'basemaps',
  version: 1,
  schema: {
    // Primary key and core fields
    '&id': 'EntityId',
    'nodeId': 'NodeId', 
    
    // Content fields for indexing and searching
    'name': 'string',
    'description': 'string',
    'mapStyle': 'string',
    
    // Compound indices for efficient querying
    '[mapStyle+name]': '', // Find basemaps by style and name
    '[nodeId+updatedAt]': '', // Find recent basemaps for node
    
    // Timestamp indices
    'createdAt': 'number',
    'updatedAt': 'number',
    
    // Version for conflict resolution
    'version': 'number',
    
    // Geographic indices (if needed for spatial queries)
    // Note: Dexie doesn't support spatial indices natively,
    // but we can index on individual coordinates for range queries
    'center': '',
    'zoom': 'number'
  },
  indices: [
    'nodeId',
    'name',
    'mapStyle',
    '[mapStyle+name]',
    '[nodeId+updatedAt]',
    'createdAt',
    'updatedAt',
    'zoom'
  ]
};

/**
 * Database migrations for BaseMap schema changes
 */
export const BaseMapMigrations = [
  {
    version: 1,
    description: 'Initial BaseMap schema',
    upgrade: async () => {
      console.log('Creating BaseMap table with initial schema');
      // Initial schema is created automatically by Dexie
      // This is a placeholder for future migrations
    }
  }
  
  // Future migrations would be added here as new versions
  // Example:
  // {
  //   version: 2,
  //   description: 'Add tags support',
  //   upgrade: async (transaction) => {
  //     // Migration logic to add tags field
  //   }
  // }
];

/**
 * BaseMap-specific database utilities
 */
export class BaseMapDatabase {
  /**
   * Find basemaps by style
   */
  static async findByMapStyle(db: BaseMapDB, mapStyle: string): Promise<BaseMapEntity[]> {
    return await db.basemaps
      .where('mapStyle')
      .equals(mapStyle)
      .toArray();
  }

  /**
   * Find basemaps by name pattern
   */
  static async findByNamePattern(db: BaseMapDB, namePattern: string): Promise<BaseMapEntity[]> {
    return await db.basemaps
      .where('name')
      .startsWithIgnoreCase(namePattern)
      .or('description')
      .startsWithIgnoreCase(namePattern)
      .toArray();
  }

  /**
   * Find basemaps within zoom range
   */
  static async findByZoomRange(db: BaseMapDB, minZoom: number, maxZoom: number): Promise<BaseMapEntity[]> {
    return await db.basemaps
      .where('zoom')
      .between(minZoom, maxZoom, true, true)
      .toArray();
  }

  /**
   * Get recently updated basemaps for a node
   */
  static async getRecentByNode(db: BaseMapDB, nodeId: string, limit: number = 10): Promise<BaseMapEntity[]> {
    return await db.basemaps
      .where('[nodeId+updatedAt]')
      .between([nodeId, 0], [nodeId, Date.now()], true, true)
      .reverse()
      .limit(limit)
      .toArray();
  }

  /**
   * Find basemaps by style and name (compound index)
   */
  static async findByStyleAndName(db: BaseMapDB, mapStyle: string, namePrefix: string): Promise<BaseMapEntity[]> {
    return await db.basemaps
      .where('[mapStyle+name]')
      .between([mapStyle, namePrefix], [mapStyle, namePrefix + '\uffff'])
      .toArray();
  }

  /**
   * Get basemap statistics
   */
  static async getStatistics(db: BaseMapDB): Promise<BaseMapDatabaseStats> {
    const all = await db.basemaps.toArray();
    const styleGroups = new Map<string, number>();
    
    for (const entity of all) {
      const count = styleGroups.get(entity.mapStyle) || 0;
      styleGroups.set(entity.mapStyle, count + 1);
    }

    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const recentCount = all.filter((e: BaseMapEntity) => e.updatedAt > oneWeekAgo).length;

    return {
      totalCount: all.length,
      styleDistribution: Object.fromEntries(styleGroups),
      recentlyUpdated: recentCount,
      averageZoom: all.reduce((sum: number, e: BaseMapEntity) => sum + e.zoom, 0) / all.length || 0,
      oldestCreated: Math.min(...all.map((e: BaseMapEntity) => e.createdAt)),
      newestCreated: Math.max(...all.map((e: BaseMapEntity) => e.createdAt))
    };
  }
}

/**
 * Database statistics interface
 */
export interface BaseMapDatabaseStats {
  totalCount: number;
  styleDistribution: Record<string, number>;
  recentlyUpdated: number;
  averageZoom: number;
  oldestCreated: number;
  newestCreated: number;
}