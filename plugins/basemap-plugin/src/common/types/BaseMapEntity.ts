/**
 * @file BaseMapEntity.ts
 * @description BaseMap entity types focused on persistent basemap configuration
 */

import type { Timestamp } from '@hierarchidb/common-types';
import type { BaseSearchCriteria } from '@hierarchidb/plugin-base';

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

import type { TreeNodeData } from '@hierarchidb/common-types';

/**
 * BaseMap entity persisted for each tree node
 */
export interface BaseMapEntity extends TreeNodeData {
  mapStyle: MapStyle;
  viewport?: MapViewport;
}

/**
 * BaseMap draft payload for edit operations
 * Prefer Partial<BaseMapEntity> / TreeNodeUpdaterPayload<BaseMapEntity>; keep minimal draft shape for compatibility.
 */
export type BaseMapDraftPayload = Partial<BaseMapEntity> & {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  version?: number;
};

export type BaseMapDraft = BaseMapDraftPayload & {
  treeNodeId: string;
  draft?: BaseMapEntity;
  originalVersion?: number;
};

/**
 * Search criteria for BaseMap entities
 */
export interface BaseMapSearchCriteria extends BaseSearchCriteria {
  mapStyle?: string;
}

export type BasemapPeerData = {
  schemaVersion: 1;
};
