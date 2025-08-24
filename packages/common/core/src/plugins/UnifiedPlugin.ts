/**
 * Unified Plugin System for HierarchiDB
 * 
 * Supports both node-type plugins and feature plugins with a consistent interface
 */

import type { NodeId } from '../types/ids';
import type { TreeNode } from '../types/tree';
import type { ComponentType } from 'react';

/**
 * Plugin types
 */
export type PluginType = 'node-type' | 'feature' | 'hybrid';

/**
 * Plugin manifest describing the plugin's capabilities
 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  type: PluginType;
  description?: string;
  author?: string;
  dependencies?: string[];
}

/**
 * Context provided to plugins during installation
 */
export interface PluginContext {
  // Core services
  getWorkerAPI?: () => any;
  getUIRegistry?: () => any;
  
  // Event emitters
  on?: (event: string, handler: Function) => void;
  off?: (event: string, handler: Function) => void;
  emit?: (event: string, ...args: any[]) => void;
  
  // Configuration
  config?: Record<string, any>;
}

/**
 * Node type definition for node-type plugins
 */
export interface NodeTypeCapability {
  nodeType: string;
  label: string;
  icon?: ComponentType;
  
  // Entity handling
  entityHandler?: {
    create?: (nodeId: NodeId, data: any) => Promise<any>;
    update?: (nodeId: NodeId, changes: any) => Promise<any>;
    delete?: (nodeId: NodeId) => Promise<void>;
    get?: (nodeId: NodeId) => Promise<any>;
  };
  
  // UI components
  ui?: {
    createDialog?: ComponentType<any>;
    editDialog?: ComponentType<any>;
    panelComponent?: ComponentType<any>;
    viewComponent?: ComponentType<any>;
  };
  
  // Lifecycle hooks
  lifecycle?: {
    beforeCreate?: (parentNodeId: NodeId, data: any) => Promise<any>;
    afterCreate?: (node: TreeNode) => Promise<void>;
    beforeUpdate?: (node: TreeNode, changes: any) => Promise<any>;
    afterUpdate?: (node: TreeNode) => Promise<void>;
    beforeDelete?: (node: TreeNode) => Promise<boolean>;
    afterDelete?: (nodeId: NodeId) => Promise<void>;
  };
}

/**
 * Feature capability for feature plugins
 */
export interface FeatureCapability {
  id: string;
  name: string;
  
  // Feature type
  category: 'import-export' | 'auth' | 'theme' | 'ui-extension' | 'data-processing' | 'other';
  
  // UI integration points
  ui?: {
    menuItems?: MenuItemDefinition[];
    toolbarButtons?: ToolbarButtonDefinition[];
    panels?: PanelDefinition[];
    routes?: RouteDefinition[];
  };
  
  // API extensions
  api?: {
    commands?: CommandDefinition[];
    queries?: QueryDefinition[];
    subscriptions?: SubscriptionDefinition[];
  };
  
  // Activation
  activate?: (context: PluginContext) => Promise<void>;
  deactivate?: () => Promise<void>;
}

/**
 * UI extension definitions
 */
export interface MenuItemDefinition {
  id: string;
  label: string;
  icon?: ComponentType;
  action: () => void;
  position?: 'file' | 'edit' | 'view' | 'tools' | 'help';
}

export interface ToolbarButtonDefinition {
  id: string;
  label: string;
  icon: ComponentType;
  action: () => void;
  tooltip?: string;
}

export interface PanelDefinition {
  id: string;
  title: string;
  component: ComponentType;
  position?: 'left' | 'right' | 'bottom';
}

export interface RouteDefinition {
  path: string;
  component: ComponentType;
  exact?: boolean;
}

/**
 * Command/Query definitions for API extensions
 */
export interface CommandDefinition {
  id: string;
  name: string;
  execute: (...args: any[]) => Promise<any>;
}

export interface QueryDefinition {
  id: string;
  name: string;
  query: (...args: any[]) => Promise<any>;
}

export interface SubscriptionDefinition {
  id: string;
  name: string;
  subscribe: (callback: Function) => () => void;
}

/**
 * Main unified plugin interface
 */
export interface UnifiedPlugin {
  manifest: PluginManifest;
  
  // Capabilities based on plugin type
  nodeTypes?: NodeTypeCapability[];
  features?: FeatureCapability[];
  
  // Lifecycle
  install: (context: PluginContext) => Promise<void>;
  uninstall?: () => Promise<void>;
  
  // Status
  isInstalled?: () => boolean;
  isActive?: () => boolean;
}

/**
 * Plugin registration result
 */
export interface PluginRegistrationResult {
  success: boolean;
  pluginId: string;
  errors?: string[];
  warnings?: string[];
}