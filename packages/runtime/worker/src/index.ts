// Database exports

// Client exports
export { createWorkerClient, createWorkerClientFromInstance } from '~/client';

// Command exports
export { CommandProcessor } from '~/command';
export type { CommandEnvelope, CommandMeta, CommandResult, CommandEvent } from '~/command/types';
export { WorkerErrorCode } from '~/command/types';

// Database exports
export { CoreDB } from '~/db/CoreDB';
export { EphemeralDB } from '~/db/EphemeralDB';
export { StyleMapDB } from '~/db/StyleMapDB';
export { SpreadsheetDB } from '~/db/SpreadsheetDB';
export {
  EntityDatabase,
  DexieAdapter,
  ExpirationCleaner,
  TransactionManager,
  DexieEntityManagerFactory,
} from '~/db/dexieIntegration';
export type { WorkingCopyRow, TreeViewStateRow } from '~/db/EphemeralDB';
export type { ColorRule, StyleMapEntity } from '~/db/StyleMapDB';
export type {
  SpreadsheetMetadata,
  SpreadsheetChunk,
  SpreadsheetRefEntity,
  SpreadsheetMetadataId,
} from '~/db/SpreadsheetDB';
// Handler exports
export {
  BaseEntityHandler,
  // PeerEntityHandler, // Temporarily disabled - needs update to new API
  // GroupEntityHandler, // Temporarily disabled - needs update to new API
  // WorkingCopyHandler, // Temporarily disabled - needs update to new API
} from '~/handlers';

// Auto Lifecycle Management exports
export { EntityRegistrationService } from '~/services/EntityRegistrationService';
export { WorkingCopyManager, WorkingCopySession } from '~/services/WorkingCopyManager';
export { AutoLifecycleManager } from '~/services/AutoLifecycleManager';
export { AutoEntityHandler } from '~/handlers/AutoEntityHandler';

// Lifecycle exports
export { NodeLifecycleManager } from '~/lifecycle/NodeLifecycleManager';
export type {
  NodeLifecycleHooks as LifecycleHooks,
  LifecycleContext,
  LifecycleEvent,
} from '~/lifecycle/types';

// Operations exports
export {
  checkWorkingCopyConflict,
  commitWorkingCopy,
  createNewDraftWorkingCopy,
  createNewName,
  createWorkingCopyFromNode,
  discardWorkingCopy,
  getChildNames,
  getWorkingCopy,
  updateWorkingCopy,
} from '~/operations/WorkingCopyOperations';

// Registry exports
export type {
  NodeLifecycleHooks,
  PluginDefinition,
  NodeDefinition,
  NodeTypeDefinition, // @deprecated - for testing ESLint deprecation detection
  ValidationRule,
  EntityHandler,
  EntityBackup,
} from '~/registry/plugin';

// Re-export types from common-type to avoid private type errors
export type {
  ExportOptions,
  ExportResult,
} from '@hierarchidb/common-type';

// Re-export types from common-api to avoid private type errors
export type {
  CreateTagRequest,
  UpdateTagRequest,
  TagAssociationRequest,
} from '@hierarchidb/common-api';

// Service exports (needed for WorkerAPIImpl return types)
export { TreeQueryService } from '~/services/TreeQueryService';
export { TreeMutationService } from '~/services/TreeMutationService';
export { TreeSubscriptionService } from '~/services/TreeSubscriptionService';
export { PluginManagementService } from '~/services/PluginManagementService';

// API exports
export { WorkerAPIImpl } from '~/WorkerAPIImpl';

// Plugin exports
export type {
  PluginConfig,
  NodeTypeConfig,
  DatabaseConfig,
  TableConfig,
  DependencyConfig,
  LifecycleConfig,
  PluginContext,
} from '~/plugin/PluginLoader';
