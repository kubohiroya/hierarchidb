/**
 * @file BaseMapEntityHandler.ts
 * @description BaseMap entity handler implementing CRUD operations and serialization
 *
 * BaseMap extends Folder plugin, so this handler extends FolderEntityHandler
 * to provide BaseMap-specific functionality.
 */

import type { NodeId, EntityId } from '@hierarchidb/common-core';
import { FolderEntityHandler } from '@hierarchidb/node-type-folder-plugin';
import type { BaseMapEntity, BaseMapWorkingCopy } from '../types/BaseMapEntity';
import { BaseMapDatabase } from '../database/BaseMapDatabase';

/**
 * BaseMap Entity Handler
 * Extends FolderEntityHandler to provide BaseMap-specific operations
 */
export class BaseMapEntityHandler extends FolderEntityHandler {
  public baseMapDB: BaseMapDatabase;

  constructor() {
    super();
    this.baseMapDB = new BaseMapDatabase();
  }

  /**
   * Create a new BaseMap entity
   * Extends the folder-plugin creation with BaseMap-specific fields
   */
  async createEntity(nodeId: NodeId, data?: Partial<BaseMapEntity>): Promise<BaseMapEntity> {
    // Create base folder-plugin entity first
    const folderEntity = await super.createEntity(nodeId, {
      name: data?.name || 'New BaseMap',
      description: data?.description || 'A new basemap configuration',
    });

    // Create BaseMap-specific entity
    const baseMapEntity: BaseMapEntity = {
      ...folderEntity,
      // BaseMap-specific fields
      baseMapMetadataId: data?.baseMapMetadataId,
      mapStyle: data?.mapStyle || {
        style: 'streets',
        customStyleUrl: undefined,
        customStyleConfig: undefined,
      },
      viewport: data?.viewport || {
        center: [0, 0], // Default to [longitude=0, latitude=0]
        zoom: 2, // World view
        bearing: 0,
        pitch: 0,
      },
      displayOptions: data?.displayOptions || {
        show3dBuildings: false,
        showTraffic: false,
        showTransit: false,
        showTerrain: false,
        showLabels: true,
        attribution: undefined,
        tags: [],
      },
    };

    await this.baseMapDB.baseMaps.add(baseMapEntity);
    return baseMapEntity;
  }

  /**
   * Get BaseMap entity by node ID
   */
  async getEntity(nodeId: NodeId): Promise<BaseMapEntity | undefined> {
    return await this.baseMapDB.baseMaps.where('nodeId').equals(nodeId).first();
  }

  /**
   * Update BaseMap entity
   */
  async updateEntity(nodeId: NodeId, data: Partial<BaseMapEntity>): Promise<void> {
    const existing = await this.getEntity(nodeId);
    if (!existing) {
      throw new Error(`BaseMap entity for node ${nodeId} not found`);
    }

    // Update folder-plugin-level fields if provided
    if (data.name !== undefined || data.description !== undefined || data.settings !== undefined) {
      await super.updateEntity(nodeId, {
        name: data.name,
        description: data.description,
        settings: data.settings,
      });
    }

    // Update BaseMap-specific fields
    const updated: BaseMapEntity = {
      ...existing,
      ...data,
      id: existing.id,
      nodeId: existing.nodeId,
      updatedAt: Date.now(),
      version: existing.version + 1,
    };

    await this.baseMapDB.baseMaps.put(updated);
  }

  /**
   * Delete BaseMap entity
   */
  async deleteEntity(nodeId: NodeId): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      return; // Already deleted
    }

    // Delete BaseMap-specific data
    await this.baseMapDB.transaction('rw', this.baseMapDB.baseMaps, async () => {
      await this.baseMapDB.baseMaps.delete(entity.id);
    });

    // Delete base folder-plugin entity
    await super.deleteEntity(nodeId);
  }

  /**
   * Create BaseMap working copy
   * Separate method to avoid base class type conflicts
   */
  async createBaseMapWorkingCopy(nodeId: NodeId): Promise<BaseMapWorkingCopy> {
    const entity = await this.getEntity(nodeId);
    const workingCopyId = crypto.randomUUID() as EntityId;
    const now = Date.now();

    const workingCopy: BaseMapWorkingCopy = entity
      ? {
          ...entity,
          id: workingCopyId,
          isDraft: true,
          originalId: entity.id,
          copiedAt: now,
          updatedAt: now,
        }
      : {
          id: workingCopyId,
          nodeId,
          name: 'New BaseMap',
          description: '',
          settings: {
            allowNestedFolders: true,
            maxDepth: 10,
            sortOrder: 'name',
          },
          metadata: {},
          // BaseMap-specific defaults
          mapStyle: {
            style: 'streets',
          },
          viewport: {
            center: [0, 0],
            zoom: 2,
            bearing: 0,
            pitch: 0,
          },
          displayOptions: {
            show3dBuildings: false,
            showTraffic: false,
            showTransit: false,
            showTerrain: false,
            showLabels: true,
            tags: [],
          },
          isDraft: true,
          createdAt: now,
          updatedAt: now,
          copiedAt: now,
          version: 1,
        };

    await this.baseMapDB.workingCopies.add(workingCopy);
    return workingCopy;
  }

  /**
   * Commit BaseMap working copy
   * Separate method to avoid base class type conflicts
   */
  async commitBaseMapWorkingCopy(nodeId: NodeId, workingCopy: BaseMapWorkingCopy): Promise<void> {
    const existingEntity = await this.getEntity(nodeId);

    if (existingEntity) {
      await this.updateEntity(nodeId, {
        name: workingCopy.name,
        description: workingCopy.description,
        settings: workingCopy.settings,
        metadata: workingCopy.metadata,
        mapStyle: workingCopy.mapStyle,
        viewport: workingCopy.viewport,
        displayOptions: workingCopy.displayOptions,
      });
    } else {
      await this.createEntity(nodeId, workingCopy);
    }

    await this.baseMapDB.workingCopies.delete(workingCopy.id);
  }

  /**
   * Discard BaseMap working copy
   */
  async discardBaseMapWorkingCopy(nodeId: NodeId): Promise<void> {
    const workingCopy = await this.baseMapDB.workingCopies.where('nodeId').equals(nodeId).first();
    if (workingCopy) {
      await this.baseMapDB.workingCopies.delete(workingCopy.id);
    }
  }

  // ==========================================
  // BaseMap-specific methods
  // ==========================================

  /**
   * Update map style configuration
   */
  async updateMapStyle(nodeId: NodeId, mapStyle: BaseMapEntity['mapStyle']): Promise<void> {
    await this.updateEntity(nodeId, { mapStyle });
  }

  /**
   * Update viewport configuration
   */
  async updateViewport(nodeId: NodeId, viewport: BaseMapEntity['viewport']): Promise<void> {
    await this.updateEntity(nodeId, { viewport });
  }

  /**
   * Update display options
   */
  async updateDisplayOptions(
    nodeId: NodeId,
    displayOptions: BaseMapEntity['displayOptions']
  ): Promise<void> {
    await this.updateEntity(nodeId, { displayOptions });
  }

  /**
   * Get BaseMap configuration for export
   */
  async getConfiguration(nodeId: NodeId): Promise<{
    mapStyle: BaseMapEntity['mapStyle'];
    viewport: BaseMapEntity['viewport'];
    displayOptions: BaseMapEntity['displayOptions'];
  } | null> {
    const entity = await this.getEntity(nodeId);
    if (!entity) return null;

    return {
      mapStyle: entity.mapStyle,
      viewport: entity.viewport,
      displayOptions: entity.displayOptions,
    };
  }

  /**
   * Validate BaseMap configuration
   */
  async validateConfiguration(config: Partial<BaseMapEntity>): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Validate map style
    if (config.mapStyle) {
      const { style, customStyleUrl } = config.mapStyle;
      if (!['streets', 'satellite', 'terrain', 'dark', 'light', 'custom'].includes(style)) {
        errors.push('Invalid map style');
      }
      if (style === 'custom' && !customStyleUrl) {
        errors.push('Custom style URL is required when using custom style');
      }
      if (style === 'custom' && customStyleUrl) {
        try {
          new URL(customStyleUrl);
        } catch {
          errors.push('Invalid custom style URL format');
        }
      }
    }

    // Validate viewport
    if (config.viewport) {
      const { center, zoom, bearing, pitch } = config.viewport;
      if (!Array.isArray(center) || center.length !== 2) {
        errors.push('Viewport center must be an array of [longitude, latitude]');
      } else {
        const [lng, lat] = center;
        if (typeof lng !== 'number' || lng < -180 || lng > 180) {
          errors.push('Longitude must be a number between -180 and 180');
        }
        if (typeof lat !== 'number' || lat < -90 || lat > 90) {
          errors.push('Latitude must be a number between -90 and 90');
        }
      }
      if (typeof zoom !== 'number' || zoom < 0 || zoom > 24) {
        errors.push('Zoom must be a number between 0 and 24');
      }
      if (typeof bearing !== 'number' || bearing < 0 || bearing >= 360) {
        errors.push('Bearing must be a number between 0 and 360');
      }
      if (typeof pitch !== 'number' || pitch < 0 || pitch > 60) {
        errors.push('Pitch must be a number between 0 and 60');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Search BaseMaps by criteria
   */
  async searchBaseMaps(criteria: {
    name?: string;
    mapStyle?: string;
    tags?: string[];
  }): Promise<BaseMapEntity[]> {
    const baseMaps = await this.baseMapDB.baseMaps.toArray();

    return baseMaps.filter((baseMap) => {
      if (criteria.name && !baseMap.name.toLowerCase().includes(criteria.name.toLowerCase())) {
        return false;
      }
      if (criteria.mapStyle && baseMap.mapStyle.style !== criteria.mapStyle) {
        return false;
      }
      if (criteria.tags && criteria.tags.length > 0) {
        const baseMapTags = baseMap.displayOptions.tags || [];
        if (!criteria.tags.some((tag) => baseMapTags.includes(tag))) {
          return false;
        }
      }
      return true;
    });
  }
}
