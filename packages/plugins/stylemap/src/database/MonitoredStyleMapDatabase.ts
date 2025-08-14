/**
 * @file MonitoredStyleMapDatabase.ts
 * @description Monitored wrapper for StyleMapDatabase that preserves Dexie types
 */

import type { StyleMapDatabase } from './StyleMapDatabase';
import type { StyleMapEntity, RowEntity } from '../types';
import type { TreeNodeId } from '@hierarchidb/core';

/**
 * Performance metrics for database operations
 */
export interface DatabaseMetrics {
  totalQueries: number;
  totalWrites: number;
  averageQueryTime: number;
  averageWriteTime: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * Wrapper class that monitors StyleMapDatabase operations
 * This approach avoids PromiseExtended type issues by wrapping at a higher level
 */
export class MonitoredStyleMapDatabase {
  private metrics: DatabaseMetrics = {
    totalQueries: 0,
    totalWrites: 0,
    averageQueryTime: 0,
    averageWriteTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor(private db: StyleMapDatabase) {}

  /**
   * Monitored entity retrieval
   */
  async getEntity(nodeId: TreeNodeId): Promise<StyleMapEntity | undefined> {
    const startTime = performance.now();
    try {
      const result = await this.db.getEntity(nodeId);
      this.recordQuery(performance.now() - startTime, !!result);
      return result;
    } catch (error) {
      this.recordQuery(performance.now() - startTime, false);
      throw error;
    }
  }

  /**
   * Monitored entity update
   */
  async updateEntity(nodeId: TreeNodeId, updates: Partial<StyleMapEntity>): Promise<void> {
    const startTime = performance.now();
    try {
      await this.db.updateEntity(nodeId, updates);
      this.recordWrite(performance.now() - startTime);
    } catch (error) {
      this.recordWrite(performance.now() - startTime);
      throw error;
    }
  }

  /**
   * Monitored bulk row insertion
   */
  async bulkInsertRows(rows: RowEntity[]): Promise<void> {
    const startTime = performance.now();
    try {
      // Use the Dexie table directly for bulk operations
      await this.db.rows.bulkPut(rows);
      this.recordWrite(performance.now() - startTime);
    } catch (error) {
      this.recordWrite(performance.now() - startTime);
      throw error;
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): DatabaseMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalQueries: 0,
      totalWrites: 0,
      averageQueryTime: 0,
      averageWriteTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  private recordQuery(duration: number, hit: boolean): void {
    this.metrics.totalQueries++;
    if (hit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }

    // Update running average
    const prevAvg = this.metrics.averageQueryTime;
    const prevCount = this.metrics.totalQueries - 1;
    this.metrics.averageQueryTime = (prevAvg * prevCount + duration) / this.metrics.totalQueries;
  }

  private recordWrite(duration: number): void {
    this.metrics.totalWrites++;

    // Update running average
    const prevAvg = this.metrics.averageWriteTime;
    const prevCount = this.metrics.totalWrites - 1;
    this.metrics.averageWriteTime = (prevAvg * prevCount + duration) / this.metrics.totalWrites;
  }

  /**
   * Delegate all other methods to the underlying database
   */
  get entities() {
    return this.db.entities;
  }

  get rows() {
    return this.db.rows;
  }

  get cache() {
    return this.db.cache;
  }
}
