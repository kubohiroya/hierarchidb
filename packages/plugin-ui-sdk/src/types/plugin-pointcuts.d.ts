import type { PeerEntity, NodeId, StepValidation } from '@hierarchidb/common-types';
export type StepComponent = (...args: unknown[]) => unknown;
export interface DialogStepDefinition {
    stepNumber: number;
    title: string;
    component: StepComponent;
    validation?: StepValidation;
    dependsOn?: number[];
    isOptional?: boolean;
    canSkip?: boolean;
}
/**
 * @deprecated Unused across the repository; scheduled for removal.
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
  * :
 * :
 * : name, description
 * :
  */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface BaseNodeDefinition<_TEntity = any> {
    baseFields: string[];
    baseValidation: {
        namePattern?: RegExp;
        nameMaxLength?: number;
        descriptionMaxLength?: number;
        required?: string[];
        [key: string]: any;
    };
    baseDialog: any;
    extendedFields?: ExtendedFieldDefinition[];
    extendedSteps?: DialogStepDefinition[];
    extendedValidation?: ValidationExtension;
}
/**
  * :
 * :
 * : fileFormat, columnSelection
 * :
  */
export interface ValidationExtension {
    extendedRules: {
        [ruleName: string]: {
            validate: (value: any) => boolean | Promise<boolean>;
            message: string;
        };
    };
    chainMode?: 'all' | 'stopOnFirst';
    mergeStrategy?: 'override' | 'append' | 'prepend';
}
/**
  * :
 * :
 * :
 * :
  */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface ExtensionMetadata {
    extends: string;
    version: string;
    compatibleWith: {
        [pluginName: string]: string;
    };
    inheritanceChain: string[];
    mergedSteps: Array<{
        from: string;
        stepNumber: number;
    }>;
    mergedFields: Array<{
        from: string;
        fields: string[];
    }>;
}
/**
  * :
 * :
 * : getExtendedData, saveExtendedData
 * :
  */
export interface BaseEntityExtension<_TBase = any, TExtended = any> {
    getExtendedData: (nodeId: NodeId) => Promise<Partial<TExtended>>;
    saveExtendedData: (nodeId: NodeId, data: Partial<TExtended>) => Promise<void>;
    beforeExtend?: (nodeId: NodeId) => Promise<void>;
    afterExtend?: (nodeId: NodeId) => Promise<void>;
}
/**
  * :
 * :
 * :
 * :
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
/**
  * :
 * :
 * : folder-pluginstyler
 * :
  */
export interface ExtendingNodeTypeDefinition<_TBase extends PeerEntity = any, _TExtended = any, _TWorkingCopy = any> {
    extends: string;
    nodeType: string;
    name: string;
    displayName: string;
    extendedSteps?: DialogStepDefinition[];
    extendedFields?: ExtendedFieldDefinition[];
    extendedValidation?: ValidationExtension;
    baseDefinition?: ExtendingNodeTypeDefinition<_TBase, never, any>;
    stepExtensions?: any[];
}
//# sourceMappingURL=plugin-pointcuts.d.ts.map