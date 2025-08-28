/**
 * Shape plugin metadata
 */

import type { PluginMetadata } from '@hierarchidb/common-type';

export const ShapeMetadata: PluginMetadata = {
  id: 'shape',
  nodeType: 'shape',
  name: 'Shape',
  description: 'Geographic shape-plugin data management and processing',
  version: '1.0.0',
  author: 'HierarchiDB Team',
  status: 'active'
} as const;