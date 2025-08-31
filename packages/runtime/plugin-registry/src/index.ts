/**
 * @file Plugin Registry Package
 * @description Central plugin management system for HierarchiDB
 */

// Export API functions
export {
  isNodeTypeRegistered,
  getPluginDefinition,
  getRegisteredPlugins,
} from './api/plugin-registry-api';

// Export PluginRegistry class
export { PluginRegistry } from './registry/PluginRegistry';
export type { IPluginRegistry } from './registry/IPluginRegistry';

// Export SimpleNodeTypeRegistry
export { SimpleNodeTypeRegistry } from './registry/SimpleNodeTypeRegistry';
