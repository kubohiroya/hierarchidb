/**
 * Application Plugin Configuration
 *
 * Defines which plugin-loader the application wants to use.
 * The system will automatically resolve dependencies and load in correct order.
 */

import type { NodeType } from '@hierarchidb/feature-core/common-types';
import { readRuntimeMode } from '@hierarchidb/feature-core/util';
import {
  getAllPluginNodeTypes,
  getNodeTypesByCategoryId,
  getNodeTypesByMenuGroup,
  orderNodeTypes,
} from '../services/plugin-registry.ts';

const CORE_PLUGINS = orderNodeTypes(getNodeTypesByMenuGroup('core'));
const GEOGRAPHIC_PLUGINS = orderNodeTypes(getNodeTypesByCategoryId('geographic'));
const DATA_PLUGINS = orderNodeTypes(getNodeTypesByCategoryId('data'));
const VISUALIZATION_PLUGINS = orderNodeTypes(getNodeTypesByCategoryId('visualization'));

const DEFAULT_REQUESTED_PLUGINS = orderNodeTypes([
  ...CORE_PLUGINS,
  ...GEOGRAPHIC_PLUGINS,
  ...DATA_PLUGINS,
  ...VISUALIZATION_PLUGINS,
]);

const PRIMARY_CORE_PLUGIN: NodeType | undefined = CORE_PLUGINS[0];

/**
 * Plugin selection configuration
 */
export interface PluginConfig {
  // Plugins explicitly requested by the application
  requested: NodeType[];

  // Plugins to exclude even if they are dependencies
  excluded?: NodeType[];

  // Enable auto-discovery of available plugin-loader
  autoDiscovery?: boolean;

  // Load all discovered plugin-loader
  loadAll?: boolean;

  // Plugin loading options
  options?: {
    // Fail if a requested plugin cannot be loaded
    failOnMissing?: boolean;

    // Log detailed loading information
    verbose?: boolean;

    // Enable lazy loading
    lazyLoad?: boolean;

    // Timeout for plugin loading (ms)
    loadTimeout?: number;
  };
}

/**
 * Default application plugin configuration
 */
export const DEFAULT_PLUGIN_CONFIG: PluginConfig = {
  // Application explicitly requests these plugin-loader
  requested: DEFAULT_REQUESTED_PLUGINS,

  // No exclusions by default
  excluded: [],

  // Enable auto-discovery to find all available plugin-loader
  autoDiscovery: true,

  // Don't load all discovered plugin-loader, only requested + dependencies
  loadAll: false,

  options: {
    failOnMissing: false, // Continue even if some plugin-loader fail
    verbose: true, // Log details in development
    lazyLoad: false, // Load all plugin-loader at startup
    loadTimeout: 5000, // 5 second timeout per plugin
  },
};

/**
 * Environment-specific configurations
 */
export const PLUGIN_CONFIGS: Record<string, PluginConfig> = {
  // Development: Load everything for testing
  development: {
    ...DEFAULT_PLUGIN_CONFIG,
    loadAll: true,
    options: {
      ...DEFAULT_PLUGIN_CONFIG.options,
      verbose: true,
      failOnMissing: false,
    },
  },

  // Production: Only load what's needed
  production: {
    ...DEFAULT_PLUGIN_CONFIG,
    autoDiscovery: false, // Use static imports in production
    options: {
      ...DEFAULT_PLUGIN_CONFIG.options,
      verbose: false,
      failOnMissing: true,
      lazyLoad: true, // Enable lazy loading in production
    },
  },

  // Testing: Minimal set for tests
  test: {
    requested: PRIMARY_CORE_PLUGIN ? [PRIMARY_CORE_PLUGIN] : DEFAULT_REQUESTED_PLUGINS.slice(0, 1),
    autoDiscovery: false,
    options: {
      verbose: false,
      failOnMissing: false,
      loadTimeout: 1000,
    },
  },
};

/**
 * Get plugin configuration for current environment
 */
export function getPluginConfig(): PluginConfig {
  const mode = resolveRuntimeMode();
  return PLUGIN_CONFIGS[mode] || DEFAULT_PLUGIN_CONFIG;
}

function resolveRuntimeMode(): string {
  return readRuntimeMode() ?? 'development';
}

/**
 * Plugin feature flags for conditional loading
 */
export const PLUGIN_FEATURES = {
  // Geographic features
  enableGeographic: true, // Enables basemap, shape-plugin plugin-loader

  // Data processing features
  enableDataProcessing: true, // Enables spreadsheet-plugin plugin

  // Styling features
  enableStyling: true, // Enables styler-plugin plugin

  // Experimental features
  enableExperimental: false, // Enables experimental plugin-loader
} as const;

/**
 * Get filtered plugin list based on feature flags
 */
export function getRequestedPlugins(): NodeType[] {
  const config = getPluginConfig();
  let requested = config.loadAll
    ? orderNodeTypes(getAllPluginNodeTypes())
    : orderNodeTypes(config.requested);

  // Filter based on feature flags
  if (!PLUGIN_FEATURES.enableGeographic) {
    const exclude = new Set(GEOGRAPHIC_PLUGINS);
    requested = requested.filter((p) => !exclude.has(p));
  }

  if (!PLUGIN_FEATURES.enableDataProcessing) {
    const exclude = new Set(DATA_PLUGINS);
    requested = requested.filter((p) => !exclude.has(p));
  }

  if (!PLUGIN_FEATURES.enableStyling) {
    const exclude = new Set(VISUALIZATION_PLUGINS);
    requested = requested.filter((p) => !exclude.has(p));
  }

  // Remove excluded plugin-loader
  if (config.excluded && config.excluded.length > 0) {
    requested = requested.filter((p) => !config.excluded!.includes(p));
  }

  return requested;
}
