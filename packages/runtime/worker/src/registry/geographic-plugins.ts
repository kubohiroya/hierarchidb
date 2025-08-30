/**
 * Geographic Plugin Registration
 * Registers shape, location, and route plugins
 */

import type { PluginDefinition } from './types';
import { NodeTypeRegistry } from './NodeTypeRegistry';

// Import plugin definitions
import { ShapePluginDefinition } from '@hierarchidb/node-type-shape-plugin';
import { LocationPluginDefinition } from '@hierarchidb/node-type-location-plugin';
import { RoutePluginDefinition } from '@hierarchidb/node-type-route-plugin';

/**
 * Register all geographic plugins
 */
export function registerGeographicPlugins(): void {
  const registry = NodeTypeRegistry.getInstance();
  
  // Register shape plugin (administrative boundaries)
  registry.register(ShapePluginDefinition);
  console.log('Registered shape plugin');
  
  // Register location plugin (point locations)
  registry.register(LocationPluginDefinition);
  console.log('Registered location plugin');
  
  // Register route plugin (transportation networks)
  registry.register(RoutePluginDefinition);
  console.log('Registered route plugin');
}

/**
 * Get all geographic plugin definitions
 */
export function getGeographicPlugins(): PluginDefinition[] {
  return [
    ShapePluginDefinition,
    LocationPluginDefinition,
    RoutePluginDefinition,
  ];
}

/**
 * Check if a node type is a geographic plugin
 */
export function isGeographicPlugin(nodeType: string): boolean {
  return ['shape', 'location', 'route'].includes(nodeType);
}