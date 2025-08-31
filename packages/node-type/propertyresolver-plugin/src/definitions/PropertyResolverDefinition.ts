import type { PluginDefinition, NodeType } from '@hierarchidb/common-type';

export const PropertyResolverDefinition: Partial<PluginDefinition> = {
  nodeType: 'propertyresolver-plugin' as NodeType,
  name: 'PropertyResolver',
  displayName: 'Property Resolver',

  category: {
    treeId: '*' as any, // Available in all trees
    menuGroup: 'advanced',
    createOrder: 100,
  },

  database: {
    dbName: 'propertyResolvers',
    schema: {
      '&id': 'EntityId',
      nodeId: 'NodeId',
      name: '',
      sourceSchema: '',
      targetSchema: '',
      createdAt: '',
      updatedAt: '',
      version: '',
    },
    version: 1,
  },

  ui: {
    // These will be set by the UI plugin registration
    dialogComponentPath: undefined,
    panelComponentPath: undefined,
  },
};
