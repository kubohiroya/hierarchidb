/**
 * Type guards for BaseMap plugin - strict runtime type checking
 */

import { NodeId, EntityId } from '@hierarchidb/common-core';
import { 
  BaseMapEntity, 
  BaseMapWorkingCopy, 
  CreateBaseMapData, 
  UpdateBaseMapData,
  MapLibreStyleConfig,
  StyleExpression,
  FilterExpression,
  LayerLayoutProperties,
  LayerPaintProperties,
  SourceMetadata,
  LayerMetadata
} from './types';

/**
 * Type guard for EntityId
 */
export function isEntityId(value: unknown): value is EntityId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard for NodeId
 */
export function isNodeId(value: unknown): value is NodeId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard for style expression
 */
export function isStyleExpression(value: unknown): value is StyleExpression {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  
  if (Array.isArray(value)) {
    return value.every(item => 
      typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
    );
  }
  
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).every(val => isStyleExpression(val));
  }
  
  return false;
}

/**
 * Type guard for filter expression
 */
export function isFilterExpression(value: unknown): value is FilterExpression {
  if (typeof value === 'boolean') return true;
  
  if (!Array.isArray(value) || value.length === 0) return false;
  
  const operator = value[0];
  if (typeof operator !== 'string') return false;
  
  // Validate based on operator type
  const validOperators = ['==', '!=', '>', '>=', '<', '<=', 'in', '!in', 'has', '!has', 'all', 'any', 'none'];
  return validOperators.includes(operator);
}

/**
 * Type guard for layer layout properties
 */
export function isLayerLayoutProperties(value: unknown): value is LayerLayoutProperties {
  if (typeof value !== 'object' || value === null) return false;
  
  const layout = value as Record<string, unknown>;
  
  // Check visibility if present
  if ('visibility' in layout) {
    if (layout.visibility !== 'visible' && layout.visibility !== 'none') {
      return false;
    }
  }
  
  // Check all properties are valid style expressions
  return Object.values(layout).every(val => val === undefined || isStyleExpression(val));
}

/**
 * Type guard for layer paint properties
 */
export function isLayerPaintProperties(value: unknown): value is LayerPaintProperties {
  if (typeof value !== 'object' || value === null) return false;
  
  const paint = value as Record<string, unknown>;
  return Object.values(paint).every(val => val === undefined || isStyleExpression(val));
}

/**
 * Type guard for source metadata
 */
export function isSourceMetadata(value: unknown): value is SourceMetadata {
  if (typeof value !== 'object' || value === null) return false;
  
  const metadata = value as Record<string, unknown>;
  return Object.values(metadata).every(val => 
    val === null || val === undefined || 
    typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean'
  );
}

/**
 * Type guard for layer metadata
 */
export function isLayerMetadata(value: unknown): value is LayerMetadata {
  return isSourceMetadata(value); // Same structure
}

/**
 * Type guard for MapLibre style configuration
 */
export function isMapLibreStyleConfig(value: unknown): value is MapLibreStyleConfig {
  if (typeof value !== 'object' || value === null) return false;
  
  const config = value as any;
  
  // Required version field
  if (typeof config.version !== 'number' || config.version < 8) return false;
  
  // Optional name field
  if (config.name !== undefined && typeof config.name !== 'string') return false;
  
  // Optional metadata field
  if (config.metadata !== undefined && !isSourceMetadata(config.metadata)) return false;
  
  // Required sources object
  if (!config.sources || typeof config.sources !== 'object') return false;
  
  // Validate each source
  for (const [sourceId, source] of Object.entries(config.sources)) {
    if (typeof sourceId !== 'string' || !source || typeof source !== 'object') return false;
    
    const sourceObj = source as any;
    const validSourceTypes = ['vector', 'raster', 'raster-dem', 'geojson', 'image', 'video'];
    if (!validSourceTypes.includes(sourceObj.type)) return false;
  }
  
  // Required layers array
  if (!Array.isArray(config.layers)) return false;
  
  // Validate each layer
  for (const layer of config.layers) {
    if (!layer || typeof layer !== 'object') return false;
    
    const layerObj = layer as any;
    if (typeof layerObj.id !== 'string' || !layerObj.id) return false;
    
    const validLayerTypes = [
      'fill', 'line', 'symbol', 'circle', 'heatmap', 
      'fill-extrusion', 'raster', 'hillshade', 'background'
    ];
    if (!validLayerTypes.includes(layerObj.type)) return false;
    
    // Validate layout if present
    if (layerObj.layout && !isLayerLayoutProperties(layerObj.layout)) return false;
    
    // Validate paint if present
    if (layerObj.paint && !isLayerPaintProperties(layerObj.paint)) return false;
  }
  
  return true;
}

/**
 * Type guard for coordinate pair
 */
export function isCoordinatePair(value: unknown): value is [number, number] {
  return Array.isArray(value) && 
         value.length === 2 && 
         typeof value[0] === 'number' && 
         typeof value[1] === 'number' &&
         value[0] >= -180 && value[0] <= 180 &&
         value[1] >= -85.05112878 && value[1] <= 85.05112878;
}

/**
 * Type guard for bounds object
 */
export function isBounds(value: unknown): value is { north: number; south: number; east: number; west: number } {
  if (typeof value !== 'object' || value === null) return false;
  
  const bounds = value as any;
  return typeof bounds.north === 'number' &&
         typeof bounds.south === 'number' &&
         typeof bounds.east === 'number' &&
         typeof bounds.west === 'number' &&
         bounds.north > bounds.south &&
         bounds.east > bounds.west &&
         bounds.north >= -85.05112878 && bounds.north <= 85.05112878 &&
         bounds.south >= -85.05112878 && bounds.south <= 85.05112878 &&
         bounds.east >= -180 && bounds.east <= 180 &&
         bounds.west >= -180 && bounds.west <= 180;
}

/**
 * Type guard for display options
 */
export function isDisplayOptions(value: unknown): value is { [key: string]: boolean | undefined } {
  if (typeof value !== 'object' || value === null) return false;
  
  const options = value as Record<string, unknown>;
  return Object.values(options).every(val => val === undefined || typeof val === 'boolean');
}

/**
 * Type guard for CreateBaseMapData
 */
export function isCreateBaseMapData(value: unknown): value is CreateBaseMapData {
  if (typeof value !== 'object' || value === null) return false;
  
  const data = value as any;
  
  // Required fields
  if (typeof data.name !== 'string' || data.name.length === 0) return false;
  if (!['streets', 'satellite', 'hybrid', 'terrain', 'custom'].includes(data.mapStyle)) return false;
  if (!isCoordinatePair(data.center)) return false;
  if (typeof data.zoom !== 'number' || data.zoom < 0 || data.zoom > 22) return false;
  
  // Optional fields
  if (data.description !== undefined && typeof data.description !== 'string') return false;
  if (data.styleUrl !== undefined && typeof data.styleUrl !== 'string') return false;
  if (data.styleConfig !== undefined && !isMapLibreStyleConfig(data.styleConfig)) return false;
  if (data.bearing !== undefined && (typeof data.bearing !== 'number' || data.bearing < 0 || data.bearing >= 360)) return false;
  if (data.pitch !== undefined && (typeof data.pitch !== 'number' || data.pitch < 0 || data.pitch > 60)) return false;
  if (data.bounds !== undefined && !isBounds(data.bounds)) return false;
  if (data.displayOptions !== undefined && !isDisplayOptions(data.displayOptions)) return false;
  if (data.apiKey !== undefined && typeof data.apiKey !== 'string') return false;
  if (data.attribution !== undefined && typeof data.attribution !== 'string') return false;
  if (data.tags !== undefined && (!Array.isArray(data.tags) || !data.tags.every((tag: any) => typeof tag === 'string'))) return false;
  
  return true;
}

/**
 * Type guard for UpdateBaseMapData
 */
export function isUpdateBaseMapData(value: unknown): value is UpdateBaseMapData {
  if (typeof value !== 'object' || value === null) return false;
  
  const data = value as any;
  
  // All fields are optional, but if present must be valid
  if (data.name !== undefined && (typeof data.name !== 'string' || data.name.length === 0)) return false;
  if (data.mapStyle !== undefined && !['streets', 'satellite', 'hybrid', 'terrain', 'custom'].includes(data.mapStyle)) return false;
  if (data.center !== undefined && !isCoordinatePair(data.center)) return false;
  if (data.zoom !== undefined && (typeof data.zoom !== 'number' || data.zoom < 0 || data.zoom > 22)) return false;
  if (data.bearing !== undefined && (typeof data.bearing !== 'number' || data.bearing < 0 || data.bearing >= 360)) return false;
  if (data.pitch !== undefined && (typeof data.pitch !== 'number' || data.pitch < 0 || data.pitch > 60)) return false;
  if (data.bounds !== undefined && !isBounds(data.bounds)) return false;
  if (data.displayOptions !== undefined && !isDisplayOptions(data.displayOptions)) return false;
  
  return true;
}

/**
 * Type guard for BaseMapEntity
 */
export function isBaseMapEntity(value: unknown): value is BaseMapEntity {
  if (typeof value !== 'object' || value === null) return false;
  
  const entity = value as any;
  
  // Required PeerEntity fields
  if (!isEntityId(entity.id)) return false;
  if (!isNodeId(entity.nodeId)) return false;
  if (typeof entity.createdAt !== 'number') return false;
  if (typeof entity.updatedAt !== 'number') return false;
  if (typeof entity.version !== 'number') return false;
  
  // BaseMap specific fields
  if (typeof entity.name !== 'string' || entity.name.length === 0) return false;
  if (!['streets', 'satellite', 'hybrid', 'terrain', 'custom'].includes(entity.mapStyle)) return false;
  if (!isCoordinatePair(entity.center)) return false;
  if (typeof entity.zoom !== 'number' || entity.zoom < 0 || entity.zoom > 22) return false;
  if (typeof entity.bearing !== 'number' || entity.bearing < 0 || entity.bearing >= 360) return false;
  if (typeof entity.pitch !== 'number' || entity.pitch < 0 || entity.pitch > 60) return false;
  
  // Optional fields validation
  if (entity.description !== undefined && typeof entity.description !== 'string') return false;
  if (entity.styleUrl !== undefined && typeof entity.styleUrl !== 'string') return false;
  if (entity.styleConfig !== undefined && !isMapLibreStyleConfig(entity.styleConfig)) return false;
  if (entity.bounds !== undefined && !isBounds(entity.bounds)) return false;
  if (entity.displayOptions !== undefined && !isDisplayOptions(entity.displayOptions)) return false;
  if (entity.apiKey !== undefined && typeof entity.apiKey !== 'string') return false;
  if (entity.attribution !== undefined && typeof entity.attribution !== 'string') return false;
  if (entity.thumbnailUrl !== undefined && typeof entity.thumbnailUrl !== 'string') return false;
  if (entity.tags !== undefined && (!Array.isArray(entity.tags) || !entity.tags.every((tag: any) => typeof tag === 'string'))) return false;
  
  return true;
}

/**
 * Type guard for BaseMapWorkingCopy
 */
export function isBaseMapWorkingCopy(value: unknown): value is BaseMapWorkingCopy {
  if (!isBaseMapEntity(value)) return false;
  
  const workingCopy = value as any;
  
  // Working copy specific fields
  if (typeof workingCopy.workingCopyId !== 'string') return false;
  if (!isNodeId(workingCopy.workingCopyOf)) return false;
  if (typeof workingCopy.copiedAt !== 'number') return false;
  if (typeof workingCopy.isDirty !== 'boolean') return false;
  
  return true;
}