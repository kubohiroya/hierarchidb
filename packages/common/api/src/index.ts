// API Interfaces

export * from './BatchControlAPI.js';
export type {
  ExportNodesParams,
  ExportProgress,
  ExportResult,
  ImportData,
  ImportExportAPI,
  ImportNodesParams,
  ImportProgress,
  ImportResult,
  ImportValidationIssue,
  ImportValidationResult,
  OperationStatus,
  ValidateImportParams,
  ValidationWarning,
} from './ImportExportAPI.js';
// Multi-Step Dialog API
export type {
  PluginDialogAPI,
  StepCapabilities,
} from './PluginDialogAPI.js';
// New exports
// Runtime wiring interfaces for plugin bootstrap (optional capabilities)
export type { PluginRuntimeWiring } from './RuntimeWiring.js';
export * from './TagAPI.js';
export type { TreeMutationAPI } from './TreeMutationAPI.js';
export type {
  CommitDraftMode,
  CommitDraftOptions,
  CommitDraftRequest,
  DiscardDraftOptions,
  // TODO: remove deprecated export after downstream migration
  TreeNodeUpdaterAPI,
} from './TreeNodeUpdaterAPI.js';
export type {
  ListChildrenOptions,
  ListChildrenPrefetchOptions,
  TreeQueryAPI,
} from './TreeQueryAPI.js';
export type { TreeSubscriptionAPI } from './TreeSubscriptionAPI.js';
export type { TreeTableExpandedAPI } from './TreeTableExpandedAPI.js';
export { findRelatedNodesByPriority, type RelatedNodeSearchOptions } from './treeNodeSearch.js';
export type { UiStorageBridge, WorkerAPI } from './WorkerAPI.js';
