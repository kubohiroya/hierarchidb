/**
 * Pure utility functions - shared between UI and Worker layers
 */

import { 
  CreateBaseMapData, 
  UpdateBaseMapData, 
  BaseMapEntity, 
  MapLibreStyleConfig 
} from './types';
import { 
  VALIDATION_LIMITS, 
  ERROR_CODES, 
  WARNING_CODES,
  PERFORMANCE_THRESHOLDS 
} from './constants';
import { 
  validateNodeName, 
  validateNodeDescription, 
  validateNodeTags 
} from '@hierarchidb/00-core';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: BasicValidationError[];
  warnings: BasicValidationWarning[];
}

export interface BasicValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface BasicValidationWarning {
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
}

/**
 * Validate create basemap data
 */
export function validateCreateBaseMapData(data: CreateBaseMapData): ValidationResult {
  const errors: BasicValidationError[] = [];
  const warnings: BasicValidationWarning[] = [];

  // Use common validation for name
  if (data.name !== undefined) {
    const nameValidation = validateNodeName(data.name);
    if (!nameValidation.isValid) {
      errors.push({
        code: ERROR_CODES.INVALID_NAME,
        message: nameValidation.error || 'Invalid name',
        field: 'name'
      });
    }
  } else {
    errors.push({
      code: ERROR_CODES.MISSING_REQUIRED_FIELD,
      message: 'Name is required',
      field: 'name'
    });
  }

  // Use common validation for description
  if (data.description !== undefined) {
    const descValidation = validateNodeDescription(data.description);
    if (!descValidation.isValid) {
      errors.push({
        code: ERROR_CODES.INVALID_DESCRIPTION,
        message: descValidation.error || 'Invalid description',
        field: 'description'
      });
    }
  }

  // Validate map style
  if (!['streets', 'satellite', 'hybrid', 'terrain', 'custom'].includes(data.mapStyle)) {
    errors.push({
      code: ERROR_CODES.INVALID_MAP_STYLE,
      message: 'Invalid map style',
      field: 'mapStyle'
    });
  }

  // Validate center coordinates
  if (!Array.isArray(data.center) || data.center.length !== 2) {
    errors.push({
      code: ERROR_CODES.INVALID_CENTER,
      message: 'Center must be an array of [longitude, latitude]',
      field: 'center'
    });
  } else {
    const [lng, lat] = data.center;
    if (typeof lng !== 'number' || typeof lat !== 'number' ||
        lng < VALIDATION_LIMITS.LONGITUDE_MIN || lng > VALIDATION_LIMITS.LONGITUDE_MAX ||
        lat < VALIDATION_LIMITS.LATITUDE_MIN || lat > VALIDATION_LIMITS.LATITUDE_MAX) {
      errors.push({
        code: ERROR_CODES.INVALID_CENTER,
        message: 'Invalid center coordinates',
        field: 'center'
      });
    }
  }

  // Validate zoom level
  if (typeof data.zoom !== 'number' || 
      data.zoom < VALIDATION_LIMITS.ZOOM_MIN || 
      data.zoom > VALIDATION_LIMITS.ZOOM_MAX) {
    errors.push({
      code: ERROR_CODES.INVALID_ZOOM,
      message: `Zoom must be between ${VALIDATION_LIMITS.ZOOM_MIN} and ${VALIDATION_LIMITS.ZOOM_MAX}`,
      field: 'zoom'
    });
  } else if (data.zoom > PERFORMANCE_THRESHOLDS.HIGH_ZOOM_WARNING) {
    warnings.push({
      code: WARNING_CODES.HIGH_ZOOM_LEVEL,
      message: 'High zoom level may impact performance',
      field: 'zoom',
      suggestion: `Consider using zoom level below ${PERFORMANCE_THRESHOLDS.HIGH_ZOOM_WARNING} for better performance`
    });
  }

  // Validate bearing
  if (data.bearing !== undefined && 
      (typeof data.bearing !== 'number' || 
       data.bearing < VALIDATION_LIMITS.BEARING_MIN || 
       data.bearing >= VALIDATION_LIMITS.BEARING_MAX)) {
    errors.push({
      code: ERROR_CODES.INVALID_BEARING,
      message: `Bearing must be between ${VALIDATION_LIMITS.BEARING_MIN} and ${VALIDATION_LIMITS.BEARING_MAX - 1}`,
      field: 'bearing'
    });
  }

  // Validate pitch
  if (data.pitch !== undefined && 
      (typeof data.pitch !== 'number' || 
       data.pitch < VALIDATION_LIMITS.PITCH_MIN || 
       data.pitch > VALIDATION_LIMITS.PITCH_MAX)) {
    errors.push({
      code: ERROR_CODES.INVALID_PITCH,
      message: `Pitch must be between ${VALIDATION_LIMITS.PITCH_MIN} and ${VALIDATION_LIMITS.PITCH_MAX}`,
      field: 'pitch'
    });
  }

  // Validate bounds if provided
  if (data.bounds) {
    const { north, south, east, west } = data.bounds;
    if (typeof north !== 'number' || typeof south !== 'number' ||
        typeof east !== 'number' || typeof west !== 'number' ||
        north <= south || east <= west ||
        north < VALIDATION_LIMITS.LATITUDE_MIN || north > VALIDATION_LIMITS.LATITUDE_MAX ||
        south < VALIDATION_LIMITS.LATITUDE_MIN || south > VALIDATION_LIMITS.LATITUDE_MAX ||
        east < VALIDATION_LIMITS.LONGITUDE_MIN || east > VALIDATION_LIMITS.LONGITUDE_MAX ||
        west < VALIDATION_LIMITS.LONGITUDE_MIN || west > VALIDATION_LIMITS.LONGITUDE_MAX) {
      errors.push({
        code: ERROR_CODES.INVALID_BOUNDS,
        message: 'Invalid bounds configuration',
        field: 'bounds'
      });
    }
  }

  // Validate custom style URL
  if (data.mapStyle === 'custom' && data.styleUrl) {
    if (!isValidUrl(data.styleUrl)) {
      errors.push({
        code: ERROR_CODES.INVALID_STYLE_URL,
        message: 'Invalid style URL format',
        field: 'styleUrl'
      });
    }
  }

  // Use common validation for tags
  if (data.tags !== undefined) {
    const tagsValidation = validateNodeTags(data.tags);
    if (!tagsValidation.isValid) {
      errors.push({
        code: ERROR_CODES.INVALID_NAME,
        message: tagsValidation.error || 'Invalid tags',
        field: 'tags'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate update basemap data
 */
export function validateUpdateBaseMapData(data: UpdateBaseMapData): ValidationResult {
  // Create a temporary object with required fields for validation
  const tempData: CreateBaseMapData = {
    name: data.name || 'temp',
    mapStyle: data.mapStyle || 'streets',
    center: data.center || [0, 0],
    zoom: data.zoom || 10,
    ...data
  };

  // Use create validation but ignore missing required fields
  const result = validateCreateBaseMapData(tempData);
  
  // Filter out missing required field errors since this is an update
  result.errors = result.errors.filter(error => 
    error.code !== ERROR_CODES.MISSING_REQUIRED_FIELD
  );

  result.isValid = result.errors.length === 0;
  
  return result;
}

/**
 * Validate MapLibre style configuration
 */
export function validateStyleConfig(styleConfig: MapLibreStyleConfig): ValidationResult {
  const errors: BasicValidationError[] = [];
  const warnings: BasicValidationWarning[] = [];

  // Validate version
  if (typeof styleConfig.version !== 'number' || styleConfig.version < 8) {
    errors.push({
      code: ERROR_CODES.INVALID_STYLE_CONFIG,
      message: 'Style version must be 8 or higher',
      field: 'version'
    });
  }

  // Validate sources
  if (!styleConfig.sources || typeof styleConfig.sources !== 'object') {
    errors.push({
      code: ERROR_CODES.INVALID_STYLE_CONFIG,
      message: 'Style must have sources object',
      field: 'sources'
    });
  } else {
    for (const [sourceId, source] of Object.entries(styleConfig.sources)) {
      if (!source.type) {
        errors.push({
          code: ERROR_CODES.INVALID_STYLE_CONFIG,
          message: `Source ${sourceId} must have a type`,
          field: `sources.${sourceId}.type`
        });
      }
    }
  }

  // Validate layers
  if (!Array.isArray(styleConfig.layers)) {
    errors.push({
      code: ERROR_CODES.INVALID_STYLE_CONFIG,
      message: 'Style must have layers array',
      field: 'layers'
    });
  } else {
    for (let i = 0; i < styleConfig.layers.length; i++) {
      const layer = styleConfig.layers[i];
      if (!layer || !layer.id || !layer.type) {
        errors.push({
          code: ERROR_CODES.INVALID_STYLE_CONFIG,
          message: `Layer ${i} must have id and type`,
          field: `layers[${i}]`
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Calculate estimated tile count for given bounds and zoom
 */
export function calculateEstimatedTileCount(
  bounds: { north: number; south: number; east: number; west: number },
  zoom: number
): number {
  const n = Math.pow(2, zoom);
  const latRad1 = bounds.south * Math.PI / 180;
  const latRad2 = bounds.north * Math.PI / 180;
  
  const x1 = Math.floor((bounds.west + 180) / 360 * n);
  const x2 = Math.floor((bounds.east + 180) / 360 * n);
  const y1 = Math.floor((1 - Math.log(Math.tan(latRad1) + 1 / Math.cos(latRad1)) / Math.PI) / 2 * n);
  const y2 = Math.floor((1 - Math.log(Math.tan(latRad2) + 1 / Math.cos(latRad2)) / Math.PI) / 2 * n);
  
  return Math.abs((x2 - x1 + 1) * (y1 - y2 + 1));
}

/**
 * Calculate bounds area in square kilometers
 */
export function calculateBoundsArea(bounds: { north: number; south: number; east: number; west: number }): number {
  const R = 6371; // Earth's radius in km
  const dLat = (bounds.north - bounds.south) * Math.PI / 180;
  const dLng = (bounds.east - bounds.west) * Math.PI / 180;
  const meanLat = (bounds.north + bounds.south) / 2 * Math.PI / 180;
  
  const area = R * R * Math.abs(dLat * dLng * Math.cos(meanLat));
  return area;
}

/**
 * Merge basemap entities (for updates)
 */
export function mergeBaseMapEntity(original: BaseMapEntity, updates: UpdateBaseMapData): BaseMapEntity {
  return {
    ...original,
    ...updates,
    updatedAt: Date.now(),
    version: original.version + 1,
  };
}

/**
 * Check if string is a valid URL
 */
function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate thumbnail URL placeholder
 */
export function generateThumbnailPlaceholder(width: number, height: number, mapStyle: string): string {
  return `data:image/svg+xml;base64,${btoa(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <text x="50%" y="50%" font-family="Arial" font-size="14" fill="#666" text-anchor="middle" dy=".3em">
        ${mapStyle} Map
      </text>
    </svg>
  `)}`;
}

/**
 * Deep clone object (for immutable updates)
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (Array.isArray(obj)) return obj.map(deepClone) as unknown as T;
  
  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}