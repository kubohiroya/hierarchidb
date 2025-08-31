/**
 * @file BaseMapEntityHandler.ts
 * @description BaseMap entity handler extending FolderEntityHandler
 */

import type { NodeId, EntityId } from '@hierarchidb/common-type';
import type { Table } from 'dexie';
import { 
  FolderEntityHandler, 
  type FolderEntityExtended,
  type FolderSearchCriteria,
  type FolderEntity 
} from '@hierarchidb/folder-plugin';
import type {
  BaseMapEntity,
  BaseMapWorkingCopy,
  CreateBaseMapData,
  BaseMapSearchCriteria,
  MapStyle,
  MapViewport,
  DisplayOptions,
} from '../types';
import { BaseMapDatabase } from '../database/BaseMapDatabase';

/**
 * Default values for BaseMap configuration
 */
const DEFAULT_MAP_STYLE: MapStyle = {
  style: 'streets',
};

const DEFAULT_VIEWPORT: MapViewport = {
  center: [139.6917, 35.6895], // Tokyo
  zoom: 10,
  bearing: 0,
  pitch: 0,
};

const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  show3dBuildings: false,
  showTraffic: false,
  showTransit: false,
  showTerrain: false,
  showLabels: true,
};

/**
 * Combined entity type for BaseMap
 */
export interface BaseMapEntityExtended extends BaseMapEntity, FolderEntityExtended {}

/**
 * Combined search criteria for BaseMap entities
 */
export interface BaseMapExtendedSearchCriteria extends FolderSearchCriteria, BaseMapSearchCriteria {}

/**
 * BaseMap Entity Handler
 * Extends FolderEntityHandler to provide BaseMap-specific operations
 */
export class BaseMapEntityHandler extends FolderEntityHandler<
  BaseMapEntityExtended,
  BaseMapWorkingCopy,
  CreateBaseMapData,
  BaseMapExtendedSearchCriteria
> {
  public baseMapDB: BaseMapDatabase;
  protected table: Table<BaseMapEntityExtended, EntityId>;
  protected workingCopyTable: Table<BaseMapWorkingCopy, EntityId>;

  constructor() {
    super();
    this.baseMapDB = new BaseMapDatabase();
    this.table = this.baseMapDB.baseMaps as Table<BaseMapEntityExtended, EntityId>;
    this.workingCopyTable = this.baseMapDB.workingCopies as Table<BaseMapWorkingCopy, EntityId>;
  }

  /**
   * Build BaseMap entity with specific fields
   */
  protected buildEntity(
    nodeId: NodeId,
    entityId: EntityId,
    data: Partial<BaseMapEntityExtended>
  ): BaseMapEntityExtended {
    // Get base folder entity
    const folderEntity = super.buildEntity(nodeId, entityId, {
      name: data.name,
      description: data.description,
      category: data.category,
      settings: data.settings,
    });

    // Add BaseMap-specific fields
    return {
      ...folderEntity,
      baseMapMetadataId: data.baseMapMetadataId,
      mapStyle: data.mapStyle || DEFAULT_MAP_STYLE,
      viewport: data.viewport || DEFAULT_VIEWPORT,
      displayOptions: data.displayOptions || DEFAULT_DISPLAY_OPTIONS,
    } as BaseMapEntityExtended;
  }

  /**
   * Clean up BaseMap-specific data
   */
  protected async cleanupEntityData(entity: BaseMapEntityExtended): Promise<void> {
    // Clean up folder-specific data first
    await super.cleanupEntityData(entity);

    // Clean up BaseMap-specific data if needed
    // (Currently no additional cleanup needed for BaseMap)
  }

  /**
   * Create a new BaseMap entity
   */
  async createEntity(
    nodeId: NodeId,
    data?: CreateBaseMapData
  ): Promise<BaseMapEntityExtended> {
    // Use parent class createEntity with BaseMap-specific data
    return await super.createEntity(nodeId, {
      ...data,
      mapStyle: data?.mapStyle || DEFAULT_MAP_STYLE,
      viewport: data?.viewport || DEFAULT_VIEWPORT,
      displayOptions: data?.displayOptions || DEFAULT_DISPLAY_OPTIONS,
    } as Partial<FolderEntity>);
  }

  /**
   * Create working copy for BaseMap
   */
  async createWorkingCopy(
    nodeId: NodeId
  ): Promise<BaseMapWorkingCopy> {
    const entity = await this.getEntityByNodeId(nodeId);
    const now = Date.now();
    const workingCopyId = crypto.randomUUID() as EntityId;

    if (entity) {
      const workingCopy: BaseMapWorkingCopy = {
        ...entity,
        id: workingCopyId,
        isDraft: true,
        originalId: entity.id,
        copiedAt: now,
        updatedAt: now,
      };
      await this.workingCopyTable.add(workingCopy);
      return workingCopy;
    }

    // Create new BaseMap working copy with defaults
    const workingCopy: BaseMapWorkingCopy = {
      id: workingCopyId,
      nodeId,
      name: 'New BaseMap',
      description: '',
      settings: {
        allowNestedFolders: true,
        maxDepth: 10,
        sortOrder: 'name',
      },
      baseMapMetadataId: undefined,
      mapStyle: DEFAULT_MAP_STYLE,
      viewport: DEFAULT_VIEWPORT,
      displayOptions: DEFAULT_DISPLAY_OPTIONS,
      isDraft: true,
      createdAt: now,
      updatedAt: now,
      copiedAt: now,
      version: 1,
    } as BaseMapWorkingCopy;
    
    await this.workingCopyTable.add(workingCopy);
    return workingCopy;
  }

  // ========== BaseMap-specific methods ==========

  /**
   * Update map style configuration
   */
  async updateMapStyle(nodeId: NodeId, mapStyle: MapStyle): Promise<BaseMapEntityExtended> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) {
      throw new Error(`BaseMap entity for node ${nodeId} not found`);
    }

    return await this.updateEntity(entity.id, { mapStyle });
  }

  /**
   * Update viewport configuration
   */
  async updateViewport(nodeId: NodeId, viewport: MapViewport): Promise<BaseMapEntityExtended> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) {
      throw new Error(`BaseMap entity for node ${nodeId} not found`);
    }

    return await this.updateEntity(entity.id, { viewport });
  }

  /**
   * Update display options
   */
  async updateDisplayOptions(
    nodeId: NodeId,
    displayOptions: DisplayOptions
  ): Promise<BaseMapEntityExtended> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) {
      throw new Error(`BaseMap entity for node ${nodeId} not found`);
    }

    return await this.updateEntity(entity.id, { displayOptions });
  }

  /**
   * Get BaseMap configuration for export
   */
  async getConfiguration(nodeId: NodeId): Promise<{
    mapStyle: MapStyle;
    viewport: MapViewport;
    displayOptions: DisplayOptions;
  } | null> {
    const entity = await this.getEntityByNodeId(nodeId);
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
  async validateConfiguration(config: Partial<BaseMapEntityExtended>): Promise<{
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
  async searchBaseMaps(criteria: BaseMapExtendedSearchCriteria): Promise<BaseMapEntityExtended[]> {
    // Use parent class search method with extended criteria
    return await this.searchEntities(criteria);
  }

  /**
   * Apply additional search criteria for BaseMap entities
   */
  protected applyAdditionalSearchCriteria(
    collection: any,
    criteria: BaseMapExtendedSearchCriteria
  ): any {
    // Apply parent criteria first
    collection = super.applyAdditionalSearchCriteria(collection, criteria);

    // Apply BaseMap-specific criteria
    if (criteria.mapStyle) {
      collection = collection.filter((entity: BaseMapEntityExtended) => 
        entity.mapStyle.style === criteria.mapStyle
      );
    }

    return collection;
  }

  /**
   * Get BaseMaps by map style
   */
  async getByMapStyle(style: string): Promise<BaseMapEntityExtended[]> {
    return await this.searchBaseMaps({ mapStyle: style });
  }

  /**
   * Get nearby BaseMaps based on location
   */
  async getNearbyBaseMaps(
    center: [number, number],
    radiusKm: number
  ): Promise<BaseMapEntityExtended[]> {
    const allBaseMaps = await this.getAll();
    
    return allBaseMaps.filter((baseMap) => {
      const distance = this.calculateDistance(center, baseMap.viewport.center);
      return distance <= radiusKm;
    });
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(
    point1: [number, number],
    point2: [number, number]
  ): number {
    const R = 6371; // Earth's radius in km
    const lat1 = (point1[1] * Math.PI) / 180;
    const lat2 = (point2[1] * Math.PI) / 180;
    const deltaLat = ((point2[1] - point1[1]) * Math.PI) / 180;
    const deltaLon = ((point2[0] - point1[0]) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Import BaseMap configuration
   */
  async importConfiguration(
    nodeId: NodeId,
    config: {
      mapStyle: MapStyle;
      viewport: MapViewport;
      displayOptions: DisplayOptions;
    }
  ): Promise<BaseMapEntityExtended> {
    const validation = await this.validateConfiguration(config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) {
      // Create new entity with imported config
      return await this.createEntity(nodeId, {
        name: 'Imported BaseMap',
        ...config,
      } as CreateBaseMapData);
    }

    // Update existing entity
    return await this.updateEntity(entity.id, config);
  }

  /**
   * Clone BaseMap to a new node
   */
  async cloneToNode(sourceNodeId: NodeId, targetNodeId: NodeId): Promise<BaseMapEntityExtended> {
    const sourceEntity = await this.getEntityByNodeId(sourceNodeId);
    if (!sourceEntity) {
      throw new Error(`Source BaseMap ${sourceNodeId} not found`);
    }

    const { id, nodeId, createdAt, updatedAt, version, ...cloneData } = sourceEntity;
    
    return await this.createEntity(targetNodeId, {
      ...cloneData,
      name: `${sourceEntity.name} (Copy)`,
    } as CreateBaseMapData);
  }

  /**
   * Get all map styles used in the system
   */
  async getUsedMapStyles(): Promise<string[]> {
    const allBaseMaps = await this.table.toArray();
    const styles = new Set(allBaseMaps.map(bm => bm.mapStyle.style));
    return Array.from(styles);
  }

  /**
   * Batch update viewport for multiple BaseMaps
   */
  async batchUpdateViewport(
    nodeIds: NodeId[],
    viewport: Partial<MapViewport>
  ): Promise<void> {
    for (const nodeId of nodeIds) {
      const entity = await this.getEntityByNodeId(nodeId);
      if (entity) {
        const updatedViewport = {
          ...entity.viewport,
          ...viewport,
        };
        await this.updateViewport(nodeId, updatedViewport);
      }
    }
  }
}