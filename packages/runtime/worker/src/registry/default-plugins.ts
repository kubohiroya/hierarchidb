/**

 * @file default-plugin.ts
 * @description Default plugin definitions for the system
 */

import type { PluginDefinition, PeerEntity, GroupEntity, WorkingCopyProperties, NodeId, NodeType, DatabaseSchema } from './plugin';
import { BaseEntityHandler } from '../handlers';

// Basic working entity handler for default plugins
class DefaultEntityHandler extends BaseEntityHandler<
  PeerEntity,
  GroupEntity,
  PeerEntity & WorkingCopyProperties
> {
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
export const folderPlugin: PluginDefinition<
  PeerEntity,
  GroupEntity,
  PeerEntity & WorkingCopyProperties
> = {
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
    schema: '&id, nodeId, name, createdAt, updatedAt, version' as unknown as DatabaseSchema,
    version: 1,
  },
  meta: {
    id: 'folder-plugin-plugin',
    name: 'Folder',
    nodeType: 'folder' as NodeType,
    status: 'active',
    version: '1.0.0',
    tags: ['container', 'basic'],
  },
  entityHandler: defaultEntityHandler,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
  version: '1.0.0',
  dependencies: [],
  priority: 100,
};

/**
 * BaseMap plugin definition
 */
export const basemapPlugin: PluginDefinition<
  PeerEntity,
  GroupEntity,
  PeerEntity & WorkingCopyProperties
> = {
  nodeType: '$1' as NodeType,
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
    schema: '&id, nodeId, name, createdAt, updatedAt, version' as unknown as DatabaseSchema,
    version: 1,
  },
  meta: {
    id: 'basemap-plugin',
    name: 'BaseMap',
    nodeType: '$1' as NodeType,
    status: 'active',
    version: '1.0.0',
    tags: ['map', 'visualization'],
  },
  entityHandler: defaultEntityHandler,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
  version: '1.0.0',
  dependencies: [],
  priority: 100,
};

/**
 * StyleMap plugin definition
 */
export const stylemapPlugin: PluginDefinition<
  PeerEntity,
  GroupEntity,
  PeerEntity & WorkingCopyProperties
> = {
  nodeType: '$1' as NodeType,
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
    schema: '&id, nodeId, name, createdAt, updatedAt, version' as unknown as DatabaseSchema,
    version: 1,
  },
  meta: {
    id: 'stylemap-plugin-plugin',
    name: 'StyleMap',
    nodeType: '$1' as NodeType,
    status: 'active',
    version: '1.0.0',
    tags: ['styling', 'visualization'],
  },
  entityHandler: defaultEntityHandler,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
  version: '1.0.0',
  dependencies: [],
  priority: 100,
};

/**
 * Shape plugin definition
 */
export const shapePlugin: PluginDefinition<
  PeerEntity,
  GroupEntity,
  PeerEntity & WorkingCopyProperties
> = {
  nodeType: '$1' as NodeType,
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
    schema: '&id, nodeId, name, createdAt, updatedAt, version' as unknown as DatabaseSchema,
    version: 1,
  },
  meta: {
    id: 'shape-plugin-plugin',
    name: 'Shape',
    nodeType: '$1' as NodeType,
    status: 'active',
    version: '1.0.0',
    tags: ['geography', 'boundaries'],
  },
  entityHandler: defaultEntityHandler,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
  version: '1.0.0',
  dependencies: [],
  priority: 100,
};

/**
 * Project plugin definition
 */
export const projectPlugin: PluginDefinition<
  PeerEntity,
  GroupEntity,
  PeerEntity & WorkingCopyProperties
> = {
  nodeType: '$1' as NodeType,
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
    schema: '&id, nodeId, name, createdAt, updatedAt, version' as unknown as DatabaseSchema,
    version: 1,
  },
  meta: {
    id: 'project-plugin',
    name: 'Project',
    nodeType: '$1' as NodeType,
    status: 'active',
    version: '1.0.0',
    tags: ['container', 'project-management'],
  },
  entityHandler: defaultEntityHandler,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
  version: '1.0.0',
  dependencies: [],
  priority: 100,
};

/**
 * Note/Document plugin definition
 */
export const notePlugin: PluginDefinition<
  PeerEntity,
  GroupEntity,
  PeerEntity & WorkingCopyProperties
> = {
  nodeType: '$1' as NodeType,
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
    schema: '&id, nodeId, name, createdAt, updatedAt, version' as unknown as DatabaseSchema,
    version: 1,
  },
  meta: {
    id: 'note-plugin',
    name: 'Note',
    nodeType: '$1' as NodeType,
    status: 'active',
    version: '1.0.0',
    tags: ['document', 'text'],
  },
  entityHandler: defaultEntityHandler,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
  version: '1.0.0',
  dependencies: [],
  priority: 100,
};

/**
 * Spreadsheet plugin definition
 */
export const spreadsheetPlugin: PluginDefinition<
  PeerEntity,
  GroupEntity,
  PeerEntity & WorkingCopyProperties
> = {
  nodeType: '$1' as NodeType,
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
    schema: '&id, nodeId, name, createdAt, updatedAt, version' as unknown as DatabaseSchema,
    version: 1,
  },
  meta: {
    id: 'spreadsheet-plugin-plugin',
    name: 'Spreadsheet',
    nodeType: '$1' as NodeType,
    status: 'active',
    version: '1.0.0',
    tags: ['data', 'table'],
  },
  entityHandler: defaultEntityHandler,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
  version: '1.0.0',
  dependencies: [],
  priority: 100,
};

/**
 * PropertyResolver plugin definition
 */
export const propertyResolverPlugin: PluginDefinition<
  PeerEntity,
  GroupEntity,
  PeerEntity & WorkingCopyProperties
> = {
  nodeType: '$1' as NodeType,
  name: 'PropertyResolver',
  displayName: 'Property Resolver',
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
    dbName: 'PropertyResolverDB',
    schema: '&id, nodeId, name, createdAt, updatedAt, version' as unknown as DatabaseSchema,
    version: 1,
  },
  meta: {
    id: 'propertyresolver-plugin',
    name: 'PropertyResolver',
    nodeType: '$1' as NodeType,
    status: 'active',
    version: '1.0.0',
    tags: ['mapping', 'transformation', 'schema'],
  },
  entityHandler: defaultEntityHandler,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
  version: '1.0.0',
  dependencies: [],
  priority: 100,
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
    propertyResolverPlugin,
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
