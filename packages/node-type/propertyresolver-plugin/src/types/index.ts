import type { NodeId, EntityId, PeerEntity } from '@hierarchidb/common-type';

/**
 * PropertyResolver entity represents a property mapping configuration
 */
export interface PropertyResolverEntity extends PeerEntity {
  name: string;
  description?: string;
  sourceSchema: string;
  targetSchema: string;
  mappingRules: PropertyMappingRule[];
  validationRules: ValidationRule[];
  duplicateResolution: DuplicateResolutionStrategy;
  dataTransformations: DataTransformation[];
  previewConfig?: PreviewConfig;
  isCompiled?: boolean;
  lastCompiled?: number;
  compiledFunction?: string;
  compiledMetadata?: Record<string, unknown>;
}

/**
 * Property mapping rule defines how source properties map to target properties
 */
export interface PropertyMappingRule {
  id: string;
  sourceProperty: string;
  targetProperty: string;
  transformFunction?: string;
  isRequired: boolean;
  defaultValue?: unknown;
  description?: string;
}

/**
 * Validation rule for property mapping
 */
export interface ValidationRule {
  id: string;
  property: string;
  ruleType: 'required' | 'type' | 'range' | 'pattern' | 'custom';
  parameters: Record<string, unknown>;
  errorMessage?: string;
}

/**
 * Duplicate resolution strategy configuration
 */
export interface DuplicateResolutionStrategy {
  strategy: 'ignore' | 'overwrite' | 'merge' | 'skip' | 'custom';
  customFunction?: string;
  mergeProperties?: string[];
}

/**
 * Data transformation configuration
 */
export interface DataTransformation {
  id: string;
  property: string;
  transformationType: 'format' | 'calculate' | 'lookup' | 'custom';
  parameters: Record<string, unknown>;
  transformFunction?: string;
}

/**
 * Preview configuration for real-time mapping preview
 */
export interface PreviewConfig {
  sampleSize: number;
  refreshInterval: number;
  highlightMappings: boolean;
  showValidationErrors: boolean;
}

/**
 * Working copy types for PropertyResolver
 */
export interface PropertyResolverWorkingCopyEntity extends PropertyResolverEntity {
  /** Working copy specific fields from WorkingCopy interface */
  workingCopyId?: EntityId;
  originalId: EntityId;
  isDirty: boolean;
  
  /** Fields that have been modified */
  modifiedFields: string[];
}

/**
 * Schema information for property mapping
 */
export interface SchemaInfo {
  name: string;
  properties: PropertyInfo[];
  sampleData?: Record<string, unknown>[];
}

/**
 * Property information within a schema
 */
export interface PropertyInfo {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  required: boolean;
  description?: string;
  exampleValues?: unknown[];
}

/**
 * Mapping validation result
 */
export interface MappingValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  coverage: number; // Percentage of properties mapped
}

/**
 * Validation error details
 */
export interface ValidationError {
  ruleId: string;
  property: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validation warning details
 */
export interface ValidationWarning {
  property: string;
  message: string;
  suggestion?: string;
}

/**
 * Property mapping preview result
 */
export interface MappingPreviewResult {
  success: boolean;
  mappedData: Record<string, unknown>[];
  unmappedProperties: string[];
  errors: string[];
  statistics: {
    totalRecords: number;
    successfulMappings: number;
    failedMappings: number;
    duplicatesFound: number;
    duplicatesResolved: number;
  };
}

/**
 * StyleMap integration configuration
 */
export interface StyleMapIntegration {
  enabled: boolean;
  styleMapNodeId?: NodeId;
  propertyMappings: Record<string, string>; // source property -> style property
}

export type PropertyResolverWorkingCopyTypes = PropertyResolverWorkingCopyEntity;
export type PropertyResolverWorkingCopy = PropertyResolverWorkingCopyEntity;