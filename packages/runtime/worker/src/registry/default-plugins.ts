/**
 * @file default-plugins.ts
 * @description Default plugin definitions for the system
 */

import type { PluginDefinition, PeerEntity, GroupEntity, WorkingCopyProperties } from './plugin';
import { BaseEntityHandler } from '../handlers';
import type { NodeId } from '@hierarchidb/common-core';

// Basic working entity handler for default plugins
class DefaultEntityHandler extends BaseEntityHandler<PeerEntity, GroupEntity, PeerEntity & WorkingCopyProperties> {
  constructor() {
    super(null as any, null as any, null as any);
  }
  
  async createEntity(nodeId: NodeId, data?: Partial<PeerEntity>): Promise<PeerEntity> {
    // Create a basic entity with minimal required fields
    const entity: PeerEntity = {
      id: crypto.randomUUID() as any, // Generate a unique ID
      nodeId,
      createdAt: Date.now() as any,
      updatedAt: Date.now() as any,
      version: 1,
      ...data, // Spread additional data
    };
    
    // In a real implementation, this would save to database
    console.log(`Created entity for node ${nodeId}:`, entity);
    return entity;
  }
  
  async updateEntity(nodeId: NodeId, data: Partial<PeerEntity>): Promise<void> {
    // In a real implementation, this would update the database
    console.log(`Updated entity for node ${nodeId}:`, data);
  }
  
  async deleteEntity(nodeId: NodeId): Promise<void> {
    // In a real implementation, this would delete from database
    console.log(`Deleted entity for node ${nodeId}`);
  }
  
  async getEntity(nodeId: NodeId): Promise<PeerEntity | null> {
    // In a real implementation, this would query the database
    console.log(`Getting entity for node ${nodeId}`);
    return null; // Return null for now as we don't have persistent storage
  }
}

const defaultEntityHandler = new DefaultEntityHandler();

/**
 * Folder plugin definition
 */
export const folderPlugin: PluginDefinition<PeerEntity, GroupEntity, PeerEntity & WorkingCopyProperties> = {
  nodeType: 'folder',
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
    tableName: 'folders',
    schema: '&id, nodeId, name, description, createdAt, updatedAt, version',
    version: 1,
  },
  meta: {
    id: 'folder-plugin-plugin',
    name: 'Folder',
    nodeType: 'folder',
    status: 'active',
    version: '1.0.0',
    tags: ['container', 'basic'],
  },
  entityHandler: defaultEntityHandler,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
};

/**
 * BaseMap plugin definition
 */
export const basemapPlugin: PluginDefinition<PeerEntity, GroupEntity, PeerEntity & WorkingCopyProperties> = {
  nodeType: 'basemap',
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
    tableName: 'basemaps',
    schema: '&id, nodeId, name, mapConfig, createdAt, updatedAt, version',
    version: 1,
  },
  meta: {
    id: 'basemap-plugin',
    name: 'BaseMap',
    nodeType: 'basemap',
    status: 'active',
    version: '1.0.0',
    tags: ['map', 'visualization'],
  },
  entityHandler: defaultEntityHandler,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
};

/**
 * StyleMap plugin definition
 */
export const stylemapPlugin: PluginDefinition<PeerEntity, GroupEntity, PeerEntity & WorkingCopyProperties> = {
  nodeType: 'stylemap',
  name: 'StyleMap',
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
    tableName: 'stylemaps',
    schema: '&id, nodeId, name, styleRules, createdAt, updatedAt, version',
    version: 1,
  },
  meta: {
    id: 'stylemap-plugin-plugin',
    name: 'StyleMap',
    nodeType: 'stylemap',
    status: 'active',
    version: '1.0.0',
    tags: ['styling', 'visualization'],
  },
  entityHandler: defaultEntityHandler,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
};

/**
 * Shape plugin definition
 */
export const shapePlugin: PluginDefinition<PeerEntity, GroupEntity, PeerEntity & WorkingCopyProperties> = {
  nodeType: 'shape',
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
    tableName: 'shapes',
    schema: '&id, nodeId, name, geoData, createdAt, updatedAt, version',
    version: 1,
  },
  meta: {
    id: 'shape-plugin-plugin',
    name: 'Shape',
    nodeType: 'shape',
    status: 'active',
    version: '1.0.0',
    tags: ['geography', 'boundaries'],
  },
  entityHandler: defaultEntityHandler,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
};

/**
 * Project plugin definition
 */
export const projectPlugin: PluginDefinition<PeerEntity, GroupEntity, PeerEntity & WorkingCopyProperties> = {
  nodeType: 'project',
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
    tableName: 'projects',
    schema: '&id, nodeId, name, description, status, createdAt, updatedAt, version',
    version: 1,
  },
  meta: {
    id: 'project-plugin',
    name: 'Project',
    nodeType: 'project',
    status: 'active',
    version: '1.0.0',
    tags: ['container', 'project-management'],
  },
  entityHandler: defaultEntityHandler,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
};

/**
 * Note/Document plugin definition
 */
export const notePlugin: PluginDefinition<PeerEntity, GroupEntity, PeerEntity & WorkingCopyProperties> = {
  nodeType: 'note',
  name: 'Note',
  displayName: 'Note',
  icon: {
    muiIconName: 'Note',
    emoji: '📝',
    color: '#ff9800',
  },
  category: {
    treeId: '*',
    menuGroup: 'document',
    createOrder: 15,
  },
  database: {
    dbName: 'CoreDB',
    tableName: 'notes',
    schema: '&id, nodeId, name, content, createdAt, updatedAt, version',
    version: 1,
  },
  meta: {
    id: 'note-plugin',
    name: 'Note',
    nodeType: 'note',
    status: 'active',
    version: '1.0.0',
    tags: ['document', 'text'],
  },
  entityHandler: defaultEntityHandler,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
};

/**
 * Spreadsheet plugin definition
 */
export const spreadsheetPlugin: PluginDefinition<PeerEntity, GroupEntity, PeerEntity & WorkingCopyProperties> = {
  nodeType: 'spreadsheet',
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
    tableName: 'spreadsheets',
    schema: '&id, nodeId, name, data, createdAt, updatedAt, version',
    version: 1,
  },
  meta: {
    id: 'spreadsheet-plugin-plugin',
    name: 'Spreadsheet',
    nodeType: 'spreadsheet',
    status: 'active',
    version: '1.0.0',
    tags: ['data', 'table'],
  },
  entityHandler: defaultEntityHandler,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
};

/**
 * Get all default plugins
 */
export function getDefaultPlugins(): PluginDefinition[] {
  return [
    folderPlugin,
    basemapPlugin,
    stylemapPlugin,
    shapePlugin,
    projectPlugin,
    notePlugin,
    spreadsheetPlugin,
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