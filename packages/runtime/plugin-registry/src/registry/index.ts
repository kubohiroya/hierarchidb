/**
 * @file openstreetmap-type.ts
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
  PeerEntity,
  GroupEntity,
  WorkingCopy,
  EntityBackup,
  EntityHandler,
  ExtendedNodeTypeConfig,
  NodeLifecycleHooks,
  NodeTypeDefinition,
  PluginDefinition,
  ValidationRule,
  WorkerPluginRouterAction,
} from './plugin';
// Export interfaces
export type { IUnifiedNodeTypeRegistry } from './UnifiedNodeTypeRegistry';
export { UnifiedNodeTypeRegistry } from './UnifiedNodeTypeRegistry';
