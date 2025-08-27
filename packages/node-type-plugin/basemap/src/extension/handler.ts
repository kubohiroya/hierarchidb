/**
 * @file handler.ts
 * @description BaseMap extension handler - simplified for folder extension pattern
 * 
 * This file contains utility functions for BaseMap-specific operations
 * that extend the basic folder functionality.
 */

import type { BaseMapEntity, BaseMapWorkingCopy } from './definition';

/**
 * Default BaseMap configuration
 */
export const DEFAULT_BASEMAP_CONFIG = {
  mapStyle: {
    style: 'streets' as const,
  },
  viewport: {
    center: [139.6917, 35.6895] as [number, number], // Tokyo
    zoom: 10,
    bearing: 0,
    pitch: 0,
  },
  displayOptions: {
    show3dBuildings: false,
    showTraffic: false,
    showTransit: false,
    showTerrain: false,
    showLabels: true,
  },
};

/**
 * Create default BaseMap entity data
 */
export function createDefaultBaseMapData(name: string): Partial<BaseMapEntity> {
  return {
    name,
    ...DEFAULT_BASEMAP_CONFIG,
  };
}

/**
 * Validate BaseMap viewport coordinates
 */
export function validateViewportCoordinates(center: [number, number]): boolean {
  const [lng, lat] = center;
  return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

/**
 * Validate custom style URL format
 */
export function validateCustomStyleUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate BaseMap working copy
 */
export function createBaseMapWorkingCopy(entity: BaseMapEntity): BaseMapWorkingCopy {
  return {
    ...entity,
    isDraft: true,
    originalId: entity.id,
    copiedAt: Date.now(),
  };
}