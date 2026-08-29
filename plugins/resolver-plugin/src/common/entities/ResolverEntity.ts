import type { PeerEntity } from '@hierarchidb/core-types';
import type { ResolverStyleBinding } from '@hierarchidb/resolver-store';
import type { DialogUIState, TreeNodeUpdaterPayload } from '@hierarchidb/tree-api';

export interface PropertyMappingRule {
  id: string;
  sourceProperty: string;
  targetProperty: string;
  transformFunction?: string;
  isRequired: boolean;
  defaultValue?: unknown;
  description?: string;
}

export interface ValidationRule {
  id: string;
  property: string;
  ruleType: 'required' | 'type' | 'range' | 'pattern' | 'custom';
  parameters: Record<string, unknown>;
  errorMessage?: string;
}

export interface DuplicateResolutionStrategy {
  strategy: 'ignore' | 'overwrite' | 'merge' | 'skip' | 'custom';
  customFunction?: string;
  mergeProperties?: string[];
}

export interface DataTransformation {
  id: string;
  property: string;
  transformationType: 'format' | 'calculate' | 'lookup' | 'custom';
  parameters: Record<string, unknown>;
  transformFunction?: string;
}

export interface PreviewConfig {
  sampleSize: number;
  refreshInterval: number;
  highlightMappings: boolean;
  showValidationErrors: boolean;
}

export interface SchemaInfo {
  name: string;
  properties: PropertyInfo[];
  sampleData?: Record<string, unknown>[];
}

export interface PropertyInfo {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  required: boolean;
  example?: unknown;
  description?: string;
  exampleValues?: unknown[];
}

export interface MappingValidationResult {
  isValid: boolean;
  errors: Array<{ property: string; message: string; suggestion?: string }>;
  warnings?: Array<{ property: string; message: string; suggestion?: string }>;
  coverage?: number;
}

export type ResolverEntityPayload = {
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
  lastValidation?: MappingValidationResult | null;
  styleBindings?: readonly ResolverStyleBinding[];
};

export type ResolverEntity = PeerEntity<ResolverEntityPayload>;

export interface MappingPreviewResult {
  success?: boolean;
  errors?: Array<{ property: string; message: string; suggestion?: string }>;
  warnings?: ValidationWarning[];
  unmappedProperties?: string[];
  mappedData?: Record<string, unknown>[];
  statistics?: {
    totalRecords: number;
    successfulMappings: number;
    failedMappings: number;
    duplicatesFound?: number;
    duplicatesResolved?: number;
    coverage?: number;
  };
  coverage?: number;
}

export interface ValidationWarning {
  property: string;
  message: string;
  suggestion?: string;
}

export interface ResolverPeerData {
  schemaVersion: 1;
  lastExecutedAt?: number;
  metadata?: Record<string, unknown>;
}

export interface StylerIntegration {
  styleId?: string;
}

export type ResolverUpdaterPayload = TreeNodeUpdaterPayload<ResolverEntity> & {
  dialogUIState: DialogUIState;
  lastValidation?: MappingValidationResult | null;
};
