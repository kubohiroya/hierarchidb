import type { NodeId, StepValidation } from '@hierarchidb/common-types';

export type StepComponent = (...args: unknown[]) => unknown;

export interface NodeDialogStepDefinition {
  stepNumber: number;
  title: string;
  component: StepComponent;
  validation?: StepValidation;
  dependsOn?: number[];
  isOptional?: boolean;
  canSkip?: boolean;
}

export interface ValidationExtension {
  //  :
  extendedRules: {
    [ruleName: string]: {
      validate: (value: any) => boolean | Promise<boolean>;
      message: string;
    };
  };
  chainMode?: 'all' | 'stopOnFirst';
  mergeStrategy?: 'override' | 'append' | 'prepend';
}

export interface BaseEntityExtension<_TBase = any, TExtended = any> {
  getExtendedData: (nodeId: NodeId) => Promise<Partial<TExtended>>;
  saveExtendedData: (nodeId: NodeId, data: Partial<TExtended>) => Promise<void>;
  beforeExtend?: (nodeId: NodeId) => Promise<void>;
  afterExtend?: (nodeId: NodeId) => Promise<void>;
}

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
      component: any;
    }>;
  };
  fields: {
    inherited: string[];
    extended: string[];
  };
  handlers: {
    base: any;
    extended: any;
  };
  validation: {
    base: any;
    extended: any;
  };
  lifecycle: {
    beforeCreate?: () => Promise<void>;
    afterCreate?: () => Promise<void>;
    beforeUpdate?: () => Promise<void>;
    afterUpdate?: () => Promise<void>;
  };
}
