import type { NodeId, PeerEntity } from '@hierarchidb/common-types';

/**
 * Resolver entity represents a property mapping configuration
 */
export interface ResolverEntity extends PeerEntity {
  name: string;
  description?: string;
  sourceSchema: SchemaInfo | null;
  targetSchema: SchemaInfo | null;
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
 * Working copy types for Resolver
 */
export type ResolverDraftPayload = Partial<ResolverEntity>;

export type ResolverDraftEntity = Partial<ResolverEntity> & {
    originalId?: NodeId;
    isDirty?: boolean;
    draftId?: NodeId;
    tags?: string[];
    sourceSchema: SchemaInfo | null;
    targetSchema: SchemaInfo | null;
  };

export type ResolverDraft = ResolverDraftEntity;

/**
 * Peer payload persisted for resolver nodes.
 */
export interface ResolverPeerData {
  schemaVersion: 1;
  lastExecutedAt?: number;
  metadata?: Record<string, unknown>;
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
 * @deprecated Use MappingValidationResult instead
 */
export interface _MappingValidationResult {
  isValid: boolean;
  errors: _ValidationError[];
  warnings: _ValidationWarning[];
  coverage: number; // Percentage of properties mapped
}

/**
 * Validation error details (current)
 */
export interface ValidationError {
  ruleId: string;
  property: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validation warning details (current)
 */
export interface ValidationWarning {
  property: string;
  message: string;
  suggestion?: string;
}

/**
 * Mapping validation result (current)
 */
export interface MappingValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  coverage: number; // Percentage of properties mapped
}

/**
 * Validation error details
 * @deprecated Use ValidationWarning instead
 */
export interface _ValidationError {
  ruleId: string;
  property: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validation warning details
 * @deprecated Use ValidationError instead
 */
export interface _ValidationWarning {
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
 * Styler integration configuration
 */
export interface StylerIntegration {
  enabled: boolean;
  stylerNodeId?: NodeId;
  propertyMappings: Record<string, string>; // source property -> style property
}

export type ResolverDraftTypes = ResolverDraftEntity;
