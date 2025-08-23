/**
 * Shared layer exports - available to both UI and Worker layers
 */

// API interface (critical for UI-Worker communication)
export type { 
  BaseMapAPI,
  BaseMapDisplayOptions,
  BaseMapValidationResult,
  BaseMapValidationError,
  BaseMapValidationWarning,
  BaseMapStatistics,
  BaseMapApiMetadata
} from './api';

// Types
export type { 
  BaseMapEntity,
  BaseMapWorkingCopy,
  CreateBaseMapData,
  UpdateBaseMapData,
  MapViewportState,
  MapLibreStyleConfig,
  StyleExpression,
  FilterExpression,
  LayerLayoutProperties,
  LayerPaintProperties,
  LayerMetadata,
  SourceMetadata
} from './types';

export { 
  PredefinedMapStyle,
  DEFAULT_MAP_CONFIG,
  MAP_STYLE_PRESETS
} from './types';

// Metadata
export type { PluginMetadata } from '@hierarchidb/00-core';
export { BaseMapMetadata } from './metadata';

// Constants
export {
  DEFAULT_VALUES,
  MAP_STYLES,
  VALIDATION_LIMITS,
  ERROR_CODES,
  WARNING_CODES,
  PERFORMANCE_THRESHOLDS,
  TILE_PROVIDERS,
  CACHE_CONFIG,
  FILE_LIMITS
} from './constants';

// Pure utility functions
export {
  validateCreateBaseMapData,
  validateUpdateBaseMapData,
  validateStyleConfig,
  calculateEstimatedTileCount,
  calculateBoundsArea,
  mergeBaseMapEntity,
  generateThumbnailPlaceholder,
  deepClone
} from './utils';

export type {
  ValidationResult,
  BasicValidationError,
  BasicValidationWarning
} from './utils';

// Enhanced validation system
export {
  ValidationBuilder,
  FieldValidationBuilder,
  validateCreateBaseMapDataStrict,
  validateUpdateBaseMapDataStrict,
  BaseMapAsyncValidator,
  validatePerformance
} from './validation';

export type {
  ValidationSeverity,
  ValidationError as EnhancedValidationError,
  ValidationResult as EnhancedValidationResult,  
  CustomValidationFunction,
  AsyncValidator
} from './validation';

// Type guards for runtime type safety
export {
  isEntityId,
  isNodeId,
  isStyleExpression,
  isFilterExpression,
  isLayerLayoutProperties,
  isLayerPaintProperties,
  isSourceMetadata,
  isLayerMetadata,
  isMapLibreStyleConfig,
  isCoordinatePair,
  isBounds,
  isDisplayOptions,
  isCreateBaseMapData,
  isUpdateBaseMapData,
  isBaseMapEntity,
  isBaseMapWorkingCopy
} from './typeGuards';

// Typed error classes
export {
  BaseMapNameValidationError,
  BaseMapStyleValidationError,
  BaseMapCoordinateValidationError,
  BaseMapZoomValidationError,
  BaseMapStyleUrlValidationError,
  BaseMapStyleConfigValidationError,
  BaseMapBoundsValidationError,
  BaseMapDataValidationError,
  BaseMapEntityNotFoundError,
  BaseMapDatabaseError,
  BaseMapApiError,
  BaseMapWorkingCopyError,
  BaseMapErrorFactory,
  isBaseMapValidationError,
  isBaseMapEntityNotFoundError,
  isBaseMapDatabaseError,
  isBaseMapApiError
} from './errors';