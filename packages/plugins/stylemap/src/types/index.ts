/**
 * @file index.ts
 * @description Main export file for StyleMap plugin type definitions
 * Provides a centralized export for all StyleMap-related types
 */

// Import all types first to ensure they're available for exports
import type { StyleMapConfig, MapLibreStyleProperty } from './StyleMapConfig';
import type { FilterRule } from './FilterRule';
import type { StyleMapEntity } from './StyleMapEntity';
import type { TableMetadataEntity } from './TableMetadataEntity';

// Core entity types
export type {
  StyleMapEntity,
  StyleMapMetadata,
  StyleMapWorkingCopy,
  StyleMapCreationData,
  StyleMapUpdateData,
  StyleMapValidationResult,
} from './StyleMapEntity';

export {
  DEFAULT_STYLEMAP_CONFIG,
  validateStyleMapEntity,
  createStyleMapEntity,
  createStyleMapWorkingCopy,
} from './StyleMapEntity';

// StyleMap configuration types
export type {
  MapLibreStyleProperty,
  ColorMappingAlgorithm,
  ColorSpace,
  ColorMappingConfig,
  StyleMapConfig,
  StylePropertyMetadata,
} from './StyleMapConfig';

export {
  DEFAULT_STYLEMAP_CONFIG as DEFAULT_STYLE_CONFIG,
  COLOR_MAPPING_PRESETS,
  MAPLIBRE_STYLE_PROPERTIES,
  validateStyleMapConfig,
  createStyleMapConfig,
  applyColorPreset,
  getStylePropertyMetadata,
  getStylePropertiesByCategory,
} from './StyleMapConfig';

// Filter rule types
export type {
  FilterAction,
  FilterRule,
  FilterRuleValidationResult,
  FilterRuleStats,
} from './FilterRule';

export {
  createFilterRule,
  validateFilterRule,
  createTemplateFilterRules,
  applyFilterRules,
  getColumnUniqueValues,
} from './FilterRule';

// Table metadata types
export type {
  ColumnMetadata,
  TableMetadataEntity,
  RowEntity,
  TableDataSummary,
  TableImportResult,
  TableQueryOptions,
  TableQueryResult,
} from './TableMetadataEntity';

export {
  createTableMetadataEntity,
  createRowEntity,
  analyzeColumnData,
  validateTableMetadata,
  createTableDataSummary,
} from './TableMetadataEntity';

// Common utility types
export interface StyleMapFormData {
  // Step 1: Basic info
  name: string;
  description?: string;

  // Step 2: File upload
  file?: File;
  filename?: string;
  downloadUrl?: string;

  // Step 3: Column mapping
  keyColumn?: string;
  valueColumn?: string;
  availableColumns?: string[];

  // Step 4: Color mapping
  styleMapConfig?: StyleMapConfig;

  // Step 5: Filtering
  filterRules?: FilterRule[];

  // Working state
  currentStep: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * StyleMap plugin constants
 */
export const STYLEMAP_CONSTANTS = {
  SUPPORTED_FILE_TYPES: ['csv', 'tsv', 'xlsx', 'xls'] as const,
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_ROWS: 1000000, // 1M rows
  MAX_COLUMNS: 1000,
  CACHE_TTL: 3600000, // 1 hour in milliseconds
  WORKING_COPY_TTL: 86400000, // 24 hours in milliseconds

  // Color mapping defaults
  DEFAULT_HUE_START: 0.0, // Red
  DEFAULT_HUE_END: 0.67, // Blue
  DEFAULT_SATURATION: 0.8,
  DEFAULT_BRIGHTNESS: 0.9,

  // Performance limits
  SAMPLE_SIZE: 1000, // Sample size for analysis
  PREVIEW_ROWS: 10, // Number of rows in preview
  UNIQUE_VALUES_LIMIT: 100, // Limit for unique value suggestions
} as const;

/**
 * StyleMap plugin error types
 */
export enum StyleMapErrorType {
  INVALID_FILE_FORMAT = 'INVALID_FILE_FORMAT',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  PARSE_ERROR = 'PARSE_ERROR',
  INVALID_COLUMN = 'INVALID_COLUMN',
  INVALID_CONFIG = 'INVALID_CONFIG',
  CACHE_ERROR = 'CACHE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * StyleMap plugin error class
 */
export class StyleMapError extends Error {
  constructor(
    public type: StyleMapErrorType,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'StyleMapError';
  }
}

/**
 * Color value representations
 */
export interface RGBColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface HSVColor {
  h: number; // 0-360
  s: number; // 0-100
  v: number; // 0-100
}

export interface HexColor {
  hex: string; // #RRGGBB format
}

/**
 * MapLibre style value types
 */
export type MapLibreColorValue = string | RGBColor | [number, number, number];
export type MapLibreNumberValue = number;
export type MapLibreOpacityValue = number; // 0-1

/**
 * Generated style property result
 */
export interface StylePropertyValue {
  property: MapLibreStyleProperty;
  value: MapLibreColorValue | MapLibreNumberValue | MapLibreOpacityValue;
  keyValue: string | number;
}

/**
 * Batch style generation result
 */
export interface StyleGenerationResult {
  properties: StylePropertyValue[];
  config: StyleMapConfig;
  stats: {
    totalValues: number;
    mappedValues: number;
    unmappedValues: number;
    minValue: number;
    maxValue: number;
  };
}

/**
 * Cache key components for StyleMap
 */
export interface CacheKeyComponents {
  contentHash: string; // File content SHA3 hash
  configHash: string; // Configuration hash
  filterHash: string; // Filter rules hash
  version: string; // Plugin version
}

/**
 * Cache entry for generated styles
 */
export interface StyleCacheEntry {
  cacheKey: string;
  styleResult: StyleGenerationResult;
  cachedAt: number;
  expiresAt: number;
  hitCount: number;
}

/**
 * Plugin metadata interface
 */
export interface StyleMapPluginMeta {
  version: string;
  description: string;
  author: string;
  compatibleVersions: string[];
  dependencies: string[];
  features: string[];
}

/**
 * Type guards for runtime type checking
 */
export function isStyleMapEntity(obj: any): obj is StyleMapEntity {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.nodeId === 'string' &&
    typeof obj.createdAt === 'number' &&
    typeof obj.updatedAt === 'number' &&
    typeof obj.version === 'number'
  );
}

export function isStyleMapConfig(obj: any): obj is StyleMapConfig {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.algorithm === 'string' &&
    typeof obj.colorSpace === 'string' &&
    obj.mapping &&
    typeof obj.mapping === 'object' &&
    typeof obj.targetProperty === 'string'
  );
}

export function isFilterRule(obj: any): obj is FilterRule {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.action === 'string' &&
    typeof obj.keyColumn === 'string' &&
    typeof obj.matchValue === 'string'
  );
}

export function isTableMetadataEntity(obj: any): obj is TableMetadataEntity {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.tableId === 'string' &&
    typeof obj.nodeId === 'string' &&
    typeof obj.filename === 'string' &&
    Array.isArray(obj.columns) &&
    typeof obj.rowCount === 'number'
  );
}

/**
 * Utility type for optional fields in updates
 */
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

/**
 * Utility type for required fields in creation
 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Deep readonly utility type
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Re-export important types from dependencies
 */
export type { TreeNodeId, UUID } from '@hierarchidb/core';
export type { BaseEntity, BaseWorkingCopy } from '@hierarchidb/worker';
