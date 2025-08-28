/**
 * @file BaseMapEntity.ts
 * @description BaseMap entity types following the Folder extension pattern
 */

export type { BaseMapEntity, BaseMapWorkingCopy } from '../extension/definition';

// Re-export for backwards compatibility
export type BaseMapExtendedFields = {
  baseMapMetadataId?: string;
  zxy?: [number, number, number]; // [zoom, x(longitude), y(latitude)] for initial position
  mapStyle: {
    style: 'streets' | 'satellite' | 'terrain' | 'dark' | 'light' | 'custom';
    customStyleUrl?: string;
    customStyleConfig?: Record<string, any>;
  };
  viewport: {
    center: [number, number]; // [longitude, latitude]
    zoom: number;
    bearing: number;
    pitch: number;
  };
  displayOptions: {
    show3dBuildings: boolean;
    showTraffic: boolean;
    showTransit: boolean;
    showTerrain: boolean;
    showLabels: boolean;
    attribution?: string;
    tags?: string[];
  };
};