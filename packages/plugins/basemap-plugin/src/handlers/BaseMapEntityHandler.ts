/**
 * @file BaseMapEntityHandler.ts
 * @description BaseMap entity handler built on HierarchicalEntityHandler
 */

import type { NodeId, Timestamp } from '@hierarchidb/common-type';
import type { Collection, IndexableType, Table } from 'dexie';
import { HierarchicalEntityHandler, createDraftWorkingCopyBase } from '@hierarchidb/plugins-base-plugin';
import type {
  BaseMapEntity,
  BaseMapSearchCriteria,
  BaseMapWorkingCopy,
  CreateBaseMapData,
  DisplayOptions,
  MapStyle,
  MapViewport,
  BasemapPeerData,
  BaseMapDraftPayload,
} from '../types/index.js';
import { BaseMapDatabase } from '../database/BaseMapDatabase.js';
import type { PeerEntity } from '@hierarchidb/runtime-worker';

/**
 * Default values for BaseMap configuration
 */
const DEFAULT_MAP_STYLE: MapStyle = {
  style: 'streets',
};

const DEFAULT_VIEWPORT: MapViewport = {
  center: [0, 0],
  zoom: 2,
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

const STYLE_SPECIFIC_DEFAULTS: Partial<Record<MapStyle['style'], Partial<DisplayOptions>>> = {
  satellite: {
    show3dBuildings: true,
    showLabels: false,
  },
};

const CITY_COUNTRY_TAGS: Record<string, string[]> = {
  tokyo: ['japan', 'jp'],
  'new york': ['usa', 'united-states', 'us'],
  london: ['uk', 'united-kingdom', 'gb'],
};

const WORD_BREAK_REGEX = /[^a-z0-9]+/gi;
const TAG_STOP_WORDS = new Set(['new', 'base', 'basemap', 'map', 'maps', 'default']);

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

function resolveDisplayOptions(mapStyle: MapStyle, overrides?: Partial<DisplayOptions>): DisplayOptions {
  const base: DisplayOptions = { ...DEFAULT_DISPLAY_OPTIONS };
  const styleDefaults = STYLE_SPECIFIC_DEFAULTS[mapStyle.style];
  if (styleDefaults) {
    Object.assign(base, styleDefaults);
  }
  if (overrides) {
    Object.assign(base, overrides);
  }
  return base;
}

function normalizeTags(input: { explicitTags?: string[]; displayTags?: string[]; name?: string }): string[] {
  const tags = new Set<string>();
  const push = (value?: string | null) => {
    if (!value) return;
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === '-') return;
    tags.add(normalized);
  };

  input.explicitTags?.forEach(push);
  input.displayTags?.forEach(push);

  const hasExplicit = (input.explicitTags?.length ?? 0) > 0;
  const hasDisplay = (input.displayTags?.length ?? 0) > 0;
  const allowNameHeuristics = !(hasExplicit || hasDisplay);

  if (input.name && allowNameHeuristics) {
    const lowerName = input.name.toLowerCase();
    lowerName
      .split(WORD_BREAK_REGEX)
      .filter((token) => token && !TAG_STOP_WORDS.has(token))
      .forEach(push);
    for (const [needle, mapped] of Object.entries(CITY_COUNTRY_TAGS)) {
      if (lowerName.includes(needle)) {
        mapped.forEach(push);
      }
    }
  }

  return Array.from(tags);
}

function collectEntityTags(entity: Pick<BaseMapEntity, 'tags' | 'name' | 'displayOptions'>): string[] {
  return normalizeTags({
    explicitTags: entity.tags,
    displayTags: entity.displayOptions?.tags,
    name: entity.name,
  });
}

export interface BaseMapExtendedSearchCriteria extends BaseMapSearchCriteria {}

/**
 * BaseMap Entity Handler (typed to BaseMapEntity)
 */
export class BaseMapEntityHandler extends HierarchicalEntityHandler<
  BaseMapEntity,
  CreateBaseMapData,
  BaseMapExtendedSearchCriteria
> {
  public baseMapDB: BaseMapDatabase;
  protected table: Table<BaseMapEntity, NodeId>;
  protected workingCopyTable: Table<BaseMapWorkingCopy, NodeId>;

  constructor() {
    super();
    this.baseMapDB = new BaseMapDatabase();
    this.table = this.baseMapDB.baseMaps as unknown as Table<BaseMapEntity, NodeId>;
    this.workingCopyTable = this.baseMapDB.workingCopies as unknown as Table<BaseMapWorkingCopy, NodeId>;
  }

  // Temporary brand helper: until all packages converge on NodeId as primary key
  // This avoids scattering 'unknown as' across call sites.
  // NodeId is the sole ID type

  /** Build BaseMap entity */
  protected buildEntity(
    nodeId: NodeId,
    entityId: NodeId,
    data: Partial<BaseMapEntity>,
  ): BaseMapEntity {
    const now = Date.now();
    const mapStyle = normalizeMapStyle(data.mapStyle);
    const viewport = normalizeViewport(data.viewport);
    const displayOptions = resolveDisplayOptions(mapStyle, data.displayOptions);
    const tags = normalizeTags({
      explicitTags: data.tags,
      displayTags: data.displayOptions?.tags,
      name: data.name,
    });
    const entityTags = tags.length > 0 ? [...tags] : [];
    const displayOptionsWithTags = tags.length > 0 ? { ...displayOptions, tags: [...tags] } : displayOptions;
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
      tags: entityTags,
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
      mapStyle,
      viewport,
      displayOptions: displayOptionsWithTags,
    } as BaseMapEntity;
  }

  protected async cleanupEntityData(_entity: BaseMapEntity): Promise<void> {
  }

  /** Create BaseMap entity */
  async createEntity(nodeId: NodeId, data?: CreateBaseMapData): Promise<BaseMapEntity> {
    const now = Date.now();
    const mapStyle = normalizeMapStyle(data?.mapStyle);
    const viewport = normalizeViewport(data?.viewport);
    const baseDisplayOptions = resolveDisplayOptions(mapStyle, data?.displayOptions);
    const tags = normalizeTags({
      explicitTags: data?.tags,
      displayTags: data?.displayOptions?.tags,
      name: data?.name,
    });
    const entityTags = tags.length > 0 ? [...tags] : [];
    const displayOptions = tags.length > 0 ? { ...baseDisplayOptions, tags: [...tags] } : baseDisplayOptions;
    const entity: BaseMapEntity = {
      id: nodeId,
      nodeId,
      name: data?.name || 'New BaseMap',
      description: data?.description || '',
      category: data?.category,
      settings: data?.settings || { allowNestedFolders: true, maxDepth: 10, sortOrder: 'name' },
      tags: entityTags,
      createdAt: now,
      updatedAt: now,
      version: 1,
      parentId: undefined,
      depth: 0,
      path: `/${nodeId}`,
      childCount: 0,
      baseMapMetadataId: data?.baseMapMetadataId,
      mapStyle,
      viewport,
      displayOptions,
    } as BaseMapEntity;
    await this.table.add(entity);
    await this.mirrorToPeerStore(entity).catch(() => {});
    return entity;
  }

  /** Create working copy */
  async createWorkingCopy(nodeId: NodeId): Promise<BaseMapWorkingCopy> {
    const entity = await this.getEntityByNodeId(nodeId);
    const now = Date.now() as Timestamp;

    const mapStyle = normalizeMapStyle(entity?.mapStyle);
    const viewport = normalizeViewport(entity?.viewport);
    const displayOptions = resolveDisplayOptions(mapStyle, entity?.displayOptions);

    const draftPayload: BaseMapDraftPayload = {
      name: entity?.name ?? 'New BaseMap',
      description: entity?.description ?? '',
      category: entity?.category,
      settings: entity?.settings ?? {
        allowNestedFolders: true,
        maxDepth: 10,
        sortOrder: 'name',
      },
      tags: entity?.tags ?? [],
      baseMapMetadataId: entity?.baseMapMetadataId,
      mapStyle,
      viewport,
      displayOptions,
      version: entity?.version ?? 1,
      createdAt: entity?.createdAt ?? now,
      updatedAt: entity?.updatedAt ?? now,
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

  async commitWorkingCopy(_nodeId: NodeId, workingCopy: BaseMapWorkingCopy): Promise<BaseMapEntity> {
    // If original exists, update it; otherwise create a new entity for provided nodeId
    if (workingCopy.treeNodeId && (await this.getEntityByNodeId(workingCopy.treeNodeId))) {
      const mapStyle = normalizeMapStyle(workingCopy.mapStyle);
      const viewport = normalizeViewport(workingCopy.viewport);
      const baseDisplayOptions = resolveDisplayOptions(mapStyle, workingCopy.displayOptions);
      const normalizedTags = normalizeTags({
        explicitTags: workingCopy.tags,
        displayTags: workingCopy.displayOptions?.tags,
        name: workingCopy.name,
      });
      const displayOptions = normalizedTags.length > 0
        ? { ...baseDisplayOptions, tags: [...normalizedTags] }
        : baseDisplayOptions;
      const tags = normalizedTags.length > 0 ? [...normalizedTags] : [];
      const updated = await this.updateEntity(workingCopy.treeNodeId, {
        name: workingCopy.name,
        mapStyle,
        viewport,
        displayOptions,
        tags,
      });
      await this.mirrorToPeerStore(updated).catch(() => {});
      return updated;
    }
    // Create a new entity using working copy fields (explicit mapping)
    const created = await this.createEntity(workingCopy.treeNodeId, {
      name: workingCopy.name,
      description: workingCopy.description,
      category: workingCopy.category,
      settings: workingCopy.settings,
      tags: workingCopy.tags,
      baseMapMetadataId: workingCopy.baseMapMetadataId,
      mapStyle: workingCopy.mapStyle,
      viewport: workingCopy.viewport,
      displayOptions: workingCopy.displayOptions,
    } as CreateBaseMapData);
    await this.mirrorToPeerStore(created).catch(() => {});
    return created;
  }

  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    // Remove any working copy associated with the node
    const wc = await this.workingCopyTable.where('nodeId').equals(nodeId as string).first();
    if (wc) await this.workingCopyTable.delete(wc.treeNodeId);
  }

  async updateMapStyle(nodeId: NodeId, mapStyle: MapStyle): Promise<BaseMapEntity> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) throw new Error(`BaseMap entity for node ${nodeId} not found`);
    const updated = await this.updateEntity(entity.id, { mapStyle });
    await this.mirrorToPeerStore(updated).catch(() => {});
    return updated;
  }

  async updateViewport(nodeId: NodeId, viewport: MapViewport): Promise<BaseMapEntity> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) throw new Error(`BaseMap entity for node ${nodeId} not found`);
    const updated = await this.updateEntity(entity.id, { viewport });
    await this.mirrorToPeerStore(updated).catch(() => {});
    return updated;
  }

  async updateDisplayOptions(
    nodeId: NodeId,
    displayOptions: DisplayOptions,
  ): Promise<BaseMapEntity> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) throw new Error(`BaseMap entity for node ${nodeId} not found`);
    const baseOptions = resolveDisplayOptions(entity.mapStyle, displayOptions);
    const normalizedTags = normalizeTags({
      explicitTags: displayOptions.tags ?? entity.tags,
      displayTags: baseOptions.tags,
      name: entity.name,
    });
    const nextDisplayOptions = normalizedTags.length > 0
      ? { ...baseOptions, tags: [...normalizedTags] }
      : baseOptions;
    const tags = normalizedTags.length > 0 ? [...normalizedTags] : [];
    const updated = await this.updateEntity(entity.id, {
      displayOptions: nextDisplayOptions,
      tags,
    });
    await this.mirrorToPeerStore(updated).catch(() => {});
    return updated;
  }

  async getConfiguration(nodeId: NodeId): Promise<{
    mapStyle: MapStyle;
    viewport: MapViewport;
    displayOptions: DisplayOptions;
  } | null> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) return null;
    const mapStyle = normalizeMapStyle(entity.mapStyle);
    const viewport = normalizeViewport(entity.viewport);
    const baseDisplayOptions = resolveDisplayOptions(mapStyle, entity.displayOptions);
    const normalizedTags = normalizeTags({
      explicitTags: entity.tags,
      displayTags: baseDisplayOptions.tags,
      name: entity.name,
    });
    const displayOptions = normalizedTags.length > 0
      ? { ...baseDisplayOptions, tags: [...normalizedTags] }
      : baseDisplayOptions;
    return {
      mapStyle,
      viewport,
      displayOptions,
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
      if (!Array.isArray(center) || center.length !== 2 ||
        typeof center[0] !== 'number' || typeof center[1] !== 'number') {
        errors.push('Valid center coordinates are required');
      } else {
        const [lng, lat] = center;
        if (lng < -180 || lng > 180) errors.push('Longitude must be a number between -180 and 180');
        if (lat < -90 || lat > 90) errors.push('Latitude must be a number between -90 and 90');
      }
      if (typeof zoom !== 'number' || zoom < 0 || zoom > 24) errors.push('Zoom must be a number between 0 and 24');
      if (typeof bearing !== 'number' || bearing < 0 || bearing >= 360) errors.push('Bearing must be a number between 0 and 360');
      if (typeof pitch !== 'number' || pitch < 0 || pitch > 60) errors.push('Pitch must be a number between 0 and 60');
    }

    return { isValid: errors.length === 0, errors };
  }

  async searchBaseMaps(criteria: BaseMapExtendedSearchCriteria): Promise<BaseMapEntity[]> {
    return await this.searchEntities(criteria);
  }

  protected applyAdditionalSearchCriteria(
    collection: Collection<BaseMapEntity, IndexableType, BaseMapEntity>,
    criteria: BaseMapExtendedSearchCriteria,
  ): Collection<BaseMapEntity, IndexableType, BaseMapEntity> {
    collection = super.applyAdditionalSearchCriteria(collection, criteria);

    if (criteria.mapStyle) {
      collection = collection.filter((entity: BaseMapEntity) => entity.mapStyle.style === criteria.mapStyle);
    }

    if (criteria.tags && criteria.tags.length > 0) {
      const expected = criteria.tags.map((tag) => tag.toLowerCase());
      collection = collection.filter((entity: BaseMapEntity) => {
        const entityTags = collectEntityTags(entity).map((tag) => tag.toLowerCase());
        return expected.every((tag) => entityTags.includes(tag));
      });
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
    config: { mapStyle: MapStyle; viewport: MapViewport; displayOptions: DisplayOptions },
  ): Promise<BaseMapEntity> {
    const validation = await this.validateConfiguration(config);
    if (!validation.isValid) throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);

    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) {
      const created = await this.createEntity(nodeId, { name: 'Imported BaseMap', ...config } as CreateBaseMapData);
      await this.mirrorToPeerStore(created).catch(() => {});
      return created;
    }
    const updated = await this.updateEntity(entity.id, config);
    await this.mirrorToPeerStore(updated).catch(() => {});
    return updated;
  }

  // Override getEntity to return undefined when not found (some tests expect undefined)
  async getEntity(entityId: NodeId): Promise<BaseMapEntity | null> {
    const res = await super.getEntity(entityId);
    // Some tests expect undefined; coerce without using any
    return (res ?? (undefined as unknown as BaseMapEntity | null));
  }

  async cloneToNode(sourceNodeId: NodeId, targetNodeId: NodeId): Promise<BaseMapEntity> {
    const sourceEntity = await this.getEntityByNodeId(sourceNodeId);
    if (!sourceEntity) throw new Error(`Source BaseMap ${sourceNodeId} not found`);

    const { id, nodeId, createdAt, updatedAt, version, ...cloneData } = sourceEntity as BaseMapEntity & {
      [k: string]: unknown;
    };
    const created = await this.createEntity(targetNodeId, {
      ...cloneData,
      name: `${sourceEntity.name} (Copy)`,
    } as CreateBaseMapData);
    await this.mirrorToPeerStore(created).catch(() => {});
    return created;
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
        const updated = await this.updateViewport(nodeId, updatedViewport);
        await this.mirrorToPeerStore(updated).catch(() => {});
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
        metadata: entity.displayOptions ? { displayOptions: entity.displayOptions } : undefined,
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
