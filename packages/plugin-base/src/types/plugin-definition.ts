/**
 * Node definition with entity handler
 * Combines core node definition with worker-side entity handler
 */

import type { NodeType, TreeId, PeerEntity, ValidationRule } from '@hierarchidb/common-types';

export interface PluginDefinition {
  // Basic node information
  readonly nodeType: NodeType;
  readonly name: string;
  readonly displayName: string;
  readonly description?: string;

  // Visibility configuration
  readonly visibility?: {
    showInCreateMenu?: boolean;  // Show in "Create new node" menu (default: true)
    showInPluginList?: boolean;  // Show in plugin list/settings (default: true)
  };

  // i18n configuration
  readonly i18n?: PluginI18nConfig;

  // Icon configuration
  readonly icon?: NodeTypeIconDefinition;

  // Category configuration - defines which console(s) this plugin is available in
  readonly category: CategoryDefinition;

  // Database configuration
  readonly database: PluginDatabaseConfig;

  // UI configuration (optional)
  readonly ui?: PluginUIConfig;

  // API extensions (optional)
  readonly api?: PluginAPIConfig;

  // Validation configuration (optional)
  readonly validation?: PluginValidationConfig;

  readonly extends?: string;
  readonly dependencies: string[];

  readonly priority: number;
  readonly version: string;
}

export interface NodeTypeIconDefinition {
  // MUI icon name (e.g., 'Folder', 'Description', 'Map')
  muiIconName?: string;

  //  Unicode emoji (e.g., '', '', '')
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
 * Category definition for plugin-loader
 * Defines which console(s) a plugin should be available in
 */
export interface CategoryDefinition {
  // TreeTypes ID where this plugin should be available
  // Use '*' for all trees or specific TreeId for targeted availability
  readonly treeId: TreeId | '*';

  // Optional: Menu group for organization (basic, container, document, advanced)
  readonly menuGroup?: 'basic' | 'container' | 'document' | 'advanced';

  // Optional: Create order within the menu group
  readonly createOrder?: number;
}

/**
 * Node capability definition
 * Defines what operations and features a node type supports
 */
export type NodeCapability =
  | 'create' // Can create new instances
  | 'read' // Can be read/viewed
  | 'update' // Can be updated/edited
  | 'delete' // Can be deleted
  | 'move' // Can be moved to different parent
  | 'copy' // Can be copied/duplicated
  | 'export' // Can be exported
  | 'import' // Can import data
  | 'children' // Can have child nodes
  | 'references' // Can reference other nodes
  | 'validation' // Has custom validation rules
  | 'lifecycle' // Has lifecycle hooks
  | 'search' // Can be searched/indexed
  | 'sync' // Can be synchronized
  | 'offline'; // Can work offline

// Worker-side plugin router action definition (without React containers)
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface WorkerPluginRouterAction {
  path?: string;
  loader?: () => Promise<unknown>;
  action?: () => Promise<unknown>;
  componentPath?: string; // Path to the component to load on UI side
}

// Database configuration for plugin-loader
export interface PluginDatabaseConfig {
  dbName: string;
  // Optional default entity store name used by some plugin-loader (e.g., folders)
  entityStore?: string;
  schema: DatabaseSchema; // Dexie schema
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
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface PluginI18nConfig {
  // Namespace for this plugin's translations
  namespace?: string;
  // Default locale (e.g., 'en', 'ja')
  defaultLocale?: string;
  // Path pattern for locale files (e.g., './locales/{{lng}}/{{ns}}.json')
  localesPath?: string;
  // Embedded translations (optional, for small plugin-loader)
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
      [key: string]: unknown;
    };
  };
}

export interface DatabaseSchema {
  [storeName: string]: string; // Dexie schema string
}
