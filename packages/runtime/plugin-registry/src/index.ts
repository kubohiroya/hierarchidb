/**
 * @file Plugin Registry Package
 * @description Central plugin management system for HierarchiDB
 */

// Export main registry class
export { PluginRegistry } from './registry/PluginRegistry';

// Export API functions
export {
  isNodeTypeRegistered,
  getPluginDefinition,
  getRegisteredPlugins,
} from './api/plugin-registry-api';
