// API Interfaces
export type { TreeMutationAPI } from './TreeMutationAPI.js';
export type { ImportExportAPI } from './ImportExportAPI.js';
export type {
  ImportNodesParams,
  ExportNodesParams,
  ImportData,
  ImportResult,
  ExportResult,
  ValidateImportParams,
  ValidationWarning,
  ImportProgress,
  ExportProgress,
  OperationStatus,
} from './ImportExportAPI.js';
export type { TreeSubscriptionAPI } from './TreeSubscriptionAPI.js';
export type { TreeQueryAPI, ListChildrenOptions, ListChildrenPrefetchOptions } from './TreeQueryAPI.js';
export type { WorkingCopyAPI, CommitWorkingCopyOptions } from './WorkingCopyAPI.js';
export type { DialogStateAPI, DialogStateSubscriptionId } from './DialogStateAPI.js';

// Plugin-related APIs (new architecture)
export type { NodeTypeAPI } from './NodeTypeAPI.js';

// New exports from PluginLifecycleAPI
export type {
  PluginLifecycleAPI,
  PluginRegistrationResult as PluginRegistrationResultNew,
  UnregistrationResult as UnregistrationResultNew,
  PluginValidationResult as PluginValidationResultNew,
  PluginHealthStatus as PluginHealthStatusNew,
  PluginRegistrationInfo as PluginRegistrationInfoNew,
  PluginListOptions as PluginListOptionsNew,
  PluginDependencyInfo as PluginDependencyInfoNew,
  BulkOperationOptions as BulkOperationOptionsNew,
  BulkOperationResult as BulkOperationResultNew,
  PluginResetOptions as PluginResetOptionsNew,
  PluginResetResult as PluginResetResultNew,
  PluginDeleteResult as PluginDeleteResultNew,
} from './PluginLifecycleAPI.js';
export type {
  // Legacy export (deprecated)
  PluginTreeAPI,
  TreePluginInfo,
  GetPluginsForTreeRequest,
  GetPluginsForTreeResponse,
  PluginUsageStats,
  CompatibilityResult,
  OptimizationResult,
  DependencyGraph,
  PluginMetrics,
  TimePeriod,
  GraphOptions,
  MetricOptions,
} from './PluginTreeAPI.js';
// Node16 requires extension for re-export specifiers
export type {
  PluginTreeAPI as _PluginTreeAPI,
  TreePluginInfo as _TreePluginInfo,
  GetPluginsForTreeRequest as _GetPluginsForTreeRequest,
  GetPluginsForTreeResponse as _GetPluginsForTreeResponse,
  PluginUsageStats as _PluginUsageStats,
  CompatibilityResult as _CompatibilityResult,
  OptimizationResult as _OptimizationResult,
  DependencyGraph as _DependencyGraph,
  PluginMetrics as _PluginMetrics,
  TimePeriod as _TimePeriod,
  GraphOptions as _GraphOptions,
  MetricOptions as _MetricOptions,
} from './PluginTreeAPI.js';

// New exports
export type { PluginExtensionAPI } from './PluginExtensionAPI.js';
export { PluginExtensionRegistry } from './PluginExtensionAPI.js';

// Runtime wiring interfaces for plugin bootstrap (optional capabilities)
export type { PluginRuntimeWiring } from './RuntimeWiring.js';

// Plugin Registry API
export type { PluginRegistryAPI, PluginInfo } from './PluginRegistryAPI.js';
export * from './TagAPI.js';

// Multi-Step Dialog API
export type { MultiStepDialogAPI, WorkingCopyData, StepCapabilities } from './MultiStepDialogAPI.js';

