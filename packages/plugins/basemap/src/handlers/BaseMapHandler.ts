/**
 * @file BaseMapHandler.ts
 * @description EntityHandler implementation for BaseMap plugin
 * References:
 * - docs/7-aop-architecture.md
 * - ../eria-cartograph/app0/src/domains/resources/basemap/services/BaseMapWorkerService.ts
 */

import type { TreeNodeId } from '@hierarchidb/core';
import type { EntityHandler, EntityBackup } from '@hierarchidb/worker/registry';
import type { BaseMapEntity, BaseMapWorkingCopy } from '../types';
import { DEFAULT_MAP_CONFIG } from '../types';
import { BaseMapDatabase } from '../database/BaseMapDatabase';

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * BaseMap entity handler implementation
 * Manages CRUD operations and working copies for BaseMap entities
 */
export class BaseMapHandler
  implements
    EntityHandler<
      BaseMapEntity,
      never, // No sub-entities for BaseMap
      BaseMapWorkingCopy
    >
{
  private db: BaseMapDatabase;

  constructor(db?: BaseMapDatabase) {
    this.db = db || BaseMapDatabase.getInstance();
  }

  /**
   * Create a new BaseMap entity
   */
  async createEntity(nodeId: TreeNodeId, data?: Partial<BaseMapEntity>): Promise<BaseMapEntity> {
    const now = Date.now();

    const entity: BaseMapEntity = {
      nodeId,
      name: data?.name || DEFAULT_MAP_CONFIG.name || 'New BaseMap',
      description: data?.description,
      mapStyle: data?.mapStyle || DEFAULT_MAP_CONFIG.mapStyle || 'streets',
      styleUrl: data?.styleUrl,
      styleConfig: data?.styleConfig,
      center: data?.center || DEFAULT_MAP_CONFIG.center || [0, 0],
      zoom: data?.zoom ?? DEFAULT_MAP_CONFIG.zoom ?? 10,
      bearing: data?.bearing ?? DEFAULT_MAP_CONFIG.bearing ?? 0,
      pitch: data?.pitch ?? DEFAULT_MAP_CONFIG.pitch ?? 0,
      bounds: data?.bounds,
      displayOptions: data?.displayOptions || DEFAULT_MAP_CONFIG.displayOptions,
      apiKey: data?.apiKey,
      attribution: data?.attribution,
      thumbnailUrl: data?.thumbnailUrl,
      tags: data?.tags,
      createdAt: data?.createdAt || now,
      updatedAt: data?.updatedAt || now,
      version: data?.version || 1,
    };

    await this.db.entities.add(entity);
    return entity;
  }

  /**
   * Get a BaseMap entity by nodeId
   */
  async getEntity(nodeId: TreeNodeId): Promise<BaseMapEntity | undefined> {
    return await this.db.entities.get(nodeId);
  }

  /**
   * Update a BaseMap entity
   */
  async updateEntity(nodeId: TreeNodeId, data: Partial<BaseMapEntity>): Promise<void> {
    const existing = await this.getEntity(nodeId);
    if (!existing) {
      throw new Error(`BaseMap entity not found: ${nodeId}`);
    }

    const updates = {
      ...data,
      nodeId, // Ensure nodeId is not changed
      updatedAt: Date.now(),
      version: (existing.version || 0) + 1,
    };

    await this.db.entities.update(nodeId, updates);
  }

  /**
   * Delete a BaseMap entity
   */
  async deleteEntity(nodeId: TreeNodeId): Promise<void> {
    // Delete any working copies first
    const workingCopy = await this.db.workingCopies.where('workingCopyOf').equals(nodeId).first();

    if (workingCopy) {
      await this.db.workingCopies.delete(workingCopy.workingCopyId);
    }

    // Delete the entity
    await this.db.entities.delete(nodeId);
  }

  /**
   * Create a working copy of a BaseMap entity
   */
  async createWorkingCopy(nodeId: TreeNodeId): Promise<BaseMapWorkingCopy> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`BaseMap entity not found: ${nodeId}`);
    }

    // Check if a working copy already exists
    const existingWorkingCopy = await this.db.workingCopies
      .where('workingCopyOf')
      .equals(nodeId)
      .first();

    if (existingWorkingCopy) {
      return existingWorkingCopy;
    }

    const workingCopy: BaseMapWorkingCopy = {
      ...entity,
      workingCopyId: generateUUID(),
      workingCopyOf: nodeId,
      copiedAt: Date.now(),
      isDirty: false,
    };

    await this.db.workingCopies.add(workingCopy);
    return workingCopy;
  }

  /**
   * Commit a working copy back to the entity
   */
  async commitWorkingCopy(nodeId: TreeNodeId, workingCopy: BaseMapWorkingCopy): Promise<void> {
    // Extract working copy specific fields
    const { workingCopyId, workingCopyOf, copiedAt, isDirty, ...entityData } = workingCopy;

    // Update the entity with working copy data
    await this.updateEntity(nodeId, entityData);

    // Delete the working copy
    await this.db.workingCopies.delete(workingCopyId);
  }

  /**
   * Discard a working copy
   */
  async discardWorkingCopy(nodeId: TreeNodeId): Promise<void> {
    const workingCopy = await this.db.workingCopies.where('workingCopyOf').equals(nodeId).first();

    if (workingCopy) {
      await this.db.workingCopies.delete(workingCopy.workingCopyId);
    }
  }

  /**
   * Duplicate a BaseMap entity
   */
  async duplicate(nodeId: TreeNodeId, newNodeId: TreeNodeId): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`BaseMap entity not found: ${nodeId}`);
    }

    await this.createEntity(newNodeId, {
      ...entity,
      nodeId: newNodeId,
      name: `${entity.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });
  }

  /**
   * Create a backup of a BaseMap entity
   */
  async backup(nodeId: TreeNodeId): Promise<EntityBackup<BaseMapEntity>> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`BaseMap entity not found: ${nodeId}`);
    }

    return {
      entity,
      subEntities: {}, // No sub-entities for BaseMap
      metadata: {
        backupDate: Date.now(),
        version: '1.0.0',
        nodeType: 'basemap' as any,
      },
    };
  }

  /**
   * Restore a BaseMap entity from backup
   */
  async restore(nodeId: TreeNodeId, backup: EntityBackup<BaseMapEntity>): Promise<void> {
    const { entity } = backup;

    // Check if entity exists
    const existing = await this.getEntity(nodeId);

    if (existing) {
      // Update existing entity
      await this.updateEntity(nodeId, {
        ...entity,
        nodeId, // Ensure nodeId matches
        updatedAt: Date.now(),
        version: existing.version + 1,
      });
    } else {
      // Create new entity
      await this.createEntity(nodeId, entity);
    }
  }

  /**
   * Cleanup resources associated with a BaseMap entity
   */
  async cleanup(nodeId: TreeNodeId): Promise<void> {
    // Discard any working copies
    await this.discardWorkingCopy(nodeId);

    // Clear tile cache if implemented
    await this.clearTileCache(nodeId);
  }

  // ==================
  // Extended API Methods (from existing BaseMapPlugin.ts)
  // ==================

  /**
   * Change map style
   */
  async changeMapStyle(nodeId: TreeNodeId, style: BaseMapEntity['mapStyle']): Promise<void> {
    await this.updateEntity(nodeId, { mapStyle: style });
    // Clear cache when style changes
    await this.clearTileCache(nodeId);
  }

  /**
   * Set map bounds and calculate center/zoom
   */
  async setBounds(nodeId: TreeNodeId, bounds: BaseMapEntity['bounds']): Promise<void> {
    if (!bounds) return;

    const entity = await this.getEntity(nodeId);
    if (!entity) throw new Error('BaseMap not found');

    // Calculate center and zoom from bounds
    const center = this.calculateCenter(bounds);
    const zoom = this.calculateZoom(bounds);

    await this.updateEntity(nodeId, {
      bounds,
      center,
      zoom,
    });
  }

  /**
   * Export map state
   */
  async exportMapState(nodeId: TreeNodeId): Promise<{
    entity: BaseMapEntity;
    tilesInCache?: number;
  }> {
    const entity = await this.getEntity(nodeId);
    if (!entity) throw new Error('BaseMap not found');

    return {
      entity,
      tilesInCache: 0, // Placeholder - implement tile caching separately
    };
  }

  /**
   * Find nearby maps within radius
   */
  async findNearbyMaps(center: [number, number], radius: number): Promise<BaseMapEntity[]> {
    const allMaps = await this.getAllEntities();

    return allMaps.filter((map) => {
      const distance = this.calculateDistance(center, map.center);
      return distance <= radius;
    });
  }

  // ==================
  // Helper Methods
  // ==================

  /**
   * Calculate center from bounds
   */
  private calculateCenter(bounds: NonNullable<BaseMapEntity['bounds']>): [number, number] {
    const [[west, south], [east, north]] = bounds;
    return [(west + east) / 2, (south + north) / 2];
  }

  /**
   * Calculate appropriate zoom level from bounds
   */
  private calculateZoom(bounds: NonNullable<BaseMapEntity['bounds']>): number {
    const [[west, south], [east, north]] = bounds;
    const longitudeDiff = Math.abs(east - west);
    const latitudeDiff = Math.abs(north - south);

    // Simple implementation - in practice would need more complex calculation
    const maxDiff = Math.max(longitudeDiff, latitudeDiff);

    if (maxDiff > 180) return 1;
    if (maxDiff > 90) return 2;
    if (maxDiff > 45) return 3;
    if (maxDiff > 22.5) return 4;
    if (maxDiff > 11.25) return 5;
    if (maxDiff > 5.625) return 6;
    if (maxDiff > 2.813) return 7;
    if (maxDiff > 1.406) return 8;
    if (maxDiff > 0.703) return 9;
    if (maxDiff > 0.352) return 10;
    if (maxDiff > 0.176) return 11;
    if (maxDiff > 0.088) return 12;
    if (maxDiff > 0.044) return 13;
    if (maxDiff > 0.022) return 14;
    return 15;
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(point1: [number, number], point2: [number, number]): number {
    const [lon1, lat1] = point1;
    const [lon2, lat2] = point2;

    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Clear tile cache (placeholder - implement with proper caching system)
   */
  private async clearTileCache(nodeId: TreeNodeId): Promise<void> {
    // Implement tile cache clearing when cache system is added
    // For now, this is a placeholder
    if (process.env.NODE_ENV === 'development') {
      console.log(`Clearing tile cache for BaseMap: ${nodeId}`);
    }
  }

  /**
   * Get all BaseMap entities (utility method)
   */
  async getAllEntities(): Promise<BaseMapEntity[]> {
    return await this.db.entities.toArray();
  }

  /**
   * Get working copy by ID (utility method)
   */
  async getWorkingCopyById(workingCopyId: string): Promise<BaseMapWorkingCopy | undefined> {
    return await this.db.workingCopies.get(workingCopyId);
  }

  /**
   * Update working copy (utility method)
   */
  async updateWorkingCopy(
    workingCopyId: string,
    updates: Partial<BaseMapWorkingCopy>
  ): Promise<void> {
    const workingCopy = await this.getWorkingCopyById(workingCopyId);
    if (!workingCopy) {
      throw new Error(`Working copy not found: ${workingCopyId}`);
    }

    await this.db.workingCopies.update(workingCopyId, {
      ...updates,
      isDirty: true,
      updatedAt: Date.now(),
    });
  }
}
