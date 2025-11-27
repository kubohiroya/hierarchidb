/**
 * @file BaseMapEntity.ts
 * @description BaseMap entity types focused on persistent basemap configuration
 */

import type { BaseEntity, NodeId, Timestamp } from '@hierarchidb/common-types';
import type {
  BaseSearchCriteria,
  PeerDataBase,
  DraftBase,
} from '@hierarchidb/plugin-service-api';

/**
 * Map style configuration
 */
export interface MapStyle {
  style: 'streets' | 'satellite' | 'terrain' | 'dark' | 'light' | 'custom';
  customStyleUrl?: string;
  customStyleConfig?: Record<string, unknown>;
}

/**
 * Map viewport configuration
 */
export interface MapViewport {
  center: [number, number]; // [longitude, latitude]
  zoom: number;
  bearing: number;
  pitch: number;
}

/**
 * BaseMap entity persisted for each tree node
 */
export interface BaseMapEntity extends BaseEntity<NodeId> {
  nodeId: NodeId;
  mapStyle: MapStyle;
  viewport: MapViewport;
  name?: string;
  description?: string;
  tags?: string[];
}

/**
 * BaseMap working copy for edit operations
 * Prefer Partial<BaseMapEntity> / TreeNodeUpdater<BaseMapEntity>; keep minimal draft shape for compatibility.
 */
export type BaseMapDraftPayload = Partial<Pick<BaseMapEntity, 'mapStyle' | 'viewport' | 'name' | 'description' | 'tags'>> & {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  version?: number;
};

export type BaseMapDraft = DraftBase<BaseMapEntity> & BaseMapDraftPayload;

/**
 * Data for creating a new BaseMap
 */
export interface CreateBaseMapData extends Partial<BaseMapEntity> {
  mapStyle?: MapStyle;
  viewport?: MapViewport;
}

/**
 * Search criteria for BaseMap entities
 */
export interface BaseMapSearchCriteria extends BaseSearchCriteria {
  mapStyle?: string;
}

export type BasemapPeerData = PeerDataBase & {
  schemaVersion: 1;
};
