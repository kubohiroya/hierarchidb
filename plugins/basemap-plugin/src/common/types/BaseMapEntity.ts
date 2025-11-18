/**
 * @file BaseMapEntity.ts
 * @description BaseMap entity types focused on persistent basemap configuration
 */

import type { BaseEntity, NodeId, Timestamp } from '@hierarchidb/common-types';
import type { PeerDataBase, WorkingCopyDraft } from '@hierarchidb/plugin-service-api';
import type { BaseSearchCriteria } from '@hierarchidb/plugin-service-api/types/baseSearchCriteria.js';

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
 */
export type BaseMapDraftPayload = {
  mapStyle: MapStyle;
  viewport: MapViewport;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
};

export interface BaseMapWorkingCopy extends WorkingCopyDraft<BaseMapEntity>, BaseMapDraftPayload {
  tags?: string[];
  draft: WorkingCopyDraft<BaseMapEntity>['draft'] & {
    mapStyle?: MapStyle;
    viewport?: MapViewport;
    name?: string;
    description?: string;
  };
}

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

/**
 * Peer data stored in Dexie peerEntities for basemap nodes.
 * schemaVersion must always be present so that future migrations
 * can discriminate payload revisions.
 */
export interface BasemapPeerData extends PeerDataBase {
  schemaVersion: 1;
  presentation?: {
    viewport?: MapViewport;
    style?: MapStyle;
  };
}
