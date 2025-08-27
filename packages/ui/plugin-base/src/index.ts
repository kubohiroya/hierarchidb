/**
 * @file index.ts
 * @description Base UI components and utilities for HierarchiDB plugins
 */

// UI Components
export { MultiStepDialog } from './components/MultiStepDialog';
export type { MultiStepDialogProps } from './components/MultiStepDialog';

export { WizardProvider, useWizard } from './components/StepWizardContext';
export type { 
  WizardState, 
  WizardAction, 
  WizardContextValue, 
  StepState, 
  WizardProviderProps 
} from './components/StepWizardContext';

// Hooks
export { useMultiStepDialog } from './hooks/useMultiStepDialog';

// Services
export { DialogStepRegistry } from './services/DialogStepRegistry';

// Plugin extension types that need to be available to plugins
// These are defined locally since they're not yet exported from common-core
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface DialogStepDefinition {
  stepNumber: number;
  title: string;
  component: any; // React component
  validation?: {
    validate: (data: any) => Promise<{ isValid: boolean; errors: string[] }> | { isValid: boolean; errors: string[] };
  };
  dependsOn?: number[];
  canSkip?: boolean;
}

export interface StepComponent {
  data: any;
  onNext: (data: any) => void;
  onPrevious: () => void;
  errors: string[];
  isLoading: boolean;
}

export interface ExtendedFieldDefinition {
  name: string;
  type: string;
  required?: boolean;
  label?: string;
  description?: string;
  validation?: {
    pattern?: RegExp;
    maxLength?: number;
    minLength?: number;
    min?: number;
    max?: number;
  };
}

// Extension system types
export interface ValidationExtension {
  validate: (data: any) => Promise<ValidationResult> | ValidationResult;
}

export interface BaseEntityExtension<TEntity> {
  beforeCreate?: (data: Partial<TEntity>) => Promise<Partial<TEntity>> | Partial<TEntity>;
  afterCreate?: (entity: TEntity) => Promise<void> | void;
  beforeUpdate?: (entity: TEntity, updates: Partial<TEntity>) => Promise<Partial<TEntity>> | Partial<TEntity>;
  afterUpdate?: (entity: TEntity) => Promise<void> | void;
  beforeDelete?: (entity: TEntity) => Promise<void> | void;
  afterDelete?: (entityId: string) => Promise<void> | void;
}

export interface ExtensionMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
}

export interface PluginExtensionConfig {
  dialog?: {
    createSteps?: DialogStepDefinition[];
    editSteps?: DialogStepDefinition[];
  };
  validation?: ValidationExtension;
  entity?: BaseEntityExtension<any>;
  metadata: ExtensionMetadata;
}

export interface ExtendableNodeTypeDefinition {
  nodeType: string;
  baseDefinition: any;
  extensions?: PluginExtensionConfig[];
}

export interface StepValidation<TData = any> {
  validate(data: TData): Promise<ValidationResult> | ValidationResult;
}