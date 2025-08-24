/**
 * Shape plugin metadata
 */

import type { PluginMetadata } from '@hierarchidb/common-core';

export const ShapeMetadata: PluginMetadata = {
  id: 'shape',
  nodeType: 'shape',
  name: 'Shape',
  description: 'Geographic shape data management and processing',
  version: '1.0.0',
  author: 'HierarchiDB Team',
  status: 'active'
} as const;