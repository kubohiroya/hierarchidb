/**
 * @file BaseMapEntityHandler.ts
 * @description Minimal BaseMap entity handler responsible for persisting map configuration
 */

import type { NodeId } from '@hierarchidb/common-types';
import { createDraftWorkingCopyBase } from '@hierarchidb/plugin-runtime-services';
import { BaseEntityHandler } from '@hierarchidb/plugin-service-sdk';
import type { PeerEntity } from '@hierarchidb/runtime-worker';
import type { Collection, IndexableType, Table } from 'dexie';
import type {
  BaseMapDraftPayload,
  BaseMapEntity,
  BaseMapSearchCriteria,
  BaseMapWorkingCopy,
  BasemapPeerData,
  CreateBaseMapData,
  MapStyle,
  MapViewport,
} from '../../common/types/index.js';
import { BaseMapDatabase } from '../../services/database/BaseMapDatabase.js';

const DEFAULT_MAP_STYLE: MapStyle = {
  style: 'streets',
};

const DEFAULT_VIEWPORT: MapViewport = {
  center: [0, 0],
  zoom: 2,
  bearing: 0,
  pitch: 0,
};

function normalizeMapStyle(mapStyle?: Partial<MapStyle>): MapStyle {
  return {
    ...DEFAULT_MAP_STYLE,
    ...(mapStyle ?? {}),
  };
}

function normalizeViewport(viewport?: Partial<MapViewport>): MapViewport {
  return {
    ...DEFAULT_VIEWPORT,
    ...(viewport ?? {}),
  };
}

export class BaseMapEntityHandler extends BaseEntityHandler<
  BaseMapEntity,
  CreateBaseMapData,
  BaseMapSearchCriteria
> {
  public baseMapDB: BaseMapDatabase;
  protected table: Table<BaseMapEntity, NodeId>;
  protected workingCopyTable: Table<BaseMapWorkingCopy, NodeId>;

  constructor() {
    super();
    this.baseMapDB = new BaseMapDatabase();
    this.table = this.baseMapDB.baseMaps as Table<BaseMapEntity, NodeId>;
    this.workingCopyTable = this.baseMapDB.workingCopies as Table<BaseMapWorkingCopy, NodeId>;
  }

  protected buildEntity(
    nodeId: NodeId,
    _entityId: NodeId,
    data: Partial<BaseMapEntity>
  ): BaseMapEntity {
    const now = Date.now();
    const mapStyle = normalizeMapStyle(data.mapStyle);
    const viewport = normalizeViewport(data.viewport);
    return {
      id: (data.id ?? nodeId) as NodeId,
      nodeId,
      mapStyle,
      viewport,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
      version: data.version ?? 1,
    };
  }

  async createEntity(nodeId: NodeId, data?: CreateBaseMapData): Promise<BaseMapEntity> {
    const entity = await super.createEntity(nodeId, (data ?? {}) as CreateBaseMapData);
    await this.mirrorToPeerStore(entity).catch(() => {});
    return entity;
  }

  async updateEntity(
    entityId: NodeId,
    updates: Partial<BaseMapEntity>
  ): Promise<BaseMapEntity> {
    const updated = await super.updateEntity(entityId, updates);
    await this.mirrorToPeerStore(updated).catch(() => {});
    return updated;
  }

  async createWorkingCopy(nodeId: NodeId): Promise<BaseMapWorkingCopy> {
    const entity = await this.getEntityByNodeId(nodeId);
    const now = Date.now();
    const mapStyle = normalizeMapStyle(entity?.mapStyle);
    const viewport = normalizeViewport(entity?.viewport);

    const draftPayload: BaseMapDraftPayload = {
      mapStyle,
      viewport,
      createdAt: entity?.createdAt ?? (now as number),
      updatedAt: entity?.updatedAt ?? (now as number),
      version: entity?.version ?? 1,
    };

    const base = createDraftWorkingCopyBase<BaseMapEntity>({
      draft: draftPayload,
      meta: {
        treeNodeId: nodeId,
        createdAt: draftPayload.createdAt,
        updatedAt: now,
        originalVersion: entity?.version,
      },
    });

    const workingCopy: BaseMapWorkingCopy = {
      ...draftPayload,
      ...base,
    };

    await this.workingCopyTable.put(workingCopy, workingCopy.treeNodeId);
    return workingCopy;
  }

  async commitWorkingCopy(
    nodeId: NodeId,
    workingCopy: BaseMapWorkingCopy
  ): Promise<BaseMapEntity> {
    const normalizedStyle = normalizeMapStyle(workingCopy.mapStyle);
    const normalizedViewport = normalizeViewport(workingCopy.viewport);
    const existing = await this.getEntityByNodeId(nodeId);
    if (existing) {
      const updated = await this.updateEntity(existing.id, {
        mapStyle: normalizedStyle,
        viewport: normalizedViewport,
      });
      return updated;
    }
    const created = await this.createEntity(nodeId, {
      mapStyle: normalizedStyle,
      viewport: normalizedViewport,
    });
    return created;
  }

  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    const wc = await this.workingCopyTable.where('nodeId').equals(nodeId as string).first();
    if (wc) {
      await this.workingCopyTable.delete(wc.treeNodeId);
    }
  }

  async updateMapStyle(nodeId: NodeId, mapStyle: MapStyle): Promise<BaseMapEntity> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) throw new Error(`BaseMap entity for node ${nodeId} not found`);
    return await this.updateEntity(entity.id, { mapStyle: normalizeMapStyle(mapStyle) });
  }

  async updateViewport(nodeId: NodeId, viewport: MapViewport): Promise<BaseMapEntity> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) throw new Error(`BaseMap entity for node ${nodeId} not found`);
    return await this.updateEntity(entity.id, { viewport: normalizeViewport(viewport) });
  }

  async getConfiguration(
    nodeId: NodeId
  ): Promise<{ mapStyle: MapStyle; viewport: MapViewport } | null> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) return null;
    return {
      mapStyle: normalizeMapStyle(entity.mapStyle),
      viewport: normalizeViewport(entity.viewport),
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
      if (
        !Array.isArray(center) ||
        center.length !== 2 ||
        typeof center[0] !== 'number' ||
        typeof center[1] !== 'number'
      ) {
        errors.push('Valid center coordinates are required');
      } else {
        const [lng, lat] = center;
        if (lng < -180 || lng > 180) errors.push('Longitude must be a number between -180 and 180');
        if (lat < -90 || lat > 90) errors.push('Latitude must be a number between -90 and 90');
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

    return { isValid: errors.length === 0, errors };
  }

  async searchBaseMaps(criteria: BaseMapSearchCriteria): Promise<BaseMapEntity[]> {
    return await this.searchEntities(criteria);
  }

  protected applyAdditionalSearchCriteria(
    collection: Collection<BaseMapEntity, IndexableType, BaseMapEntity>,
    criteria: BaseMapSearchCriteria
  ): Collection<BaseMapEntity, IndexableType, BaseMapEntity> {
    if (criteria.mapStyle) {
      return collection.filter(
        (entity: BaseMapEntity) => entity.mapStyle.style === criteria.mapStyle
      );
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
    config: { mapStyle: MapStyle; viewport: MapViewport }
  ): Promise<BaseMapEntity> {
    const normalizedStyle = normalizeMapStyle(config.mapStyle);
    const normalizedViewport = normalizeViewport(config.viewport);
    const validation = await this.validateConfiguration({
      mapStyle: normalizedStyle,
      viewport: normalizedViewport,
    });
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) {
      return await this.createEntity(nodeId, {
        mapStyle: normalizedStyle,
        viewport: normalizedViewport,
      });
    }
    return await this.updateEntity(entity.id, {
      mapStyle: normalizedStyle,
      viewport: normalizedViewport,
    });
  }

  async cloneToNode(sourceNodeId: NodeId, targetNodeId: NodeId): Promise<BaseMapEntity> {
    const sourceEntity = await this.getEntityByNodeId(sourceNodeId);
    if (!sourceEntity) throw new Error(`Source BaseMap ${sourceNodeId} not found`);
    return await this.createEntity(targetNodeId, {
      mapStyle: sourceEntity.mapStyle,
      viewport: sourceEntity.viewport,
    });
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

  private async mirrorToPeerStore(entity: BaseMapEntity): Promise<void> {
    try {
      const mod = await import(/* @vite-ignore */ '@hierarchidb/runtime-worker');
      const store = mod.storeRegistry.getPeer<BasemapPeerData>('basemap');
      if (!store) return;
      const payload: BasemapPeerData = {
        schemaVersion: 1,
        presentation: {
          style: entity.mapStyle,
          viewport: entity.viewport,
        },
      };
      const peerEntity: PeerEntity<BasemapPeerData> = {
        nodeId: entity.nodeId,
        data: payload,
        updatedAt: Date.now(),
      };
      await store.put(peerEntity);
    } catch {
      // ignore in non-worker contexts or tests
    }
  }
}
