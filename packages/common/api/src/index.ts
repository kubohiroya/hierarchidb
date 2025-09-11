// API Interfaces
export type { TreeMutationAPI } from './TreeMutationAPI';
export type { ImportExportAPI } from './ImportExportAPI';
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
} from './ImportExportAPI';
export type { TreeSubscriptionAPI } from './TreeSubscriptionAPI';
export type { TreeQueryAPI } from './TreeQueryAPI';
export type { WorkingCopyAPI } from './WorkingCopyAPI';
export type { WorkerAPI } from './WorkerAPI';

// Plugin-related APIs (new architecture)
export type { NodeTypeAPI } from './NodeTypeAPI';

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
} from './PluginLifecycleAPI';
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
} from './PluginTreeAPI';

// New exports
export type { PluginExtensionAPI } from './PluginExtensionAPI';
export { PluginExtensionRegistry } from './PluginExtensionAPI';

// Runtime wiring interfaces for plugin bootstrap (optional capabilities)
export type { PluginRuntimeWiring } from './RuntimeWiring';

// Plugin Registry API
export type { PluginRegistryAPI, PluginInfo } from './PluginRegistryAPI';
export * from './TagAPI';

// Multi-Step Dialog API
export type { MultiStepDialogAPI, WorkingCopyData, StepCapabilities } from './MultiStepDialogAPI';
