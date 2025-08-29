/**
import type { NodeType } from '@hierarchidb/common-type';
 * @file Plugin Registry Types
 * @description Type definitions for the plugin registry system
 */

export interface PluginMetadata {
  nodeType: string;
  name: string;
  version: string;
  dependencies?: string[];
  category?: string;
  extends?: string;
}

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