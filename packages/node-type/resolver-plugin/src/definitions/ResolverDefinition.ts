import type { NodeType, PluginDefinition } from '@hierarchidb/common-type';

export const ResolverDefinition: Partial<PluginDefinition> = {
  nodeType: 'resolver' as NodeType,
  name: 'Resolver',
  displayName: 'Property Resolver',

  category: {
    treeId: '*' as any, // Available in all trees
    menuGroup: 'advanced',
    createOrder: 100,
  },

  database: {
    dbName: 'resolver-db',
    schema: {
      '&id': 'NodeId',
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
