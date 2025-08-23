/**
 * Plugin metadata - UI/Worker共通で参照
 */

import type { PluginMetadata } from '@hierarchidb/00-core';

export const ProjectMetadata: PluginMetadata = {
  id: 'project',
  nodeType: 'project',
  name: 'Map Project',
  description: 'Create and manage map composition projects with multiple resource layers',
  version: '1.0.0',
  author: 'HierarchiDB Team',
  status: 'active',
  tags: ['map', 'composition', 'layers', 'visualization'],
  capabilities: {
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: true,
    supportsChildren: false,
    supportedOperations: ['create', 'read', 'update', 'delete']
  }
};