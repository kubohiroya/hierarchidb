/**
import type { NodeType } from '@hierarchidb/common-type';
 * @file Plugin Registry Types
 * @description Type definitions for the plugin registry system
 */

export interface PluginRegistryConfig {
  autoDiscovery?: boolean;
  strictDependencyChecking?: boolean;
  allowCircularDependencies?: boolean;
}

export interface PluginDiscoveryOptions {
  includeDev?: boolean;
  includeOptional?: boolean;
  pluginPattern?: RegExp;
}
