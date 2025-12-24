/**
 * Import/Export
 * @module core/types/import-export
 */

import type { NodeId } from './id-types.js';
import type { TreeNode } from './tree-node-types.js';

/**
 */
export interface ImportProgress {
  phase: 'reading' | 'validating' | 'importing-nodes' | 'importing-resources' | 'finalizing';
  current: number;
  total: number;
  message: string;
}

/**
 */
export interface ExportProgress {
  phase: 'collecting-nodes' | 'collecting-resources' | 'creating-archive' | 'finalizing';
  current: number;
  total: number;
  message: string;
}

/**
 */
export interface ImportResult {
  success: boolean;
  importedNodeIds: NodeId[];
  skippedNodes: number;
  errors: string[];
  warnings?: string[];
}

/**
 */
export interface ExportResult {
  success: boolean;
  blob?: Blob;
  exportedNodeCount: number;
  errors: string[];
}

/**
 */
export interface ClipboardData {
  type: 'nodes-copy';
  timestamp: number;
  nodes: Record<string, TreeNode>;
  rootIds: NodeId[];
  nodeCount?: number;
}

// OnNameConflict is already exported from command-types, no need to re-export

/**
 * IDIDID
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export type IdMapping = Map<NodeId, NodeId>;
type GlobalFile = typeof globalThis extends { File: infer F } ? F : never;

export interface FileLike {
  name: string;
  size: number;
  type?: string;
  lastModified?: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export type ImportFileSource = GlobalFile extends never ? FileLike : GlobalFile | FileLike;
