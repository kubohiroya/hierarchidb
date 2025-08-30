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
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ImportProgress,
  ExportProgress,
  OperationStatus
} from './ImportExportAPI';
export type { TreeSubscriptionAPI } from './TreeSubscriptionAPI';
export type { TreeQueryAPI } from './TreeQueryAPI';
export type { WorkingCopyAPI } from './WorkingCopyAPI';
export type { WorkerAPI } from './WorkerAPI';

// Plugin-related APIs (new architecture)
export type { NodeTypeAPI } from './NodeTypeAPI';
export type {
  // Legacy export (deprecated)
  PluginManagementAPI,
  PluginRegistrationResult,
  UnregistrationResult,
  PluginValidationResult,
  PluginHealthStatus,
  PluginRegistrationInfo,
  PluginListOptions,
  PluginDependencyInfo,
  BulkOperationOptions,
  BulkOperationResult
} from './PluginManagementAPI';

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
  MetricOptions
} from './PluginTreeAPI';

// New exports from TreePluginAnalyzer (with aliased names to avoid conflicts)
export type {
  TreePluginAnalyzer,
  TreePluginInfo as TreePluginInfoNew,
  GetPluginsForTreeRequest as GetPluginsForTreeRequestNew,
  GetPluginsForTreeResponse as GetPluginsForTreeResponseNew,
  PluginUsageStats as PluginUsageStatsNew,
  CompatibilityResult as CompatibilityResultNew,
  OptimizationResult as OptimizationResultNew,
  DependencyGraph as DependencyGraphNew,
  PluginMetrics as PluginMetricsNew,
  TimePeriod as TimePeriodNew,
  GraphOptions as GraphOptionsNew,
  MetricOptions as MetricOptionsNew,
} from './TreePluginAnalyzer';
// Legacy exports (deprecated)
export type { PluginAPI, InvokeResult } from './PluginAPI';
export { PluginAPIRegistry } from './PluginAPI';

// New exports
export type { PluginExtensionAPI } from './PluginExtensionAPI';
export { PluginExtensionRegistry } from './PluginExtensionAPI';

// Legacy APIs (deprecated)
// Legacy export (deprecated)
export type { PluginRegistryAPI } from './PluginRegistryAPI';

// New export
export type { NodeTypeRegistryAPI } from './NodeTypeRegistryAPI';
