/**
 * @file BaseMapDatabase.ts
 * @description Dexie database for BaseMap entities
 */

import Dexie, { Table } from 'dexie';
import type { BaseMapEntity, BaseMapWorkingCopy } from '../types';
import type { NodeId } from '@hierarchidb/common-core';

/**
 * BaseMap database schema
 */
export class BaseMapDatabase extends Dexie {
  entities!: Table<BaseMapEntity, NodeId>;
  workingCopies!: Table<BaseMapWorkingCopy, string>;

  constructor() {
    super('BaseMapDB');

    // Define schema
    this.version(1).stores({
      entities: 'nodeId, name, mapStyle, createdAt, updatedAt',
      workingCopies: 'workingCopyId, workingCopyOf, nodeId, copiedAt',
    });
  }

  /**
   * Get or create database instance
   */
  private static instance: BaseMapDatabase | null = null;

  static getInstance(): BaseMapDatabase {
    if (!BaseMapDatabase.instance) {
      BaseMapDatabase.instance = new BaseMapDatabase();
    }
    return BaseMapDatabase.instance;
  }

  /**
   * Clear all data (useful for testing)
   */
  async clearAll(): Promise<void> {
    await this.entities.clear();
    await this.workingCopies.clear();
  }

  /**
   * Close database connection
   */
  static async close(): Promise<void> {
    if (BaseMapDatabase.instance) {
      await BaseMapDatabase.instance.close();
      BaseMapDatabase.instance = null;
    }
  }
}
