// Database exports

export * from '~/client';
// Command exports
export * from '~/command';
export * from '~/db';
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
export * from '~/lifecycle';
// Operations exports
export * from '~/operations';
// Registry exports
export type { 
  PeerEntity, 
  GroupEntity,
  NodeLifecycleHooks,
  PluginDefinition,
  WorkerPluginRouterAction,
  NodeDefinition,
  NodeTypeDefinition, // @deprecated - for testing ESLint deprecation detection
  ValidationRule,
  EntityHandler,
  EntityBackup,
  IconDefinition
} from '~/registry/plugin';
export { UnifiedNodeTypeRegistry } from '~/registry/UnifiedNodeTypeRegistry';
// export * from '~/registry';
// API exports
export * from '~/WorkerAPIImpl';
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
