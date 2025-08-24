/**
 * @file plugin.ts
 * @description Plugin-related type definitions for HierarchiDB
 * These types are shared between worker and UI packages
 */

import type { TreeId, NodeType, PeerEntity, ValidationRule, PluginMetadata } from './index';

// Use lifecycle hooks and validation from nodeDefinition.ts to avoid duplication

// Icon definition supporting multiple formats
export interface IconDefinition {
  // MUI icon name (e.g., 'Folder', 'Description', 'Map')
  muiIconName?: string;

  // Unicode emoji (e.g., '📁', '🗺️', '📍')
  emoji?: string;

  // SVG as string or React component path
  svg?: string;
  svgPath?: string;

  // Icon description for accessibility and UI hints
  description?: string;

  // Optional color hint
  color?: string;
}

/**
 * Category definition for plugins
 * Defines which tree(s) a plugin should be available in
 */
export interface CategoryDefinition {
  // Tree ID where this plugin should be available
  // Use '*' for all trees or specific TreeId for targeted availability
  readonly treeId: TreeId | '*';

  // Optional: Menu group for organization (basic, container, document, advanced)
  readonly menuGroup?: 'basic' | 'container' | 'document' | 'advanced';

  // Optional: Create order within the menu group
  readonly createOrder?: number;
}

// Worker-side plugin router action definition (without React containers)
export interface WorkerPluginRouterAction {
  path?: string;
  loader?: () => Promise<unknown>;
  action?: () => Promise<unknown>;
  componentPath?: string; // Path to the component to load on UI side
}

// Database configuration for plugins
export interface PluginDatabaseConfig {
  dbName: string;
  tableName: string;
  schema: string; // Dexie schema
  version: number;
}

// Plugin UI configuration
export interface PluginUIConfig {
  dialogComponentPath?: string;
  panelComponentPath?: string;
  formComponentPath?: string;
  iconComponentPath?: string;
}

// Plugin API configuration
export interface PluginAPIConfig {
  workerExtensions?: Record<string, (...args: unknown[]) => Promise<unknown>>;
  clientExtensions?: Record<string, (...args: unknown[]) => Promise<unknown>>;
}

// Plugin validation configuration
export interface PluginValidationConfig<TEntity extends PeerEntity = PeerEntity> {
  namePattern?: RegExp;
  maxChildren?: number;
  allowedChildTypes?: NodeType[];
  customValidators?: ValidationRule<TEntity>[];
}

// Plugin i18n configuration
export interface PluginI18nConfig {
  // Namespace for this plugin's translations
  namespace?: string;
  // Default locale (e.g., 'en', 'ja')
  defaultLocale?: string;
  // Path pattern for locale files (e.g., './locales/{{lng}}/{{ns}}.json')
  localesPath?: string;
  // Embedded translations (optional, for small plugins)
  resources?: {
    [locale: string]: {
      menuItem?: {
        title?: string;
        tooltip?: string;
      };
      dialog?: {
        title?: string;
        description?: string;
        createButton?: string;
        cancelButton?: string;
      };
      panel?: {
        title?: string;
        description?: string;
      };
      speedDial?: {
        tooltip?: string;
      };
      [key: string]: any;
    };
  };
}

// Core node definition (without entity handler - that's worker-specific)
export interface PluginDefinition {
  readonly nodeType: NodeType;
  readonly name: string;
  readonly displayName: string;

  // i18n configuration
  readonly i18n?: PluginI18nConfig;

  // Icon configuration with multi-format support
  readonly icon?: IconDefinition;

  // Category configuration - defines which tree(s) this plugin is available in
  readonly category: CategoryDefinition;

  // Database configuration
  readonly database: PluginDatabaseConfig;

  // Lifecycle hooks configuration (without actual handlers)
  readonly lifecycle?: {
    hasBeforeCreate?: boolean;
    hasAfterCreate?: boolean;
    hasBeforeUpdate?: boolean;
    hasAfterUpdate?: boolean;
    hasBeforeDelete?: boolean;
    hasAfterDelete?: boolean;
    hasBeforeCommit?: boolean;
    hasAfterCommit?: boolean;
    hasBeforeDiscard?: boolean;
    hasAfterDiscard?: boolean;
    hasBeforeMove?: boolean;
    hasAfterMove?: boolean;
  };

  // UI configuration references (optional)
  readonly ui?: PluginUIConfig;

  // API extensions (optional)
  readonly api?: PluginAPIConfig;

  // Validation (optional)
  readonly validation?: PluginValidationConfig;
}

/**
 * @deprecated Use PluginDefinition instead
 */
export type CoreNodeDefinition = PluginDefinition;

// Plugin routing configuration
export interface PluginRoutingConfig {
  actions: Record<string, WorkerPluginRouterAction>;
  defaultAction?: string;
}

// Plugin metadata - use the one from nodeDefinition.ts to avoid duplication
// export interface PluginMetadata { ... } // Defined in nodeDefinition.ts

// Extended node definition with routing and metadata
export interface ExtendedNodeDefinition extends CoreNodeDefinition {
  // Worker-side routing configuration (without React containers)
  readonly routing: PluginRoutingConfig;

  // Plugin metadata
  readonly meta: PluginMetadata;
}
