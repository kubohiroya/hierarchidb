/**
 * Application Plugin Configuration
 * 
 * Defines which plugins the application wants to use.
 * The system will automatically resolve dependencies and load in correct order.
 */

import type { NodeType } from '@hierarchidb/common-core';

/**
 * Plugin selection configuration
 */
export interface PluginConfig {
  // Plugins explicitly requested by the application
  requested: NodeType[];
  
  // Plugins to exclude even if they are dependencies
  excluded?: NodeType[];
  
  // Enable auto-discovery of available plugins
  autoDiscovery?: boolean;
  
  // Load all discovered plugins
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
  // Application explicitly requests these plugins
  requested: [
    'folder',      // Basic folder-plugin functionality
    'basemap',     // Map layers
    'shape',       // Geographic shapes
    'stylemap',    // Styling
    'spreadsheet', // Tabular data
  ],
  
  // No exclusions by default
  excluded: [],
  
  // Enable auto-discovery to find all available plugins
  autoDiscovery: true,
  
  // Don't load all discovered plugins, only requested + dependencies
  loadAll: false,
  
  options: {
    failOnMissing: false,  // Continue even if some plugins fail
    verbose: true,          // Log details in development
    lazyLoad: false,        // Load all plugins at startup
    loadTimeout: 5000,      // 5 second timeout per plugin
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
    autoDiscovery: false,  // Use static imports in production
    options: {
      ...DEFAULT_PLUGIN_CONFIG.options,
      verbose: false,
      failOnMissing: true,
      lazyLoad: true,  // Enable lazy loading in production
    },
  },
  
  // Testing: Minimal set for tests
  test: {
    requested: ['folder'],  // Only the base plugin
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
  const env = process.env.NODE_ENV || 'development';
  return PLUGIN_CONFIGS[env] || DEFAULT_PLUGIN_CONFIG;
}

/**
 * Plugin feature flags for conditional loading
 */
export const PLUGIN_FEATURES = {
  // Geographic features
  enableGeographic: true,  // Enables basemap, shape-plugin plugins
  
  // Data processing features
  enableDataProcessing: true,  // Enables spreadsheet-plugin plugin
  
  // Styling features
  enableStyling: true,  // Enables stylemap-plugin plugin
  
  // Experimental features
  enableExperimental: false,  // Enables experimental plugins
} as const;

/**
 * Get filtered plugin list based on feature flags
 */
export function getRequestedPlugins(): NodeType[] {
  const config = getPluginConfig();
  let requested = [...config.requested];
  
  // Filter based on feature flags
  if (!PLUGIN_FEATURES.enableGeographic) {
    requested = requested.filter(p => !['basemap', 'shape'].includes(p));
  }
  
  if (!PLUGIN_FEATURES.enableDataProcessing) {
    requested = requested.filter(p => p !== 'spreadsheet');
  }
  
  if (!PLUGIN_FEATURES.enableStyling) {
    requested = requested.filter(p => p !== 'stylemap');
  }
  
  // Remove excluded plugins
  if (config.excluded && config.excluded.length > 0) {
    requested = requested.filter(p => !config.excluded!.includes(p));
  }
  
  return requested;
}