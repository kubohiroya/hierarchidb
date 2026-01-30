import type { NodeId, PeerEntity, StepValidation } from '@hierarchidb/common-types';

/**
 * Generic step component signature. Concrete implementations can be framework-specific.
 */
export type StepComponent = (...args: unknown[]) => unknown;

/**
 * Definition of a dialog step contributed by a plugin.
 */
export interface NodeDialogStepDefinition {
  stepNumber: number;
  title: string;
  component: StepComponent;
  validation?: StepValidation;
  dependsOn?: number[];
  isOptional?: boolean;
  canSkip?: boolean;
}

/**
 * Declarative validation extension for dialog steps.
 */
export interface ValidationExtension {
  extendedRules: {
    [ruleName: string]: {
      validate: (value: unknown) => boolean | Promise<boolean>;
      message: string;
    };
  };
  chainMode?: 'all' | 'stopOnFirst';
  mergeStrategy?: 'override' | 'append' | 'prepend';
}

/**
 * Entity-level extension contract used by plugin console.
 */
export interface BaseEntityExtension<_TBase = unknown, TExtended = unknown> {
  getExtendedData: (nodeId: NodeId) => Promise<Partial<TExtended>>;
  saveExtendedData: (nodeId: NodeId, data: Partial<TExtended>) => Promise<void>;
  beforeExtend?: (nodeId: NodeId) => Promise<void>;
  afterExtend?: (nodeId: NodeId) => Promise<void>;
}

/**
 * Additional field metadata used when composing node definitions.
 */
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

/**
 * Node definition that extends another plugin's node type.
 */
export interface ExtendingNodeTypeDefinition<
  TBase extends PeerEntity = PeerEntity,
  _TExtended = unknown,
  _TDraft = unknown,
> {
  extends: string;
  nodeType: string;
  name: string;
  displayName: string;
  extendedSteps?: NodeDialogStepDefinition[];
  extendedFields?: ExtendedFieldDefinition[];
  extendedValidation?: ValidationExtension;
  baseDefinition?: ExtendingNodeTypeDefinition<TBase, never, unknown>;
  stepExtensions?: unknown[];
}

/**
 * Declarative configuration for plugin extensions.
 */
export interface PluginExtensionConfig {
  basePlugin: string;
  extendedPlugin: string;
  steps: {
    inherited: Array<{
      stepNumber: number;
      from: string;
      override?: boolean;
    }>;
    extended: Array<{
      stepNumber: number;
      title: string;
      component: unknown;
    }>;
  };
  fields: {
    inherited: string[];
    extended: string[];
  };
  handlers: {
    base: unknown;
    extended: unknown;
  };
  validation: {
    base: unknown;
    extended: unknown;
  };
  lifecycle: {
    beforeCreate?: () => Promise<void>;
    afterCreate?: () => Promise<void>;
    beforeUpdate?: () => Promise<void>;
    afterUpdate?: () => Promise<void>;
  };
}
