/**
 * @file default-plugin.ts
 * @description Default plugin definitions for the system
 */

import type { 
  NodeId, 
  NodeType, 
  DatabaseSchema 
} from '@hierarchidb/common-type';
import type { PluginDefinition, PeerEntity, GroupEntity, WorkingCopyProperties } from './plugin';
import { BaseEntityHandler } from '../handlers';

// Basic working entity handler for default plugins
class DefaultEntityHandler extends BaseEntityHandler<
  PeerEntity,
  PeerEntity & WorkingCopyProperties,
  Partial<PeerEntity>,
  any
> {
  protected table: any = null;
  
  constructor() {
    super();
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

  protected buildEntity(nodeId: NodeId, entityId: any, data: Partial<PeerEntity>): PeerEntity {
    return {
      id: entityId,
      nodeId,
      createdAt: Date.now() as any,
      updatedAt: Date.now() as any,
      version: 1,
      ...data
    };
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
    schema: {
      folders: '&id, nodeId, name, description, createdAt, updatedAt, version'
    },
    version: 1,
  },
  entityHandler: defaultEntityHandler,
  version: "1.0.0",
  dependencies: [],
  priority: 0,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
};

/**
 * BaseMap plugin definition
 */
export const basemapPlugin: PluginDefinition<
  PeerEntity,
  GroupEntity,
  PeerEntity & WorkingCopyProperties
> = {
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
    schema: {
      basemaps: '&id, nodeId, name, mapConfig, createdAt, updatedAt, version'
    },
    version: 1,
  },
  entityHandler: defaultEntityHandler,
  version: "1.0.0",
  dependencies: [],
  priority: 0,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
};

/**
 * StyleMap plugin definition
 */
export const stylemapPlugin: PluginDefinition<
  PeerEntity,
  GroupEntity,
  PeerEntity & WorkingCopyProperties
> = {
  nodeType: 'stylemap' as NodeType,
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
    schema: {
      stylemaps: '&id, nodeId, name, styleRules, createdAt, updatedAt, version'
    },
    version: 1,
  },
  entityHandler: defaultEntityHandler,
  version: "1.0.0",
  dependencies: [],
  priority: 0,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
};

/**
 * Shape plugin definition
 */
export const shapePlugin: PluginDefinition<
  PeerEntity,
  GroupEntity,
  PeerEntity & WorkingCopyProperties
> = {
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
    schema: {
      shapes: '&id, nodeId, name, geoData, createdAt, updatedAt, version'
    },
    version: 1,
  },
  entityHandler: defaultEntityHandler,
  version: "1.0.0",
  dependencies: [],
  priority: 0,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
};

/**
 * Project plugin definition
 */
export const projectPlugin: PluginDefinition<
  PeerEntity,
  GroupEntity,
  PeerEntity & WorkingCopyProperties
> = {
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
    schema: {
      projects: '&id, nodeId, name, description, status, createdAt, updatedAt, version'
    },
    version: 1,
  },
  entityHandler: defaultEntityHandler,
  version: "1.0.0",
  dependencies: [],
  priority: 0,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
};

/**
 * Note/Document plugin definition
 */
export const notePlugin: PluginDefinition<
  PeerEntity,
  GroupEntity,
  PeerEntity & WorkingCopyProperties
> = {
  nodeType: 'note' as NodeType,
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
    schema: {
      notes: '&id, nodeId, name, content, createdAt, updatedAt, version'
    },
    version: 1,
  },
  entityHandler: defaultEntityHandler,
  version: "1.0.0",
  dependencies: [],
  priority: 0,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
};

/**
 * Spreadsheet plugin definition
 */
export const spreadsheetPlugin: PluginDefinition<
  PeerEntity,
  GroupEntity,
  PeerEntity & WorkingCopyProperties
> = {
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
    schema: {
      spreadsheets: '&id, nodeId, name, data, createdAt, updatedAt, version'
    },
    version: 1,
  },
  entityHandler: defaultEntityHandler,
  version: "1.0.0",
  dependencies: [],
  priority: 0,
  routing: {
    actions: {},
    defaultAction: undefined,
  },
};

/**
 * PropertyResolver plugin definition
 */
export const propertyResolverPlugin: PluginDefinition<
  PeerEntity,
  GroupEntity,
  PeerEntity & WorkingCopyProperties
> = {
  nodeType: 'propertyresolver' as NodeType,
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
    schema: {
      propertyResolvers: '&id, nodeId, name, sourceSchema, targetSchema, mappingRules, createdAt, updatedAt, version'
    },
    version: 1,
  },
  entityHandler: defaultEntityHandler,
  version: "1.0.0",
  dependencies: [],
  priority: 0,
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
