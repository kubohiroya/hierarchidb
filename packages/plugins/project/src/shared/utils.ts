/**
 * Pure utility functions - UI/Worker共通で使用可能
 */

import type { MapConfiguration, RenderConfiguration, ValidationError, ValidationResult } from './types';

/**
 * Validate map configuration
 */
export function validateMapConfiguration(config: Partial<MapConfiguration>): ValidationResult {
  const errors: ValidationError[] = [];

  if (config.center) {
    const [lng, lat] = config.center;
    if (lng < -180 || lng > 180) {
      errors.push({
        field: 'center.longitude',
        message: 'Longitude must be between -180 and 180',
        severity: 'error'
      });
    }
    if (lat < -90 || lat > 90) {
      errors.push({
        field: 'center.latitude', 
        message: 'Latitude must be between -90 and 90',
        severity: 'error'
      });
    }
  }

  if (config.zoom !== undefined && (config.zoom < 0 || config.zoom > 24)) {
    errors.push({
      field: 'zoom',
      message: 'Zoom level must be between 0 and 24',
      severity: 'error'
    });
  }

  if (config.bearing !== undefined && (config.bearing < 0 || config.bearing >= 360)) {
    errors.push({
      field: 'bearing',
      message: 'Bearing must be between 0 and 359 degrees',
      severity: 'error'
    });
  }

  if (config.pitch !== undefined && (config.pitch < 0 || config.pitch > 60)) {
    errors.push({
      field: 'pitch',
      message: 'Pitch must be between 0 and 60 degrees',
      severity: 'error'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate render configuration
 */
export function validateRenderConfiguration(config: Partial<RenderConfiguration>): ValidationResult {
  const errors: ValidationError[] = [];

  if (config.maxZoom !== undefined && (config.maxZoom < 0 || config.maxZoom > 24)) {
    errors.push({
      field: 'maxZoom',
      message: 'Max zoom must be between 0 and 24',
      severity: 'error'
    });
  }

  if (config.minZoom !== undefined && (config.minZoom < 0 || config.minZoom > 24)) {
    errors.push({
      field: 'minZoom',
      message: 'Min zoom must be between 0 and 24',
      severity: 'error'
    });
  }

  if (config.maxZoom !== undefined && config.minZoom !== undefined && config.minZoom >= config.maxZoom) {
    errors.push({
      field: 'zoom',
      message: 'Min zoom must be less than max zoom',
      severity: 'error'
    });
  }

  if (config.pixelRatio !== undefined && (config.pixelRatio <= 0 || config.pixelRatio > 4)) {
    errors.push({
      field: 'pixelRatio',
      message: 'Pixel ratio must be between 0 and 4',
      severity: 'warning'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generate layer ID from resource node ID
 */
export function generateLayerId(resourceNodeId: string, layerIndex: number = 0): string {
  return `layer_${resourceNodeId}_${layerIndex}`;
}

/**
 * Parse layer ID to extract resource node ID
 */
export function parseLayerId(layerId: string): { resourceNodeId: string; layerIndex: number } | null {
  const match = layerId.match(/^layer_(.+)_(\d+)$/);
  if (!match) return null;
  
  return {
    resourceNodeId: match[1],
    layerIndex: parseInt(match[2], 10)
  };
}

/**
 * Calculate bounds from center and zoom
 */
export function calculateBounds(center: [number, number], zoom: number): [[number, number], [number, number]] {
  const [lng, lat] = center;
  
  // Simple approximation - in real implementation would use proper map projection math
  const scale = Math.pow(2, 20 - zoom);
  const deltaLng = 180 / scale;
  const deltaLat = 85 / scale;
  
  return [
    [Math.max(-180, lng - deltaLng), Math.max(-85, lat - deltaLat)],
    [Math.min(180, lng + deltaLng), Math.min(85, lat + deltaLat)]
  ];
}

/**
 * Debounce utility for rate limiting
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}