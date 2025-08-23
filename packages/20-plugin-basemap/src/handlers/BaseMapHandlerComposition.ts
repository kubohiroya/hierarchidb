/**
 * BaseMap Entity Handler using Composition Pattern
 * The handler doesn't know about database implementation details
 */
import type { EntityHandler, NodeId, EntityId, EntityHandlerContext } from '@hierarchidb/00-core';
import type { BaseMapEntity, BaseMapWorkingCopy } from '../types';

/**
 * BaseMap entity handler with composition
 * Context is injected at runtime by the worker
 */
export class BaseMapHandler implements EntityHandler<BaseMapEntity, never, BaseMapWorkingCopy> {
  private context?: EntityHandlerContext<BaseMapEntity, never, BaseMapWorkingCopy>;

  /**
   * Set the context (called by worker at plugin registration)
   * The handler doesn't know what's inside the context
   */
  setContext(context: EntityHandlerContext<BaseMapEntity, never, BaseMapWorkingCopy>): void {
    this.context = context;
  }

  // ==================
  // EntityHandler Implementation
  // ==================

  async createEntity(nodeId: NodeId, data?: Partial<BaseMapEntity>): Promise<BaseMapEntity> {
    // Create entity with business logic
    const entity: BaseMapEntity = {
      id: crypto.randomUUID() as EntityId,
      nodeId,
      name: data?.name || 'New Map',
      createdAt: Date.now(),
      mapStyle: data?.mapStyle || 'streets',
      center: data?.center || [0, 0],
      zoom: data?.zoom || 10,
      bearing: data?.bearing || 0,
      pitch: data?.pitch || 0,
      displayOptions: data?.displayOptions || {
        show3dBuildings: false,
        showTraffic: false,
        showTransit: false,
        showTerrain: false,
        showLabels: true,
      },
      apiKey: data?.apiKey,
      attribution: data?.attribution,
      thumbnailUrl: data?.thumbnailUrl,
      tags: data?.tags,
      updatedAt: Date.now(),
      version: 1,
    };

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
    return undefined;
  }

  async updateEntity(nodeId: NodeId, data: Partial<BaseMapEntity>): Promise<void> {
    if (!this.context) return;

    // Business logic: clear tile cache if map view changed
    const existing = await this.getEntity(nodeId);
    if (existing && this.shouldClearTileCache(existing, data)) {
      await this.clearTileCache(nodeId);
    }

    // Delegate storage to context
    await this.context.store.update(nodeId, data);
  }

  async deleteEntity(nodeId: NodeId): Promise<void> {
    // Custom cleanup before deletion
    await this.clearTileCache(nodeId);

    if (this.context) {
      await this.context.store.delete(nodeId);
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

    // Fallback for testing
    return {
      ...entity,
      originalNodeId: nodeId,
      copiedAt: Date.now(),
      hasEntityCopy: true,
      originalVersion: entity.version,
    };
  }

  async commitWorkingCopy(_nodeId: NodeId, workingCopy: BaseMapWorkingCopy): Promise<void> {
    if (this.context) {
      await this.context.workingCopy.commit(workingCopy);
    }
  }

  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    if (this.context) {
      await this.context.workingCopy.discard(nodeId);
    }
  }

  // ==================
  // Business Logic (BaseMap specific)
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
   */
  async findNearbyMaps(_center: [number, number], _radius: number): Promise<BaseMapEntity[]> {
    // This would need a specialized query method in context
    // For now, return empty array
    return [];
  }

  // ==================
  // Private Helper Methods
  // ==================

  private shouldClearTileCache(
    _existing: BaseMapEntity,
    updates: Partial<BaseMapEntity>
  ): boolean {
    return !!(
      updates.mapStyle ||
      updates.center ||
      updates.zoom ||
      updates.bearing ||
      updates.pitch
    );
  }

  private async clearTileCache(nodeId: NodeId): Promise<void> {
    // Custom tile cache clearing logic
    // This might use a separate context or service
    console.log(`Clearing tile cache for map: ${nodeId}`);
  }

  private calculateCenter(bounds: [[number, number], [number, number]]): [number, number] {
    const [[west, south], [east, north]] = bounds;
    return [(west + east) / 2, (south + north) / 2];
  }

  private calculateZoom(bounds: [[number, number], [number, number]]): number {
    const [[west, south], [east, north]] = bounds;
    const maxDiff = Math.max(Math.abs(east - west), Math.abs(north - south));

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