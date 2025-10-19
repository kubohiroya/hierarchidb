/**
 * @file BaseMapEntity.ts
 * @description BaseMap entity types extending Folder entity
 */

import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import type {
  HierarchicalEntity,
  HierarchicalSearchCriteria,
  PeerDataBase,
  WorkingCopyDraft,
} from '@hierarchidb/plugin-types';

/**
 * Map style configuration
 */
export interface MapStyle {
  style: 'streets' | 'satellite' | 'terrain' | 'dark' | 'light' | 'custom';
  customStyleUrl?: string;
  customStyleConfig?: Record<string, any>;
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
 * Map display options
 */
export interface DisplayOptions {
  show3dBuildings: boolean;
  showTraffic: boolean;
  showTransit: boolean;
  showTerrain: boolean;
  showLabels: boolean;
  attribution?: string;
  // Optional tags used for search/grouping in tests and UI
  tags?: string[];
}

/**
 * BaseMap entity extending Folder entity
 */
export interface FolderSettings {
  allowNestedFolders: boolean;
  maxDepth: number;
  sortOrder: 'name' | 'date' | 'size';
}

export interface BaseMapEntity extends HierarchicalEntity {
  // Common folder-like fields used in UI/handlers
  name?: string;
  description?: string;
  category?: string;
  settings?: FolderSettings;
  tags?: string[];
  // BaseMap specific fields
  baseMapMetadataId?: string;
  mapStyle: MapStyle;
  viewport: MapViewport;
  displayOptions: DisplayOptions;
  // HierarchicalEntity optional fields are inherited; listed for clarity
  parentId?: NodeId;
  depth?: number;
  path?: string;
  childCount?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
  hasChildren?: boolean; // UI optimization hint; if missing, treated as false
}

/**
 * BaseMap working copy for edit operations
 */
export type BaseMapDraftPayload = Partial<BaseMapEntity> & {
  mapStyle: MapStyle;
  viewport: MapViewport;
  displayOptions: DisplayOptions;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
};

export type BaseMapWorkingCopyEntity = WorkingCopyDraft<BaseMapEntity> & BaseMapDraftPayload;

export type BaseMapWorkingCopy = BaseMapWorkingCopyEntity;

/**
 * Data for creating a new BaseMap
 */
export interface CreateBaseMapData extends Partial<BaseMapEntity> {
  name?: string;
  description?: string;
  mapStyle?: MapStyle;
  viewport?: MapViewport;
  displayOptions?: DisplayOptions;
}

/**
 * Search criteria for BaseMap entities
 */
export interface BaseMapSearchCriteria extends HierarchicalSearchCriteria {
  mapStyle?: string;
  tags?: string[];
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
  metadata?: Record<string, unknown>;
}
