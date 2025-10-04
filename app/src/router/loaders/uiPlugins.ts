/**
 * UI Plugin Initialization Service
 * 
 * Provides a unified interface for loading and registering UI plugins
 * for use with TanStack Router's beforeLoad lifecycle.
 */

import { loadAllUIPlugins } from '../../generated/ui-loader.js';

export interface UIPluginSetupResult {
  registry: Record<string, unknown>;
  servicesReady: Promise<void>;
  teardown: () => Promise<void>;
}

/**
 * Setup UI plugins by loading all plugin UI code and preparing the registry
 * 
 * This function:
 * 1. Loads all UI plugin modules (using dynamic imports)
 * 2. Returns a registry placeholder (plugins are registered globally)
 * 3. Provides a teardown function for cleanup
 * 
 * @returns Promise resolving to plugin setup result with registry and teardown
 */
export async function setupUIPlugins(): Promise<UIPluginSetupResult> {
  // Load all UI plugins (this triggers dynamic imports and plugin registration)
  await loadAllUIPlugins();

  // Registry is populated globally by the plugins themselves
  // Return an empty object as placeholder
  const registry = {};

  // Services are ready immediately after loading
  const servicesReady = Promise.resolve();

  // Teardown function (no-op for now, but could be extended)
  const teardown = async () => {
    // Currently no cleanup needed
    // Future: Could unregister plugins, clean up resources, etc.
  };

  return {
    registry,
    servicesReady,
    teardown,
  };
}
