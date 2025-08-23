/**
 * Enhanced validation system with builder pattern and async capabilities
 */

import { 
  CreateBaseMapData, 
  UpdateBaseMapData
} from './types';
import {
  VALIDATION_LIMITS,
  ERROR_CODES,
  WARNING_CODES
} from './constants';
import {
  isCoordinatePair
} from './typeGuards';

/**
 * Validation severity levels
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Validation error interface
 */
export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  severity: ValidationSeverity;
  details?: Record<string, unknown>;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Custom validation function type
 */
export type CustomValidationFunction<T> = (value: T) => ValidationError | null;

/**
 * Simple validation for CreateBaseMapData
 */
export function validateCreateBaseMapDataStrict(data: CreateBaseMapData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Name validation
  if (!data.name || typeof data.name !== 'string') {
    errors.push({
      code: ERROR_CODES.MISSING_REQUIRED_FIELD,
      message: 'BaseMap name is required',
      field: 'name',
      severity: 'error'
    });
  } else if (data.name.length < VALIDATION_LIMITS.NAME_MIN_LENGTH) {
    errors.push({
      code: ERROR_CODES.INVALID_NAME,
      message: `Name must be at least ${VALIDATION_LIMITS.NAME_MIN_LENGTH} characters`,
      field: 'name',
      severity: 'error'
    });
  } else if (data.name.length > VALIDATION_LIMITS.NAME_MAX_LENGTH) {
    errors.push({
      code: ERROR_CODES.INVALID_NAME,
      message: `Name must not exceed ${VALIDATION_LIMITS.NAME_MAX_LENGTH} characters`,
      field: 'name',
      severity: 'error'
    });
  }

  // Center validation
  if (!data.center || !isCoordinatePair(data.center)) {
    errors.push({
      code: ERROR_CODES.INVALID_CENTER,
      message: 'Valid center coordinates [longitude, latitude] are required',
      field: 'center',
      severity: 'error'
    });
  }

  // Zoom validation
  if (typeof data.zoom !== 'number' || data.zoom < 0 || data.zoom > 22) {
    errors.push({
      code: ERROR_CODES.INVALID_ZOOM,
      message: 'Zoom level must be between 0 and 22',
      field: 'zoom',
      severity: 'error'
    });
  }

  // Custom style validation
  if (data.mapStyle === 'custom') {
    if (!data.styleUrl && !data.styleConfig) {
      errors.push({
        code: ERROR_CODES.INVALID_STYLE_CONFIG,
        message: 'Custom style requires either styleUrl or styleConfig',
        field: 'mapStyle',
        severity: 'error'
      });
    }
    
    if (data.styleUrl && data.styleConfig) {
      warnings.push({
        code: WARNING_CODES.DEPRECATED_STYLE,
        message: 'Both styleUrl and styleConfig provided. styleConfig will be ignored.',
        field: 'mapStyle',
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

/**
 * Simple validation for UpdateBaseMapData
 */
export function validateUpdateBaseMapDataStrict(data: UpdateBaseMapData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Name validation (if provided)
  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || data.name.length < VALIDATION_LIMITS.NAME_MIN_LENGTH) {
      errors.push({
        code: ERROR_CODES.INVALID_NAME,
        message: `Name must be at least ${VALIDATION_LIMITS.NAME_MIN_LENGTH} characters`,
        field: 'name',
        severity: 'error'
      });
    } else if (data.name.length > VALIDATION_LIMITS.NAME_MAX_LENGTH) {
      errors.push({
        code: ERROR_CODES.INVALID_NAME,
        message: `Name must not exceed ${VALIDATION_LIMITS.NAME_MAX_LENGTH} characters`,
        field: 'name',
        severity: 'error'
      });
    }
  }

  // Center validation (if provided)
  if (data.center !== undefined && !isCoordinatePair(data.center)) {
    errors.push({
      code: ERROR_CODES.INVALID_CENTER,
      message: 'Invalid center coordinates [longitude, latitude]',
      field: 'center',
      severity: 'error'
    });
  }

  // Zoom validation (if provided)
  if (data.zoom !== undefined && (typeof data.zoom !== 'number' || data.zoom < 0 || data.zoom > 22)) {
    errors.push({
      code: ERROR_CODES.INVALID_ZOOM,
      message: 'Zoom level must be between 0 and 22',
      field: 'zoom',
      severity: 'error'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validation builder class (simplified version)
 */
export class ValidationBuilder<T> {
  private validators: Array<(data: T) => ValidationError[]> = [];

  field(name: keyof T): FieldValidationBuilder<T> {
    return new FieldValidationBuilder<T>(this, name);
  }

  build(): (data: T) => ValidationResult {
    return (data: T) => {
      const allErrors: ValidationError[] = [];
      
      for (const validator of this.validators) {
        allErrors.push(...validator(data));
      }

      return {
        isValid: allErrors.length === 0,
        errors: allErrors.filter(e => e.severity === 'error'),
        warnings: allErrors.filter(e => e.severity === 'warning')
      };
    };
  }

  addValidator(validator: (data: T) => ValidationError[]): void {
    this.validators.push(validator);
  }
}

/**
 * Field validation builder
 */
export class FieldValidationBuilder<T> {
  constructor(
    private parent: ValidationBuilder<T>,
    private fieldName: keyof T
  ) {}

  required(message: string): this {
    this.parent.addValidator((data: T) => {
      const value = data[this.fieldName];
      if (value === undefined || value === null || value === '') {
        return [{
          code: ERROR_CODES.MISSING_REQUIRED_FIELD,
          message,
          field: String(this.fieldName),
          severity: 'error' as ValidationSeverity
        }];
      }
      return [];
    });
    return this;
  }

  string(minLength?: number, maxLength?: number): this {
    this.parent.addValidator((data: T) => {
      const value = data[this.fieldName];
      if (value !== undefined && typeof value === 'string') {
        const errors: ValidationError[] = [];
        if (minLength !== undefined && value.length < minLength) {
          errors.push({
            code: ERROR_CODES.INVALID_NAME,
            message: `Must be at least ${minLength} characters`,
            field: String(this.fieldName),
            severity: 'error'
          });
        }
        if (maxLength !== undefined && value.length > maxLength) {
          errors.push({
            code: ERROR_CODES.INVALID_NAME,
            message: `Must not exceed ${maxLength} characters`,
            field: String(this.fieldName),
            severity: 'error'
          });
        }
        return errors;
      }
      return [];
    });
    return this;
  }

  number(min?: number, max?: number): this {
    this.parent.addValidator((data: T) => {
      const value = data[this.fieldName];
      if (value !== undefined && typeof value === 'number') {
        const errors: ValidationError[] = [];
        if (min !== undefined && value < min) {
          errors.push({
            code: ERROR_CODES.INVALID_ZOOM,
            message: `Must be at least ${min}`,
            field: String(this.fieldName),
            severity: 'error'
          });
        }
        if (max !== undefined && value > max) {
          errors.push({
            code: ERROR_CODES.INVALID_ZOOM,
            message: `Must not exceed ${max}`,
            field: String(this.fieldName),
            severity: 'error'
          });
        }
        return errors;
      }
      return [];
    });
    return this;
  }

  build(): (data: T) => ValidationResult {
    return this.parent.build();
  }
}

/**
 * Async validator interface
 */
export interface AsyncValidator<T> {
  validate(data: T): Promise<ValidationResult>;
}

/**
 * BaseMap async validator for complex validations
 */
export class BaseMapAsyncValidator implements AsyncValidator<CreateBaseMapData> {
  async validate(data: CreateBaseMapData): Promise<ValidationResult> {
    // Perform basic synchronous validation first
    const syncResult = validateCreateBaseMapDataStrict(data);
    
    // Add any async validations here (e.g., external API calls)
    // For now, just return the sync result
    return syncResult;
  }
}

/**
 * Performance validation function
 */
export function validatePerformance(data: CreateBaseMapData): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Add performance-related validations here
  if (data.zoom > 18) {
    errors.push({
      code: WARNING_CODES.PERFORMANCE_WARNING,
      message: 'High zoom levels may impact performance',
      field: 'zoom',
      severity: 'warning'
    });
  }
  
  return errors;
}