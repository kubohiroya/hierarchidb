/**
 * BaseMap plugin metadata - shared between UI and Worker layers
 */

import type { PluginMetadata } from '@hierarchidb/common-core';

export const BaseMapMetadata: PluginMetadata = {
  id: 'com.hierarchidb.basemap',
  name: 'Base Map',
  nodeType: 'basemap',
  version: '1.0.0',
  description: 'Base map configuration and tile management for geographic visualization',
  author: 'HierarchiDB Team',
  status: 'active',
  tags: ['mapping', 'visualization', 'gis'],
  dependencies: [],
};