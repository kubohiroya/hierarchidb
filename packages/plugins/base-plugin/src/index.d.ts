/**
 * @file index.ts
 * @description Base plugin for inheritance - not displayed in UI
 */
export { BaseEntityHandler } from './handlers/BaseEntityHandler.js';
export { HierarchicalEntityHandler } from './handlers/HierarchicalEntityHandler.js';
export type { HierarchicalEntity, HierarchicalSearchCriteria, TreeNode } from './handlers/HierarchicalEntityHandler.js';
export type { BaseSearchCriteria, PaginatedResult, EntityLifecycleHooks, OperationResult, } from './types.js';
export { NodeDialogExtensionRegistry, nodeDialogExtensionRegistry, dialogExtensionRegistry, } from './dialog/NodeDialogExtensionAPI.js';
export type { NodeDialogExtension, NodeDialogExtensionMetadata, NodeDialogHooks, StepArrayEvaluator, } from './dialog/NodeDialogExtensionAPI.js';
export { wrapDialogStepComponent } from './dialog/wrapDialogStepComponent.js';
export * from './dialog/DialogStateChannel.js';
export * from './dialog/NodeDialogPlugin.js';
export { BaseDialogPlugin } from './dialog/BaseDialogPlugin.js';
export declare const BasePluginDefinition: {
    nodeType: string;
    name: string;
    displayName: string;
    description: string;
    visibility: {
        showInCreateMenu: boolean;
        showInPluginList: boolean;
    };
};
export declare class RuntimeWiring {
}
//# sourceMappingURL=index.d.ts.map