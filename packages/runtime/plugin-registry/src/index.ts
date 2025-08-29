/**
 * @file Plugin Registry Package
 * @description Central plugin management system for HierarchiDB
 */

// Export plugin discovery
export { SimplePluginDiscovery } from './discovery/SimplePluginDiscovery';

// Export registries
export { SimpleNodeTypeRegistry } from './registry/SimpleNodeTypeRegistry';
export { UnifiedNodeTypeRegistry } from './registry/UnifiedNodeTypeRegistry';

// Export types and interfaces
export type {
  PluginMetadata,
  PluginRegistryConfig,
  PluginDiscoveryOptions
} from './types';

// Export plugin types
export type { 
  WorkingCopyProperties,
  PluginDefinition,
  EntityHandler,
  PeerEntity,
  GroupEntity 
} from './registry/plugin';

// Export API functions
export {
  isNodeTypeRegistered,
  getPluginDefinition,
  getRegisteredPlugins
} from './api/plugin-registry-api';