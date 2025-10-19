/**
 * @file RuntimeWorkerService.ts
 * @description Base plugin for inheritance - not displayed in UI
 */
export { BaseEntityHandler } from './handlers/BaseEntityHandler.js';
export { HierarchicalEntityHandler } from './handlers/HierarchicalEntityHandler.js';
export type { HierarchicalEntity, HierarchicalSearchCriteria, TreeNode } from './handlers/HierarchicalEntityHandler.js';
export { NodeDialogExtensionRegistry, nodeDialogExtensionRegistry, dialogExtensionRegistry, } from './dialog/NodeDialogExtensionAPI.js';
export type { NodeDialogExtension, NodeDialogExtensionMetadata, NodeDialogHooks, StepArrayEvaluator, } from './dialog/NodeDialogExtensionAPI.js';
export { wrapDialogStepComponent } from './dialog/wrapDialogStepComponent.js';
export * from './dialog/DialogStateChannel.js';
export * from './dialog/NodeDialogPlugin.js';
export { BaseDialogPlugin } from './dialog/BaseDialogPlugin.js';
export type { WorkingCopyBase, WorkingCopyDraft, } from './working-copy/types.js';
export { createDraftWorkingCopyBase, markWorkingCopyUpdated, } from './working-copy/helpers.js';
export type { EntityWorkingCopyAdapter } from './working-copy/adapter.js';
export { createEntityWorkingCopyAdapter } from './working-copy/adapter.js';
export type { PeerDataBase, PeerEntityBase, PeerStore, } from './peer-store/types.js';
export { createPeerStoreNormalizer } from './peer-store/normalizer.js';
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
export * from './types/package-json.js';
export * from './types/plugin-pointcuts.js';
export * from './types/plugin-definition.js';
export * from './types/plugin-metadata.js';
export * from './types/registry.js';
export * from './types/operationResult.js';
export * from './types/baseSearchCriteria.js';
export * from './types/paginatedResult.js';
export * from './types/entityLifecycleHooks.js';
export { createDownloadService, downloadWithService, } from './download.js';
export type { DownloadServiceHandle, DownloadTaskOptions, ManagedDownloadOutcome, } from './download.js';
export type { PluginLifecycleAPI, PluginRegistrationResult as PluginRegistrationResultNew, UnregistrationResult as UnregistrationResultNew, PluginValidationResult as PluginValidationResultNew, PluginHealthStatus as PluginHealthStatusNew, PluginRegistrationInfo as PluginRegistrationInfoNew, PluginListOptions as PluginListOptionsNew, PluginDependencyInfo as PluginDependencyInfoNew, BulkOperationOptions as BulkOperationOptionsNew, BulkOperationResult as BulkOperationResultNew, PluginResetOptions as PluginResetOptionsNew, PluginResetResult as PluginResetResultNew, PluginDeleteResult as PluginDeleteResultNew, } from './types/PluginLifecycleAPI.js';
export type { PluginTreeAPI, TreePluginInfo, GetPluginsForTreeRequest, GetPluginsForTreeResponse, PluginUsageStats, CompatibilityResult, OptimizationResult, DependencyGraph, PluginMetrics, TimePeriod, GraphOptions, MetricOptions, } from './types/PluginTreeAPI.js';
export type { PluginTreeAPI as _PluginTreeAPI, TreePluginInfo as _TreePluginInfo, GetPluginsForTreeRequest as _GetPluginsForTreeRequest, GetPluginsForTreeResponse as _GetPluginsForTreeResponse, PluginUsageStats as _PluginUsageStats, CompatibilityResult as _CompatibilityResult, OptimizationResult as _OptimizationResult, DependencyGraph as _DependencyGraph, PluginMetrics as _PluginMetrics, TimePeriod as _TimePeriod, GraphOptions as _GraphOptions, MetricOptions as _MetricOptions, } from './types/PluginTreeAPI.js';
export type { PluginExtensionAPI } from './types/PluginExtensionAPI.js';
export { PluginExtensionRegistry } from './types/PluginExtensionAPI.js';
export type { PluginRegistryAPI, PluginInfo } from './types/PluginRegistryAPI.js';
export type { NodeTypeAPI } from './types/NodeTypeAPI.js';
//# sourceMappingURL=index.d.ts.map