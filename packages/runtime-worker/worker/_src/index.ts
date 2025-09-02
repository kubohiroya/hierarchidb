// Database exports

// Client exports
export { createWorkerClient, createWorkerClientFromInstance } from '~/client';

// Command exports
export { CommandProcessor } from '~/command';
export type { CommandEnvelope, CommandMeta, CommandResult, CommandEvent } from '~/command/types';
export { WorkerErrorCode } from '~/command/types';

// Database exports
export { CoreDB } from '~/services/CoreDB';
export { EphemeralDB } from '~/services/EphemeralDB';
// export { StylerDB } from '~/services/StylerDB';  // Not implemented yet
// export { SpreadsheetDB } from '~/services/SpreadsheetDB';  // Not implemented yet
export {
  EntityDatabase,
  DexieAdapter,
  ExpirationCleaner,
  TransactionManager,
  DexieEntityManagerFactory,
} from '~/services/dexieIntegration';
export type { WorkingCopyRow, TreeViewStateRow } from '~/services/EphemeralDB';
// export type { ColorRule, StylerEntity } from '~/services/StylerDB';  // Not implemented yet
// export type {
//   SpreadsheetMetadata,
//   SpreadsheetChunk,
//   SpreadsheetRefEntity,
//   SpreadsheetMetadataId,
// } from '~/services/SpreadsheetDB';  // Not implemented yet
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

// Service exports (needed for WorkerAPIImpl return types)
export { TreeQueryService } from '~/services/TreeQueryService';
export { TreeMutationService } from '~/services/TreeMutationService';
export { TreeSubscriptionService } from '~/services/TreeSubscriptionService';
export { PluginManagementService } from '~/services/PluginManagementService';

// API exports (新旧両対応)
export { WorkerAPIImpl } from '~/WorkerAPIImpl'; // 後方互換性のため一時的に維持
export { WorkerService } from '~/4-api-implementation/WorkerService'; // 新しい窓口API
export { Bootstrap } from '~/1-bootstrap/Bootstrap'; // 新しいブートストラップ

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
