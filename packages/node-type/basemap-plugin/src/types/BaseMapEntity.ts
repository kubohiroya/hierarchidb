/**
 * @file BaseMapEntity.ts
 * @description BaseMap entity types extending Folder entity
 */

import type { NodeId, Timestamp } from '@hierarchidb/common-type';
import type { HierarchicalEntity } from '@hierarchidb/base-plugin';

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
}

/**
 * BaseMap working copy for edit operations
 */
export interface BaseMapWorkingCopy extends BaseMapEntity {
  workingCopyId: NodeId;
  isDraft: true;
  originalId?: NodeId;
  copiedAt: Timestamp;
}

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
export interface BaseMapSearchCriteria {
  name?: string;
  mapStyle?: string;
  parentId?: NodeId;
  hasChildren?: boolean;
}
