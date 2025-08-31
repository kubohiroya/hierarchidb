/**
 * @file BaseMapEntity.ts
 * @description BaseMap entity types extending Folder entity
 */

import type { NodeId, EntityId, WorkingCopy } from '@hierarchidb/common-type';
import type { FolderEntity, FolderEntityWorkingCopy } from '@hierarchidb/node-type-folder-plugin';

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
}

/**
 * BaseMap entity extending Folder entity
 */
export interface BaseMapEntity extends FolderEntity {
  // BaseMap specific fields
  baseMapMetadataId?: string;
  mapStyle: MapStyle;
  viewport: MapViewport;
  displayOptions: DisplayOptions;
}

/**
 * BaseMap working copy for edit operations
 */
export interface BaseMapWorkingCopy extends BaseMapEntity, FolderEntityWorkingCopy {
  isDraft: true;
  originalId?: EntityId;
  copiedAt: number;
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