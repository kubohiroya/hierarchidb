/**
 * @file BaseMapEntityHandler.ts
 * @description BaseMap entity handler built on HierarchicalEntityHandler
 */

import type { NodeId, EntityId } from '@hierarchidb/common-type';
import type { Table, Collection } from 'dexie';
import { HierarchicalEntityHandler } from '@hierarchidb/base-plugin';
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

export interface BaseMapExtendedSearchCriteria extends BaseMapSearchCriteria {}

/**
 * BaseMap Entity Handler (typed to BaseMapEntity)
 */
export class BaseMapEntityHandler extends HierarchicalEntityHandler<BaseMapEntity> {
  public baseMapDB: BaseMapDatabase;
  protected table: Table<BaseMapEntity, EntityId>;
  protected workingCopyTable: Table<BaseMapWorkingCopy, EntityId>;

  constructor() {
    super();
    this.baseMapDB = new BaseMapDatabase();
    this.table = this.baseMapDB.baseMaps as unknown as Table<BaseMapEntity, EntityId>;
    this.workingCopyTable = this.baseMapDB.workingCopies as unknown as Table<BaseMapWorkingCopy, EntityId>;
  }

  /** Build BaseMap entity */
  protected buildEntity(
    nodeId: NodeId,
    entityId: EntityId,
    data: Partial<BaseMapEntity>
  ): BaseMapEntity {
    const now = Date.now();
    return {
      id: entityId,
      nodeId,
      name: data.name || 'New BaseMap',
      description: data.description || '',
      category: data.category,
      settings: data.settings || {
        allowNestedFolders: true,
        maxDepth: 10,
        sortOrder: 'name',
      },
      tags: data.tags || [],
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
      version: data.version || 1,
      // hierarchical defaults
      parentId: undefined,
      depth: 0,
      path: `/${nodeId}`,
      childCount: 0,
      // basemap-specific
      baseMapMetadataId: data.baseMapMetadataId,
      mapStyle: data.mapStyle || DEFAULT_MAP_STYLE,
      viewport: data.viewport || DEFAULT_VIEWPORT,
      displayOptions: data.displayOptions || DEFAULT_DISPLAY_OPTIONS,
    } as BaseMapEntity;
  }

  protected async cleanupEntityData(_entity: BaseMapEntity): Promise<void> {}

  /** Create BaseMap entity */
  async createEntity(nodeId: NodeId, data?: CreateBaseMapData): Promise<BaseMapEntity> {
    return await super.createEntity(nodeId, {
      ...data,
      mapStyle: data?.mapStyle || DEFAULT_MAP_STYLE,
      viewport: data?.viewport || DEFAULT_VIEWPORT,
      displayOptions: data?.displayOptions || DEFAULT_DISPLAY_OPTIONS,
    } as Partial<BaseMapEntity>);
  }

  /** Create working copy */
  async createWorkingCopy(nodeId: NodeId): Promise<BaseMapWorkingCopy> {
    const entity = await this.getEntityByNodeId(nodeId);
    const now = Date.now();
    const workingCopyId = crypto.randomUUID() as EntityId;

    if (entity) {
      const workingCopy: BaseMapWorkingCopy = {
        ...entity,
        id: workingCopyId,
        workingCopyId: workingCopyId,
        isDraft: true,
        originalId: entity.id,
        copiedAt: now,
        updatedAt: now,
      } as BaseMapWorkingCopy;
      await this.workingCopyTable.add(workingCopy);
      return workingCopy;
    }

    const workingCopy: BaseMapWorkingCopy = {
      id: workingCopyId,
      workingCopyId: workingCopyId,
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
      parentId: undefined,
      depth: 0,
      path: `/${nodeId}`,
      childCount: 0,
      tags: [],
    } as BaseMapWorkingCopy;

    await this.workingCopyTable.add(workingCopy);
    return workingCopy;
  }

  async updateMapStyle(nodeId: NodeId, mapStyle: MapStyle): Promise<BaseMapEntity> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) throw new Error(`BaseMap entity for node ${nodeId} not found`);
    return await this.updateEntity(entity.id, { mapStyle });
  }

  async updateViewport(nodeId: NodeId, viewport: MapViewport): Promise<BaseMapEntity> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) throw new Error(`BaseMap entity for node ${nodeId} not found`);
    return await this.updateEntity(entity.id, { viewport });
  }

  async updateDisplayOptions(
    nodeId: NodeId,
    displayOptions: DisplayOptions
  ): Promise<BaseMapEntity> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) throw new Error(`BaseMap entity for node ${nodeId} not found`);
    return await this.updateEntity(entity.id, { displayOptions });
  }

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

  async validateConfiguration(config: Partial<BaseMapEntity>): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

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

    if (config.viewport) {
      const { center, zoom, bearing, pitch } = config.viewport;
      if (!Array.isArray(center) || center.length !== 2) {
        errors.push('Viewport center must be [lng, lat]');
      } else {
        const [lng, lat] = center;
        if (typeof lng !== 'number' || lng < -180 || lng > 180) errors.push('Longitude out of range');
        if (typeof lat !== 'number' || lat < -90 || lat > 90) errors.push('Latitude out of range');
      }
      if (typeof zoom !== 'number' || zoom < 0 || zoom > 24) errors.push('Zoom out of range');
      if (typeof bearing !== 'number' || bearing < 0 || bearing >= 360) errors.push('Bearing out of range');
      if (typeof pitch !== 'number' || pitch < 0 || pitch > 60) errors.push('Pitch out of range');
    }

    return { isValid: errors.length === 0, errors };
  }

  async searchBaseMaps(criteria: BaseMapExtendedSearchCriteria): Promise<BaseMapEntity[]> {
    return await this.searchEntities(criteria as any);
  }

  protected applyAdditionalSearchCriteria(
    collection: Collection<BaseMapEntity>,
    criteria: BaseMapExtendedSearchCriteria
  ): Collection<BaseMapEntity, any> {
    collection = super.applyAdditionalSearchCriteria(collection, criteria as any);

    if (criteria.mapStyle) {
      collection = collection.filter((entity: BaseMapEntity) => entity.mapStyle.style === criteria.mapStyle);
    }

    return collection;
  }

  async getByMapStyle(style: string): Promise<BaseMapEntity[]> {
    return await this.searchBaseMaps({ mapStyle: style });
  }

  async getNearbyBaseMaps(center: [number, number], radiusKm: number): Promise<BaseMapEntity[]> {
    const allBaseMaps = await this.table.toArray();
    return allBaseMaps.filter((baseMap) => {
      const distance = this.calculateDistance(center, baseMap.viewport.center);
      return distance <= radiusKm;
    });
  }

  private calculateDistance(point1: [number, number], point2: [number, number]): number {
    const R = 6371; // km
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

  async importConfiguration(
    nodeId: NodeId,
    config: { mapStyle: MapStyle; viewport: MapViewport; displayOptions: DisplayOptions }
  ): Promise<BaseMapEntity> {
    const validation = await this.validateConfiguration(config);
    if (!validation.isValid) throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);

    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) {
      return await this.createEntity(nodeId, { name: 'Imported BaseMap', ...config } as CreateBaseMapData);
    }
    return await this.updateEntity(entity.id, config);
  }

  async cloneToNode(sourceNodeId: NodeId, targetNodeId: NodeId): Promise<BaseMapEntity> {
    const sourceEntity = await this.getEntityByNodeId(sourceNodeId);
    if (!sourceEntity) throw new Error(`Source BaseMap ${sourceNodeId} not found`);

    const { id, nodeId, createdAt, updatedAt, version, ...cloneData } = sourceEntity as any;
    return await this.createEntity(targetNodeId, {
      ...cloneData,
      name: `${sourceEntity.name} (Copy)`,
    } as CreateBaseMapData);
  }

  async getUsedMapStyles(): Promise<string[]> {
    const allBaseMaps = await this.table.toArray();
    const styles = new Set(allBaseMaps.map((bm) => bm.mapStyle.style));
    return Array.from(styles);
  }

  async batchUpdateViewport(nodeIds: NodeId[], viewport: Partial<MapViewport>): Promise<void> {
    for (const nodeId of nodeIds) {
      const entity = await this.getEntityByNodeId(nodeId);
      if (entity) {
        const updatedViewport = { ...entity.viewport, ...viewport } as MapViewport;
        await this.updateViewport(nodeId, updatedViewport);
      }
    }
  }
}

