import type { PluginDefinition, NodeType, TreeId } from '@hierarchidb/common-type';

// Main plugin definition
export const ProjectPluginDefinition: PluginDefinition = {
  nodeType: 'project' as NodeType,
  name: 'project-plugin',
  displayName: 'Project',
  version: '0.0.1',
  dependencies: [],
  priority: 0,
  category: {
    treeId: '*' as TreeId | '*',
    menuGroup: 'document',
  },

  database: {
    dbName: 'project-db',
    schema: {
      projects: '&id, nodeId, type, name, category, [category+name], createdAt, updatedAt',
    },
    version: 1,
  },

  // entityHandler is not part of PluginDefinition
  // It should be registered separately with the plugin registry
  icon: {
    emoji: '🗺️',
  },

  ui: {
    dialogComponentPath: './components/wizard/ProjectWizard',
    panelComponentPath: './components/map/ProjectMapView',
  },

  validation: {
    maxChildren: 1000,
  },
};
