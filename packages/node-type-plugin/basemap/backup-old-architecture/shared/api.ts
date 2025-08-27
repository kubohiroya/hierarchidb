/**
 * BaseMap API interface - UI-Worker通信契約
 */

import { NodeId } from '@hierarchidb/common-core';
import { 
  BaseMapEntity, 
  CreateBaseMapData, 
  UpdateBaseMapData,
  MapViewportState,
  MapLibreStyleConfig
} from './types';

// Additional types needed for API but not in main types.ts
export interface BaseMapDisplayOptions {
  show3dBuildings?: boolean;
  showTraffic?: boolean;
  showTransit?: boolean;
  showTerrain?: boolean;
  showLabels?: boolean;
  showControlPanel?: boolean;
  showNavigationControls?: boolean;
  showScaleControl?: boolean;
}

export interface BaseMapValidationResult {
  isValid: boolean;
  errors: BaseMapValidationError[];
  warnings: BaseMapValidationWarning[];
  configuration: {
    hasValidStyle: boolean;
    hasValidViewport: boolean;
    hasValidBounds: boolean;
    estimatedTileCount: number;
    estimatedDataSize: number;
  };
}

export interface BaseMapValidationError {
  code: string;
  message: string;
  field?: string;
  value?: unknown;
}

export interface BaseMapValidationWarning {
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
}

export interface BaseMapStatistics {
  nodeId: NodeId;
  totalTilesLoaded: number;
  totalDataSize: number;
  cacheHitRate: number;
  lastAccessed: number;
  accessCount: number;
  averageLoadTime: number;
  errors: {
    tileLoadErrors: number;
    networkErrors: number;
    styleLoadErrors: number;
  };
}

export interface BaseMapApiMetadata {
  nodeId: NodeId;
  mapStyle: string;
  hasCustomStyle: boolean;
  layerCount: number;
  sourceCount: number;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
  zoomRange: {
    min: number;
    max: number;
  };
  attribution: string[];
  supportedProjections: string[];
}

/**
 * Main BaseMap API interface for UI-Worker communication via PluginRegistry
 */
export interface BaseMapAPI extends Record<string, (...args: any[]) => Promise<any>> {
  // Core basemap operations
  createEntity(nodeId: NodeId, data: CreateBaseMapData): Promise<BaseMapEntity>;
  getEntity(nodeId: NodeId): Promise<BaseMapEntity | undefined>;
  updateEntity(nodeId: NodeId, data: UpdateBaseMapData): Promise<void>;
  deleteEntity(nodeId: NodeId): Promise<void>;

  // Map style operations
  setMapStyle(nodeId: NodeId, style: 'streets' | 'satellite' | 'hybrid' | 'terrain' | 'custom'): Promise<void>;
  setCustomStyle(nodeId: NodeId, styleUrl: string): Promise<void>;
  setCustomStyleConfig(nodeId: NodeId, styleConfig: MapLibreStyleConfig): Promise<void>;
  getMapStyle(nodeId: NodeId): Promise<string | undefined>;

  // Map viewport operations
  setViewport(nodeId: NodeId, viewport: MapViewportState): Promise<void>;
  getViewport(nodeId: NodeId): Promise<MapViewportState | undefined>;
  setCenter(nodeId: NodeId, center: [number, number]): Promise<void>;
  setZoom(nodeId: NodeId, zoom: number): Promise<void>;
  setBounds(nodeId: NodeId, bounds: { north: number; south: number; east: number; west: number }): Promise<void>;

  // Display options
  setDisplayOptions(nodeId: NodeId, options: BaseMapDisplayOptions): Promise<void>;
  getDisplayOptions(nodeId: NodeId): Promise<BaseMapDisplayOptions | undefined>;

  // Map validation and preview
  validateMapConfiguration(nodeId: NodeId): Promise<BaseMapValidationResult>;
  generateThumbnail(nodeId: NodeId, width: number, height: number): Promise<string>;

  // Statistics and metadata  
  getBaseMapStatistics(nodeId: NodeId): Promise<BaseMapStatistics>;
  getMapMetadata(nodeId: NodeId): Promise<BaseMapApiMetadata>;
}