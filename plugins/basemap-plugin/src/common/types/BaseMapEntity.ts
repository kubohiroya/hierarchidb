/**
 * @file BaseMapEntity.ts
 * @description BaseMap entity types focused on persistent basemap configuration
 */

import type { Timestamp } from '@hierarchidb/common-types';
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
export interface BaseMapEntity {
  mapStyle: MapStyle;
  viewport?: MapViewport;
}

/**
 * BaseMap working copy for edit operations
 * Prefer Partial<BaseMapEntity> / TreeNodeUpdaterPayload<BaseMapEntity>; keep minimal draft shape for compatibility.
 */
export type BaseMapDraftPayload = Partial<BaseMapEntity> & {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  version?: number;
};

export type BaseMapDraft = DraftBase<BaseMapEntity> & BaseMapDraftPayload;

/**
 * Search criteria for BaseMap entities
 */
export interface BaseMapSearchCriteria extends BaseSearchCriteria {
  mapStyle?: string;
}

export type BasemapPeerData = PeerDataBase & {
  schemaVersion: 1;
};
