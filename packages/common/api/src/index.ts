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
export type { 
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
export type { PluginAPI, InvokeResult } from './PluginAPI';
export { PluginAPIRegistry } from './PluginAPI';

// Legacy APIs (deprecated)
export type { PluginRegistryAPI } from './PluginRegistryAPI';
