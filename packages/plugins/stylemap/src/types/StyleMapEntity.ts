/**
 * @file StyleMapEntity.ts
 * @description StyleMap entity type definitions
 * Combines hierarchidb BaseEntity with eria-cartograph StyleMap specification
 * References:
 * - docs/spec/plugin-stylemap-requirements.md
 * - ../eria-cartograph/app0/src/domains/resources/stylemap/types/StyleMapEntity.ts
 */

import type { TreeNodeId, UUID } from '@hierarchidb/core';
import type { BaseEntity, BaseWorkingCopy } from '@hierarchidb/worker/registry';
import type { StyleMapConfig } from './StyleMapConfig';
import type { FilterRule } from './FilterRule';

/**
 * StyleMap entity representing CSV/TSV data to MapLibre style mapping configuration
 * Extends hierarchidb BaseEntity with StyleMap-specific fields
 */
export interface StyleMapEntity extends BaseEntity {
  nodeId: TreeNodeId;

  // File information
  /** Original filename (CSV/TSV) */
  filename?: string;
  /** SHA3-256 hash key for caching the complete file data */
  cacheKey?: string;
  /** URL that was used to download the file (for URL-based imports) */
  downloadUrl?: string;

  // Table relationship (normalized design)
  /** Reference to the table store containing the actual data */
  tableMetadataId?: UUID;

  // Column mapping configuration
  /** Column name to use as mapping key */
  keyColumn?: string;
  /** Column name to use as mapping value */
  valueColumn?: string;

  // StyleMap configuration
  /** Filter rules to apply to the data */
  filterRules?: FilterRule[];
  /** Style mapping configuration */
  styleMapConfig?: StyleMapConfig;

  // Metadata inherited from BaseEntity
  createdAt: number;
  updatedAt: number;
  version: number;

  // Index signature for compatibility with BaseEntity
  [key: string]: unknown;
}

/**
 * Metadata-only version of StyleMapEntity
 * Used when you only need the metadata without the table reference
 */
export type StyleMapMetadata = Pick<
  StyleMapEntity,
  | 'nodeId'
  | 'filename'
  | 'cacheKey'
  | 'downloadUrl'
  | 'keyColumn'
  | 'valueColumn'
  | 'filterRules'
  | 'styleMapConfig'
  | 'createdAt'
  | 'updatedAt'
  | 'version'
>;

/**
 * StyleMap working copy for edit operations
 * Extends hierarchidb BaseWorkingCopy with StyleMap fields
 */
export interface StyleMapWorkingCopy extends BaseWorkingCopy {
  nodeId: TreeNodeId;

  // All StyleMapEntity fields for editing
  filename?: string;
  cacheKey?: string;
  downloadUrl?: string;
  tableMetadataId?: UUID;
  keyColumn?: string;
  valueColumn?: string;
  filterRules?: FilterRule[];
  styleMapConfig?: StyleMapConfig;

  // Working copy specific fields (inherited from BaseWorkingCopy)
  workingCopyId: string;
  workingCopyOf: TreeNodeId;
  copiedAt: number;
  isDirty: boolean;

  // Timestamps
  createdAt: number;
  updatedAt: number;
  version: number;

  // Index signature for compatibility
  [key: string]: unknown;
}

/**
 * Default StyleMap configuration
 */
export const DEFAULT_STYLEMAP_CONFIG: Partial<StyleMapEntity> = {
  filename: 'Untitled.csv',
  filterRules: [],
  keyColumn: undefined,
  valueColumn: undefined,
  styleMapConfig: undefined,
};

/**
 * StyleMap creation data
 * Used for creating new StyleMap entities
 */
export interface StyleMapCreationData {
  filename?: string;
  downloadUrl?: string;
  keyColumn?: string;
  valueColumn?: string;
  filterRules?: FilterRule[];
  styleMapConfig?: StyleMapConfig;
}

/**
 * StyleMap update data
 * Used for updating existing StyleMap entities
 */
export type StyleMapUpdateData = Partial<Omit<StyleMapEntity, 'nodeId' | 'createdAt' | 'version'>>;

/**
 * Validation result for StyleMap entities
 */
export interface StyleMapValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate StyleMap entity
 */
export function validateStyleMapEntity(entity: Partial<StyleMapEntity>): StyleMapValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate filename format
  if (entity.filename && !entity.filename.match(/\.(csv|tsv)$/i)) {
    errors.push('Filename must have .csv or .tsv extension');
  }

  // Validate column mapping
  if (entity.keyColumn && entity.valueColumn && entity.keyColumn === entity.valueColumn) {
    errors.push('Key column and value column must be different');
  }

  // Validate filter rules
  if (entity.filterRules) {
    entity.filterRules.forEach((rule, index) => {
      if (!rule.keyColumn) {
        errors.push(`Filter rule ${index + 1}: keyColumn is required`);
      }
      if (!rule.matchValue) {
        errors.push(`Filter rule ${index + 1}: matchValue is required`);
      }
    });
  }

  // Validate style mapping configuration
  if (entity.styleMapConfig) {
    const config = entity.styleMapConfig;

    if (config.mapping) {
      if (config.mapping.min >= config.mapping.max) {
        errors.push('StyleMap config: min value must be less than max value');
      }

      if (config.mapping.hueStart < 0 || config.mapping.hueStart > 1) {
        errors.push('StyleMap config: hueStart must be between 0 and 1');
      }

      if (config.mapping.hueEnd < 0 || config.mapping.hueEnd > 1) {
        errors.push('StyleMap config: hueEnd must be between 0 and 1');
      }

      if (config.mapping.saturation < 0 || config.mapping.saturation > 1) {
        errors.push('StyleMap config: saturation must be between 0 and 1');
      }

      if (config.mapping.brightness < 0 || config.mapping.brightness > 1) {
        errors.push('StyleMap config: brightness must be between 0 and 1');
      }
    }
  }

  // Check for missing key dependencies
  if (entity.styleMapConfig && (!entity.keyColumn || !entity.valueColumn)) {
    warnings.push('Style mapping configuration requires both keyColumn and valueColumn to be set');
  }

  if (entity.filterRules && entity.filterRules.length > 0 && !entity.keyColumn) {
    warnings.push('Filter rules require keyColumn to be set');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Create a new StyleMap entity with default values
 */
export function createStyleMapEntity(
  nodeId: TreeNodeId,
  data: StyleMapCreationData = {}
): StyleMapEntity {
  const now = Date.now();

  return {
    nodeId,
    filename: data.filename || 'Untitled.csv',
    cacheKey: undefined,
    downloadUrl: data.downloadUrl,
    tableMetadataId: undefined,
    keyColumn: data.keyColumn,
    valueColumn: data.valueColumn,
    filterRules: data.filterRules || [],
    styleMapConfig: data.styleMapConfig,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

/**
 * Create a working copy from an existing StyleMap entity
 */
export function createStyleMapWorkingCopy(
  entity: StyleMapEntity,
  workingCopyId: string
): StyleMapWorkingCopy {
  const now = Date.now();

  return {
    workingCopyId,
    nodeId: entity.nodeId,
    workingCopyOf: entity.nodeId,
    copiedAt: now,
    isDirty: false,

    // Copy all entity fields
    filename: entity.filename,
    cacheKey: entity.cacheKey,
    downloadUrl: entity.downloadUrl,
    tableMetadataId: entity.tableMetadataId,
    keyColumn: entity.keyColumn,
    valueColumn: entity.valueColumn,
    filterRules: entity.filterRules ? [...entity.filterRules] : undefined,
    styleMapConfig: entity.styleMapConfig ? { ...entity.styleMapConfig } : undefined,

    createdAt: entity.createdAt,
    updatedAt: now,
    version: entity.version,
  };
}
