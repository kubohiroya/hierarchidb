/**
 * @file default-plugin.ts
 * @description Default plugin definitions for the system
 */


//import type { PluginDefinition, WorkingCopyProperties } from './plugin';

//const defaultEntityHandler = new DefaultEntityHandler();

/**
 * Folder plugin definition
 */
export const folderPlugin: PluginDefinition = {
  nodeType: 'folder' as NodeType,
  name: 'Folder',
  displayName: 'Folder',
  icon: {
    muiIconName: 'Folder',
    emoji: '📁',
    color: '#ffa726',
  },
  category: {
    treeId: '*',
    menuGroup: 'basic',
    createOrder: 1,
  },
  database: {
    dbName: 'CoreDB',
    schema: { folders: '&id, nodeId, name, description, createdAt, updatedAt, version' },
    version: 1,
  },
  priority: 0,
};

/**
 * BaseMap plugin definition
 */
export const basemapPlugin: PluginDefinition = {
  nodeType: 'basemap' as NodeType,
  name: 'BaseMap',
  displayName: 'Base Map',
  icon: {
    muiIconName: 'Map',
    emoji: '🗺️',
    color: '#1976d2',
  },
  category: {
    treeId: '*',
    menuGroup: 'document',
    createOrder: 10,
  },
  database: {
    dbName: 'CoreDB',
    schema: { basemaps: '&id, nodeId, name, mapConfig, createdAt, updatedAt, version' },
    version: 1,
  },
  priority: 10,
};

/**
 * Spreadsheet plugin definition
 */
export const spreadsheetPlugin: PluginDefinition = {
  nodeType: 'spreadsheet' as NodeType,
  name: 'Spreadsheet',
  displayName: 'Spreadsheet',
  icon: {
    muiIconName: 'TableChart',
    emoji: '📊',
    color: '#4caf50',
  },
  category: {
    treeId: '*',
    menuGroup: 'document',
    createOrder: 25,
  },
  database: {
    dbName: 'CoreDB',
    schema: { spreadsheets: '&id, nodeId, name, data, createdAt, updatedAt, version' },
    version: 1,
  },
  priority: 20,
};

/**
 * Styler plugin definition
 */
export const stylerPlugin: PluginDefinition = {
  nodeType: 'styler' as NodeType,
  name: 'Styler',
  displayName: 'Style Map',
  icon: {
    muiIconName: 'Palette',
    emoji: '🎨',
    color: '#9c27b0',
  },
  category: {
    treeId: '*',
    menuGroup: 'document',
    createOrder: 20,
  },
  database: {
    dbName: 'CoreDB',
    schema: { stylers: '&id, nodeId, name, styleRules, createdAt, updatedAt, version' },
    version: 1,
  },
  priority: 30,
};

/**
 * Shape plugin definition
 */
export const shapePlugin: PluginDefinition = {
  nodeType: 'shape' as NodeType,
  name: 'Shape',
  displayName: 'Geographic Shape',
  icon: {
    muiIconName: 'Layers',
    emoji: '🌍',
    color: '#ff5722',
  },
  category: {
    treeId: '*',
    menuGroup: 'advanced',
    createOrder: 30,
  },
  database: {
    dbName: 'CoreDB',
    schema: { shapes: '&id, nodeId, name, geoData, createdAt, updatedAt, version' },
    version: 1,
  },
  priority: 40,
};

/**
 * Resolver plugin definition
 */
export const resolverPlugin: PluginDefinition = {
  nodeType: 'resolver' as NodeType,
  name: 'Resolver',
  displayName: 'Resolver',
  icon: {
    muiIconName: 'Transform',
    emoji: '🔄',
    color: '#9c27b0',
  },
  category: {
    treeId: '*',
    menuGroup: 'advanced',
    createOrder: 100,
  },
  database: {
    dbName: 'ResolverDB',
    schema: {
      resolvers:
        '&id, nodeId, name, sourceSchema, targetSchema, mappingRules, createdAt, updatedAt, version',
    },
    version: 1,
  },
  priority: 99,
};

/**
 * Project plugin definition
 */
export const projectPlugin: PluginDefinition = {
  nodeType: 'project' as NodeType,
  name: 'Project',
  displayName: 'Project',
  icon: {
    muiIconName: 'Extension',
    emoji: '📋',
    color: '#00bcd4',
  },
  category: {
    treeId: '*',
    menuGroup: 'container',
    createOrder: 5,
  },
  database: {
    dbName: 'CoreDB',
    schema: { projects: '&id, nodeId, name, description, status, createdAt, updatedAt, version' },
    version: 1,
  },
  priority: 100,
};

/**
 * Get all default plugins
 */
export function getDefaultPlugins(): PluginDefinition[] {
  return [
    folderPlugin,
    basemapPlugin,
    spreadsheetPlugin,
    stylerPlugin,
    shapePlugin,
    //locationPlugin,
    //routePlugin,
    propertyResolverPlugin,
    projectPlugin,
  ];
}

/**
 * Register all default plugins to a registry
 */
export function registerDefaultPlugins(registry: {
  registerPlugin: (definition: PluginDefinition) => void;
}): void {
  const plugins = getDefaultPlugins();
  for (const plugin of plugins) {
    registry.registerPlugin(plugin);
  }
}
