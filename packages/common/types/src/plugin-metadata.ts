/**
 * @file plugin-metadata.ts
 * @description Plugin metadata type definitions
 */

import type { NodeType } from './id-types';

/**
 * Plugin metadata for runtime management
 */
export interface PluginMetadata {
  id: string;
  name: string;
  nodeType: NodeType;
  status: 'active' | 'inactive' | 'error';
  version: string;
  tags?: string[];
}