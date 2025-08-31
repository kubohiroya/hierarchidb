/**
 * @file index.ts
 * @description Export loader utilities for plugin integration
 */

export { PluginIntegrationBuilder } from './PluginIntegrationBuilder';

// Re-export types for convenience
export type {
  PluginDefinition,
  PluginIntegrated,
  NodeType,
  EntityHandler,
  NodeLifecycleHooks,
  PluginRoutingConfig,
} from '@hierarchidb/common-type';