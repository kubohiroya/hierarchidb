/**
 * @file BaseMapHandler.ts
 * @description EntityHandler implementation for BaseMap plugin using context injection
 * No direct dependency on worker package - uses injected context for database operations
 */

import type { 
  NodeId,
  EntityHandler,
  EntityHandlerContext,
  EntityBackup
} from '@hierarchidb/common-core';
import type { BaseMapEntity, BaseMapWorkingCopy } from '../types';
import { DEFAULT_MAP_CONFIG } from '../types';

/**
 * BaseMap entity handler implementation
 * Uses composition pattern with injected context for database operations
 */
export class BaseMapHandler implements EntityHandler<
  BaseMapEntity,
  never, // No sub-entities for BaseMap
  BaseMapWorkingCopy
> {
  // Context is injected at runtime by the worker
  private context?: EntityHandlerContext<BaseMapEntity, never, BaseMapWorkingCopy>;

  /**
   * Set the context for database operations
   * Called by the worker during plugin registration
   * The handler doesn't know about the implementation details
   */
  setContext(context: EntityHandlerContext<BaseMapEntity, never, BaseMapWorkingCopy>): void {
    this.context = context;
  }

  // ==================
  // EntityHandler Interface Implementation
  // ==================

  async createEntity(nodeId: NodeId, data?: Partial<BaseMapEntity>): Promise<BaseMapEntity> {
    // Create entity with business logic
    const entity: BaseMapEntity = {
      nodeId,
      mapStyle: data?.mapStyle || DEFAULT_MAP_CONFIG.mapStyle,
      center: data?.center || DEFAULT_MAP_CONFIG.center,
      zoom: data?.zoom || DEFAULT_MAP_CONFIG.zoom,
      bearing: data?.bearing || DEFAULT_MAP_CONFIG.bearing,
      pitch: data?.pitch || DEFAULT_MAP_CONFIG.pitch,
      bounds: data?.bounds,
      displayOptions: data?.displayOptions || DEFAULT_MAP_CONFIG.displayOptions,
      apiKey: data?.apiKey,
      attribution: data?.attribution,
      thumbnailUrl: data?.thumbnailUrl,
      tags: data?.tags,
      updatedAt: Date.now(),
      version: 1,
    } as BaseMapEntity;

    // Use context if available (injected at runtime)
    if (this.context) {
      return await this.context.store.create(entity);
    }
    
    // Fallback for testing/standalone use
    return entity;
  }

  async getEntity(nodeId: NodeId): Promise<BaseMapEntity | undefined> {
    if (this.context) {
      return await this.context.store.get(nodeId);
    }
    // Fallback for testing
    return undefined;
  }

  async updateEntity(_nodeId: NodeId, _updates: Partial<BaseMapEntity>): Promise<void> {
    if (this.context) {
      await this.context.store.update(_nodeId, _updates);
    }
  }

  async deleteEntity(_nodeId: NodeId): Promise<void> {
    // Custom cleanup before deletion
    await this.clearTileCache(_nodeId);

    if (this.context) {
      await this.context.store.delete(_nodeId);
    }
  }

  // ==================
  // Working Copy Operations
  // ==================

  async createWorkingCopy(nodeId: NodeId): Promise<BaseMapWorkingCopy> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`BaseMap entity not found for node: ${nodeId}`);
    }

    if (this.context) {
      return await this.context.workingCopy.create(entity);
    }

    // Fallback for testing - create working copy in memory
    return {
      ...entity,
      originalNodeId: nodeId,
      copiedAt: Date.now(),
      hasEntityCopy: true,
      originalVersion: entity.version,
    };
  }

  async commitWorkingCopy(_nodeId: NodeId, workingCopy: BaseMapWorkingCopy): Promise<void> {
    if (!this.context) {
      console.warn('No context available for commitWorkingCopy');
      return;
    }

    await this.context.workingCopy.commit(workingCopy);
  }

  async discardWorkingCopy(_nodeId: NodeId): Promise<void> {
    if (!this.context) {
      console.warn('No context available for discardWorkingCopy');
      return;
    }

    await this.context.workingCopy.discard(_nodeId);
  }

  // ==================
  // Optional EntityHandler Operations
  // ==================

  async duplicate(nodeId: NodeId, newNodeId: NodeId): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`BaseMap entity not found for duplication: ${nodeId}`);
    }

    // Create a copy with new nodeId
    const duplicated: BaseMapEntity = {
      ...entity,
      nodeId: newNodeId,
      updatedAt: Date.now(),
      version: 1,
    };

    if (this.context) {
      await this.context.store.create(duplicated);
    }
  }

  async backup(nodeId: NodeId): Promise<EntityBackup<BaseMapEntity>> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`BaseMap entity not found for backup: ${nodeId}`);
    }

    return {
      entity,
      subEntities: {}, // No sub-entities for BaseMap
      metadata: {
        backupDate: Date.now(),
        version: '1.0.0',
        nodeType: 'basemap',
      },
    };
  }

  async restore(nodeId: NodeId, backup: EntityBackup<BaseMapEntity>): Promise<void> {
    if (!this.context) {
      console.warn('No context available for restore');
      return;
    }

    // Restore the entity with current nodeId
    const restoredEntity: BaseMapEntity = {
      ...backup.entity,
      nodeId,
      updatedAt: Date.now(),
      version: 1,
    };

    await this.context.store.update(nodeId, restoredEntity);
  }

  async cleanup(nodeId: NodeId): Promise<void> {
    // Clean up any associated resources
    await this.clearTileCache(nodeId);
    
    // Delete the entity
    await this.deleteEntity(nodeId);
  }

  // ==================
  // BaseMap-Specific Business Logic
  // ==================

  /**
   * Change map style and clear tile cache
   */
  async changeMapStyle(nodeId: NodeId, style: BaseMapEntity['mapStyle']): Promise<void> {
    await this.updateEntity(nodeId, { mapStyle: style });
    await this.clearTileCache(nodeId);
  }

  /**
   * Set map bounds and calculate center/zoom
   */
  async setBounds(nodeId: NodeId, bounds: [[number, number], [number, number]]): Promise<void> {
    const center = this.calculateCenter(bounds);
    const zoom = this.calculateZoom(bounds);

    await this.updateEntity(nodeId, {
      bounds,
      center,
      zoom,
    });
  }

  /**
   * Find nearby maps within radius
   * Note: This would require specialized query support in context
   */
  async findNearbyMaps(center: [number, number], radius: number): Promise<BaseMapEntity[]> {
    // This would need a specialized query method in context
    // For now, return empty array
    console.log(`Finding maps near [${center}] within ${radius}km`);
    return [];
  }

  // ==================
  // Private Helper Methods
  // ==================



  private async clearTileCache(nodeId: NodeId): Promise<void> {
    // Custom tile cache clearing logic
    // In a real implementation, this might use a separate service
    console.log(`[BaseMapHandler] Clearing tile cache for map: ${nodeId}`);
    
    // If we had a separate tile cache context, we'd use it here
    // For now, this is just a placeholder
  }

  private calculateCenter(bounds: [[number, number], [number, number]]): [number, number] {
    const [[west, south], [east, north]] = bounds;
    return [(west + east) / 2, (south + north) / 2];
  }

  private calculateZoom(bounds: [[number, number], [number, number]]): number {
    const [[west, south], [east, north]] = bounds;
    const maxDiff = Math.max(Math.abs(east - west), Math.abs(north - south));

    // Simple zoom calculation based on bounds size
    if (maxDiff > 180) return 1;
    if (maxDiff > 90) return 2;
    if (maxDiff > 45) return 3;
    if (maxDiff > 22.5) return 4;
    if (maxDiff > 11.25) return 5;
    if (maxDiff > 5.625) return 6;
    if (maxDiff > 2.813) return 7;
    if (maxDiff > 1.406) return 8;
    if (maxDiff > 0.703) return 9;
    return 10;
  }

}