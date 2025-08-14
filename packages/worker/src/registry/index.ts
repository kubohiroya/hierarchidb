/**
 * @file index.ts
 * @description Registry module exports for worker package
 */

// Export types
export * from './types';
export type {
  BaseEntity,
  BaseSubEntity,
  BaseWorkingCopy,
  EntityHandler,
  EntityBackup,
  NodeLifecycleHooks,
  WorkerPluginRouterAction,
  ValidationRule,
  NodeTypeDefinition,
  UnifiedPluginDefinition,
  ExtendedNodeTypeConfig,
} from './types/unified-plugin';

// Export registries
export { SimpleNodeTypeRegistry } from './SimpleNodeTypeRegistry';
export { UnifiedNodeTypeRegistry } from './UnifiedNodeTypeRegistry';

// Export interfaces
export type { IUnifiedNodeTypeRegistry } from './UnifiedNodeTypeRegistry';

// Direct export for immediate usage
export { SimpleNodeTypeRegistry as NodeTypeRegistry } from './SimpleNodeTypeRegistry';

// Re-export core interfaces
export type {
  INodeTypeRegistry,
  IPluginRegistry,
  ISimpleNodeTypeRegistry,
  NodeTypeConfig,
} from '@hierarchidb/core';
