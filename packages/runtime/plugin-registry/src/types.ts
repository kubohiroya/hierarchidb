/**
 * @file Plugin Registry Types
 * @description Type definitions for the plugin registry system
 */

import type { NodeType } from '@hierarchidb/common-core';

export interface PluginMetadata {
  nodeType: NodeType;
  name: string;
  version: string;
  dependencies?: NodeType[];
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