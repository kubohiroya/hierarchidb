/**
 * @file openstreetmap-type.ts
 * @description Registry module exports for worker package
 */

// Export types
export type {
  EntityBackup,
  EntityHandler,
  ExtendedNodeTypeConfig,
  NodeLifecycleHooks,
  NodeTypeDefinition,
  PluginDefinition,
  ValidationRule,
} from './plugin';
// Export interfaces
export type { IUnifiedNodeTypeRegistry } from './UnifiedNodeTypeRegistry';
export { UnifiedNodeTypeRegistry } from './UnifiedNodeTypeRegistry';
