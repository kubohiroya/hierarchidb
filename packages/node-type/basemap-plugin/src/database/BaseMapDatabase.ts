/**
 * @file BaseMapDatabase.ts  
 * @description Database class for BaseMap plugin using Dexie
 */

import Dexie from 'dexie';
import type { BaseMapEntity, BaseMapWorkingCopy } from '../types/BaseMapEntity';

/**
 * BaseMap Database
 * Manages BaseMap entities and working copies with IndexedDB
 */
export class BaseMapDatabase extends Dexie {
  baseMaps!: Dexie.Table<BaseMapEntity, string>;
  workingCopies!: Dexie.Table<BaseMapWorkingCopy, string>;

  constructor() {
    super('BaseMapDatabase');

    this.version(1).stores({
      baseMaps: '&id, nodeId, name, createdAt, updatedAt, baseMapMetadataId',
      workingCopies: '&id, nodeId, originalId, createdAt, copiedAt'
    });
  }

  /**
   * Clean up expired working copies
   * @param maxAge Maximum age in milliseconds (default: 24 hours)
   */
  async cleanupExpiredWorkingCopies(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAge;
    await this.workingCopies.where('copiedAt').below(cutoff).delete();
  }

  /**
   * Get all BaseMaps for a specific metadata ID
   */
  async getByMetadataId(metadataId: string): Promise<BaseMapEntity[]> {
    return await this.baseMaps.where('baseMapMetadataId').equals(metadataId).toArray();
  }

  /**
   * Count BaseMaps by style type
   */
  async countByMapStyle(): Promise<Record<string, number>> {
    const baseMaps = await this.baseMaps.toArray();
    const counts: Record<string, number> = {};

    for (const baseMap of baseMaps) {
      const style = baseMap.mapStyle.style;
      counts[style] = (counts[style] || 0) + 1;
    }

    return counts;
  }

  /**
   * Get BaseMaps with custom styles
   */
  async getCustomStyleBaseMaps(): Promise<BaseMapEntity[]> {
    const baseMaps = await this.baseMaps.toArray();
    return baseMaps.filter(baseMap => 
      baseMap.mapStyle.style === 'custom' && baseMap.mapStyle.customStyleUrl
    );
  }
}