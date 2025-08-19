/**
 * @file index.ts
 * @description Registry module exports for worker package
 */

// Export registries
// Direct export for immediate usage
export {
  SimpleNodeTypeRegistry,
  SimpleNodeTypeRegistry as NodeTypeRegistry,
} from './SimpleNodeTypeRegistry';
// Export types
export * from './types';
export type {
  BaseEntity,
  BaseSubEntity,
  BaseWorkingCopy,
  EntityBackup,
  EntityHandler,
  ExtendedNodeTypeConfig,
  NodeLifecycleHooks,
  NodeTypeDefinition,
  UnifiedPluginDefinition,
  ValidationRule,
  WorkerPluginRouterAction,
} from './unified-plugin';
// Export interfaces
export type { IUnifiedNodeTypeRegistry } from './UnifiedNodeTypeRegistry';
export { UnifiedNodeTypeRegistry } from './UnifiedNodeTypeRegistry';
