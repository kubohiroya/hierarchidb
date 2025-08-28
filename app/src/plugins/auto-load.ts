/**
 * Auto-load plugins based on package.json dependencies
 * This file automatically discovers and loads all @hierarchidb/node-type-*-plugin packages
 */

import { manifestFileDiscovery, type PluginLoadResult } from '@hierarchidb/common-core';
import type { NodeType } from '@hierarchidb/common-core';

// Import package.json to discover plugins
import packageJson from '../../package.json';

// Plugin manifests - these would normally be loaded from each plugin's manifest file
// For now, we define them here until we implement manifest loading
const PLUGIN_MANIFESTS = {
  'folder': {
    nodeType: 'folder' as NodeType,
    dependencies: [],
    version: '1.0.0'
  },
  'basemap': {
    nodeType: 'basemap' as NodeType,
    dependencies: ['folder'],
    extends: 'folder' as NodeType,
    version: '1.0.0'
  },
  'shape': {
    nodeType: 'shape' as NodeType,
    dependencies: ['folder'],
    version: '1.0.0'
  },
  'stylemap': {
    nodeType: 'stylemap' as NodeType,
    dependencies: ['folder'],
    version: '1.0.0'
  },
  'spreadsheet': {
    nodeType: 'spreadsheet' as NodeType,
    dependencies: ['folder'],
    extends: 'folder' as NodeType,
    version: '1.0.0'
  }
};

/**
 * Automatically discover and load plugins from package.json
 */
export async function autoLoadPlugins(): Promise<PluginLoadResult> {
  console.log('🔍 Auto-discovering plugins from package.json...');
  
  // Set up plugin manifests
  manifestFileDiscovery.setPluginManifests(PLUGIN_MANIFESTS as any);
  
  // Discover and resolve dependencies
  const result = await manifestFileDiscovery.loadPluginsWithDependencies(packageJson as any);
  
  console.log(`📦 Discovered ${result.plugins.length} plugins:`, result.plugins);
  console.log(`📊 Load order:`, result.loadOrder);
  
  // Dynamically import plugins in the correct order
  for (const pluginName of result.loadOrder) {
    console.log(`⏳ Loading plugin: ${pluginName}`);
    
    try {
      switch (pluginName) {
        case 'folder':
          await import('@hierarchidb/node-type-folder-plugin');
          break;
        case 'basemap':
          await import('@hierarchidb/node-type-basemap-plugin');
          break;
        case 'shape':
          await import('@hierarchidb/node-type-shape-plugin');
          break;
        case 'stylemap':
          await import('@hierarchidb/node-type-stylemap-plugin');
          break;
        case 'spreadsheet':
          // Note: spreadsheet-plugin plugin is not in package.json dependencies yet
          // await import('@hierarchidb/node-type-spreadsheet-plugin-plugin');
          console.warn(`⚠️ Plugin ${pluginName} detected but not in dependencies`);
          break;
        default:
          console.warn(`⚠️ Unknown plugin: ${pluginName}`);
      }
      
      console.log(`✅ Loaded plugin: ${pluginName}`);
    } catch (error) {
      console.error(`❌ Failed to load plugin ${pluginName}:`, error);
      throw error;
    }
  }
  
  console.log('✨ All plugins loaded successfully!');
  return result;
}

/**
 * Get the list of plugins that will be loaded
 * Useful for UI components that need to know available plugins
 */
export function getDiscoveredPlugins(): NodeType[] {
  manifestFileDiscovery.setPluginManifests(PLUGIN_MANIFESTS as any);
  return manifestFileDiscovery.discoverPluginsFromPackageJson(packageJson as any);
}

/**
 * Get the complete load result including dependencies
 * This includes transitive dependencies that may not be directly in package.json
 */
export async function getPluginLoadPlan(): Promise<PluginLoadResult> {
  manifestFileDiscovery.setPluginManifests(PLUGIN_MANIFESTS as any);
  return manifestFileDiscovery.loadPluginsWithDependencies(packageJson as any);
}