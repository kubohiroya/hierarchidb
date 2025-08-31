import type { PluginDefinition, NodeId } from '@hierarchidb/common-type';
import type { PropertyResolverEntity, PropertyResolverWorkingCopy } from '../types';
import { PropertyResolverEntityHandler } from '../handlers/PropertyResolverEntityHandler';

export const PropertyResolverDefinition: Partial<
  PluginDefinition<
    PropertyResolverEntity,
    never, // No sub-entities
    PropertyResolverWorkingCopy
  >
> = {
  nodeType: 'propertyresolver-plugin',
  name: 'PropertyResolver',
  displayName: 'Property Resolver',

  category: {
    treeId: '*' as any, // Available in all trees
    menuGroup: 'advanced',
    createOrder: 100,
  },

  database: {
    entityStore: 'propertyResolvers',
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

  entityHandler: new PropertyResolverEntityHandler(),

  lifecycle: {
    afterCreate: async (node, context) => {
      console.log(`PropertyResolver node created: ${node.id}`);
    },

    beforeDelete: async (node, context) => {
      console.log(`PropertyResolver node deleting: ${node.id}`);
    },
  },

  ui: {
    // These will be set by the UI plugin registration
    dialogComponent: null,
    panelComponent: null,
  },
};
