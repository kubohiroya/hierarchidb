/**
 * 型安全なバリデーション システム
 * 
 * この実装では以下のアプローチで型安全性を強化します:
 * 1. Branded Types - IDやキーの混同を防ぐ
 * 2. Strict Type Guards - ランタイムでの型安全性
 * 3. Schema Validation - Zodライクなバリデーション
 * 4. Error Types - エラーハンドリングの型安全性
 * 5. Async Validation - 非同期バリデーション対応
 */

import type { NodeId, EntityId } from '@hierarchidb/00-core';
import type {
  ProjectEntity,
  CreateProjectData,
  MapConfiguration,
  RenderConfiguration,
  LayerConfiguration,
  LayerType,
  ValidationError,
  ValidationResult
} from './types';

// ===================
// 1. Branded Types for Enhanced Type Safety
// ===================

/**
 * Layer ID - 他の文字列と区別するためのブランデッド型
 */
export type LayerId = string & { readonly __brand: 'LayerId' };

/**
 * Aggregation ID - アグリゲーション処理の一意識別子
 */
export type AggregationId = string & { readonly __brand: 'AggregationId' };

/**
 * Export ID - エクスポート設定の一意識別子
 */
export type ExportId = string & { readonly __brand: 'ExportId' };

/**
 * Helper functions for branded types
 */
export const LayerId = {
  create: (value: string): LayerId => value as LayerId,
  isValid: (value: string): value is LayerId => Boolean(value && value.length > 0)
};

export const AggregationId = {
  create: (value: string): AggregationId => value as AggregationId,
  isValid: (value: string): value is AggregationId => Boolean(value && value.length > 0)
};

export const ExportId = {
  create: (value: string): ExportId => value as ExportId,
  isValid: (value: string): value is ExportId => Boolean(value && value.length > 0)
};

// ===================
// 2. Strict Type Guards
// ===================

/**
 * Type guard for NodeId
 */
export function isNodeId(value: unknown): value is NodeId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard for EntityId
 */
export function isEntityId(value: unknown): value is EntityId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard for LayerType
 */
export function isLayerType(value: unknown): value is LayerType {
  return typeof value === 'string' && 
    ['raster', 'vector', 'geojson', 'image', 'background'].includes(value);
}

/**
 * Type guard for MapConfiguration
 */
export function isMapConfiguration(value: unknown): value is MapConfiguration {
  if (typeof value !== 'object' || value === null) return false;
  
  const config = value as any;
  
  return Array.isArray(config.center) &&
    config.center.length === 2 &&
    typeof config.center[0] === 'number' &&
    typeof config.center[1] === 'number' &&
    typeof config.zoom === 'number' &&
    typeof config.bearing === 'number' &&
    typeof config.pitch === 'number';
}

/**
 * Type guard for RenderConfiguration
 */
export function isRenderConfiguration(value: unknown): value is RenderConfiguration {
  if (typeof value !== 'object' || value === null) return false;
  
  const config = value as any;
  
  return typeof config.maxZoom === 'number' &&
    typeof config.minZoom === 'number' &&
    typeof config.pixelRatio === 'number' &&
    typeof config.preserveDrawingBuffer === 'boolean';
}

/**
 * Type guard for LayerConfiguration
 */
export function isLayerConfiguration(value: unknown): value is LayerConfiguration {
  if (typeof value !== 'object' || value === null) return false;
  
  const config = value as any;
  
  return typeof config.layerId === 'string' &&
    isLayerType(config.layerType) &&
    typeof config.layerOrder === 'number' &&
    typeof config.isVisible === 'boolean' &&
    typeof config.opacity === 'number' &&
    config.opacity >= 0 && config.opacity <= 1 &&
    typeof config.styleConfig === 'object' &&
    typeof config.interactionConfig === 'object';
}

/**
 * Deep type guard for ProjectEntity
 */
export function isProjectEntity(value: unknown): value is ProjectEntity {
  if (typeof value !== 'object' || value === null) return false;
  
  const entity = value as any;
  
  return isEntityId(entity.id) &&
    isNodeId(entity.nodeId) &&
    typeof entity.name === 'string' &&
    entity.name.length > 0 &&
    typeof entity.description === 'string' &&
    isMapConfiguration(entity.mapConfig) &&
    isRenderConfiguration(entity.renderConfig) &&
    typeof entity.layerConfigurations === 'object' &&
    Array.isArray(entity.exportConfigurations) &&
    typeof entity.aggregationMetadata === 'object' &&
    typeof entity.createdAt === 'number' &&
    typeof entity.updatedAt === 'number' &&
    typeof entity.version === 'number';
}

// ===================
// 3. Schema Validation System
// ===================

/**
 * Validation rule interface
 */
/*
export interface ValidationRule<T> {
  field: keyof T;
  validate: (value: T[keyof T], data: T) => ValidationError | null;
}

export type Severity = "error" | "warning";

export type ValidationError = {
  field: string;
  message: string;
  severity: Severity;
};

export type ValidationResult = {
  isValid: boolean;
  errors: ValidationError[];
};
 */

type FieldRuleBuilder<T, K extends keyof T> = {
  required(message?: string): FieldRuleBuilder<T, K>;
  string(): FieldRuleBuilder<T, K>;
  number(): FieldRuleBuilder<T, K>;
  min(minValue: number): FieldRuleBuilder<T, K>;
  max(maxValue: number): FieldRuleBuilder<T, K>;
  custom(validator: (value: T[K], data: T) => ValidationError | null): FieldRuleBuilder<T, K>;
  done(): ValidationBuilder<T>; // 親に戻る
};

export type ValidationRule<T, K extends keyof T = keyof T> = {
  field: K;
  validate: (value: T[K], data: T) => ValidationError | null;
};

export class ValidationBuilder<T> {
  private rules: ValidationRule<T>[] = [];

  field<K extends keyof T>(field: K): FieldRuleBuilder<T, K> {
    const parent = this;

    const api: FieldRuleBuilder<T, K> = {
      required(message = `${String(field)} is required`) {
        parent.rules.push({
          field,
          validate: (value: T[K]) => {
            if (value === undefined || value === null || (value as unknown) === "") {
              return { field: String(field), message, severity: "error" };
            }
            return null;
          },
        });
        return api;
      },

      string() {
        parent.rules.push({
          field,
          validate: (value: T[K]) => {
            if (value !== undefined && typeof value !== "string") {
              return {
                field: String(field),
                message: `${String(field)} must be a string`,
                severity: "error",
              };
            }
            return null;
          },
        });
        return api;
      },

      number() {
        parent.rules.push({
          field,
          validate: (value: T[K]) => {
            if (value !== undefined && typeof value !== "number") {
              return {
                field: String(field),
                message: `${String(field)} must be a number`,
                severity: "error",
              };
            }
            return null;
          },
        });
        return api;
      },

      min(minValue: number) {
        parent.rules.push({
          field,
          validate: (value: T[K]) => {
            if (typeof value === "number" && value < minValue) {
              return {
                field: String(field),
                message: `${String(field)} must be at least ${minValue}`,
                severity: "error",
              };
            }
            return null;
          },
        });
        return api;
      },

      max(maxValue: number) {
        parent.rules.push({
          field,
          validate: (value: T[K]) => {
            if (typeof value === "number" && value > maxValue) {
              return {
                field: String(field),
                message: `${String(field)} must be at most ${maxValue}`,
                severity: "error",
              };
            }
            return null;
          },
        });
        return api;
      },

      custom(validator: (value: T[K], data: T) => ValidationError | null) {
        parent.rules.push({
          field,
          validate: validator,
        });
        return api;
      },

      done() {
        return parent;
      },
    };

    return api;
  }

  build(): (data: T) => ValidationResult {
    return (data: T): ValidationResult => {
      const errors: ValidationError[] = [];

      for (const rule of this.rules) {
        const error = rule.validate(data[rule.field], data);
        if (error) errors.push(error);
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    };
  }
}

// ===================
// 4. Specific Validators
// ===================

/**
 * CreateProjectData validator
 */
export const validateCreateProjectData = new ValidationBuilder<CreateProjectData>()
  .field('name')
    .required('Project name is required')
    .string()
    .custom((value) => {
      if (typeof value === 'string' && value.trim().length === 0) {
        return { field: 'name', message: 'Project name cannot be empty', severity: 'error' };
      }
      if (typeof value === 'string' && value.length > 255) {
        return { field: 'name', message: 'Project name cannot exceed 255 characters', severity: 'error' };
      }
      return null;
    }).done()
  .field('description')
    .string()
    .custom((value) => {
      if (typeof value === 'string' && value.length > 1000) {
        return { field: 'description', message: 'Description cannot exceed 1000 characters', severity: 'warning' };
      }
      return null;
    }).done()
  .build();

/**
 * MapConfiguration validator
 */
export const validateMapConfigurationStrict = new ValidationBuilder<MapConfiguration>()
  .field('center')
    .required('Map center is required')
    .custom((center) => {
      if (!Array.isArray(center) || center.length !== 2) {
        return { field: 'center', message: 'Center must be an array of [lng, lat]', severity: 'error' };
      }
      const [lng, lat] = center;
      if (typeof lng !== 'number' || lng < -180 || lng > 180) {
        return { field: 'center', message: 'Longitude must be between -180 and 180', severity: 'error' };
      }
      if (typeof lat !== 'number' || lat < -90 || lat > 90) {
        return { field: 'center', message: 'Latitude must be between -90 and 90', severity: 'error' };
      }
      return null;
    }).done()
  .field('zoom')
    .required('Zoom level is required')
    .number()
    .min(0)
    .max(24).done()
  .field('bearing')
    .required('Bearing is required')
    .number()
    .min(0)
    .max(359).done()
  .field('pitch')
    .required('Pitch is required')
    .number()
    .min(0)
    .max(60).done()
  .build();

/**
 * LayerConfiguration validator
 */
export const validateLayerConfigurationStrict = new ValidationBuilder<LayerConfiguration>()
  .field('layerId')
    .required('Layer ID is required')
    .string()
    .custom((layerId) => {
      if (typeof layerId === 'string' && !LayerId.isValid(layerId)) {
        return { field: 'layerId', message: 'Invalid layer ID format', severity: 'error' };
      }
      return null;
    }).done()
  .field('layerType')
    .required('Layer type is required')
    .custom((layerType) => {
      if (!isLayerType(layerType)) {
        return { field: 'layerType', message: 'Invalid layer type', severity: 'error' };
      }
      return null;
    }).done()
  .field('layerOrder')
    .required('Layer order is required')
    .number()
    .min(0).done()
  .field('isVisible')
    .required('Visibility is required')
    .custom((isVisible) => {
      if (typeof isVisible !== 'boolean') {
        return { field: 'isVisible', message: 'Visibility must be boolean', severity: 'error' };
      }
      return null;
    }).done()
  .field('opacity')
    .required('Opacity is required')
    .number()
    .min(0)
    .max(1).done()
  .build();

// ===================
// 5. Async Validation System
// ===================

/**
 * Async validation result
 */
export interface AsyncValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Async validator interface
 */
export interface AsyncValidator<T> {
  validate(data: T): Promise<AsyncValidationResult>;
}

/**
 * Project-specific async validator
 */
export class ProjectAsyncValidator implements AsyncValidator<CreateProjectData> {
  constructor(
    private checkProjectNameExists: (name: string) => Promise<boolean>,
    private validateResourceReferences: (refs: NodeId[]) => Promise<{ valid: NodeId[]; invalid: NodeId[] }>
  ) {}

  async validate(data: CreateProjectData): Promise<AsyncValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Check if project name already exists
    if (data.name && await this.checkProjectNameExists(data.name)) {
      errors.push({
        field: 'name',
        message: 'A project with this name already exists',
        severity: 'error'
      });
    }

    // Validate resource references if provided
    if (data.initialReferences && data.initialReferences.length > 0) {
      const { invalid } = await this.validateResourceReferences(data.initialReferences);
      
      if (invalid.length > 0) {
        warnings.push({
          field: 'initialReferences',
          message: `${invalid.length} resource(s) are not accessible: ${invalid.join(', ')}`,
          severity: 'warning'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// ===================
// 6. Error Type System
// ===================

/**
 * Validation error types for better error handling
 */
export abstract class ProjectValidationError extends Error {
  abstract readonly code: string;
  abstract readonly field?: string;
  
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ProjectNameValidationError extends ProjectValidationError {
  readonly code = 'PROJECT_NAME_INVALID';
  readonly field = 'name';
}

export class ProjectDataValidationError extends ProjectValidationError {
  readonly code = 'PROJECT_DATA_INVALID';
  
  constructor(
    message: string,
    public readonly field: string,
    public readonly validationErrors: ValidationError[]
  ) {
    super(message);
  }
}

export class ProjectResourceValidationError extends ProjectValidationError {
  readonly code = 'PROJECT_RESOURCE_INVALID';
  readonly field = 'initialReferences';
  
  constructor(
    message: string,
    public readonly invalidResources: NodeId[]
  ) {
    super(message);
  }
}

// ===================
// 7. Validation Utilities
// ===================

/**
 * Assert function for type narrowing
 */
export function assertProjectEntity(value: unknown): asserts value is ProjectEntity {
  if (!isProjectEntity(value)) {
    throw new ProjectDataValidationError(
      'Invalid project entity data',
      'entity',
      [{ field: 'entity', message: 'Data does not match ProjectEntity structure', severity: 'error' }]
    );
  }
}

/**
 * Safe parser with validation
 */
export function parseProjectData(data: unknown): CreateProjectData {
  const validation = validateCreateProjectData(data as CreateProjectData);
  
  if (!validation.isValid) {
    throw new ProjectDataValidationError(
      'Invalid project data',
      'data',
      validation.errors
    );
  }
  
  return data as CreateProjectData;
}

/**
 * Validation result helper
 */
export function hasValidationErrors(result: ValidationResult | AsyncValidationResult): boolean {
  return !result.isValid || result.errors.length > 0;
}

export function getValidationErrorMessage(result: ValidationResult | AsyncValidationResult): string {
  if (result.errors.length === 0) return '';
  
  const errorMessages = result.errors
    .filter(err => err.severity === 'error')
    .map(err => err.message);
    
  return errorMessages.join('; ');
}

/**
 * Combined validation pipeline
 */
export async function validateProjectDataComplete(
  data: CreateProjectData,
  asyncValidator?: ProjectAsyncValidator
): Promise<{
  isValid: boolean;
  syncResult: ValidationResult;
  asyncResult?: AsyncValidationResult;
}> {
  // Sync validation first
  const syncResult = validateCreateProjectData(data);
  
  // If sync validation fails, don't proceed with async
  if (!syncResult.isValid) {
    return { isValid: false, syncResult };
  }
  
  // Async validation if validator provided
  let asyncResult: AsyncValidationResult | undefined;
  if (asyncValidator) {
    asyncResult = await asyncValidator.validate(data);
  }
  
  const isValid = syncResult.isValid && (asyncResult?.isValid ?? true);
  
  return { isValid, syncResult, asyncResult };
}