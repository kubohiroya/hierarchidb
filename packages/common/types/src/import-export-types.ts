/**
 * Import/Export
 * @module core/types/import-export
 */

import type { NodeId } from './id-types.js';
import type { TreeNode } from './tree-node-types.js';

/**
 * ZIP
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface ImportManifest {
  version: string;
  name: string;
  description: string;
  icon?: string;
  exportDate?: string;
  exportedBy?: string;
  appVersion?: string;
  nodeCount: number;
  resourceTypes: {
    shapes?: number;
    stylers?: number;
    tables?: number;
    basemaps?: number;
  };
  rootNodes?: NodeId[];
}

/**
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface ExportManifest extends ImportManifest {
  exportDate: string;
  exportedBy: string;
  appVersion: string;
}

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
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface ImportOptions {
  targetParentId: NodeId;
  mergeStrategy?: 'skip' | 'replace' | 'rename';
  progressCallback?: (progress: ImportProgress) => void;
}

/**
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface FileImportOptions extends ImportOptions {
  file: ImportFileSource;
}

/**
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface TemplateImportOptions extends ImportOptions {
  templateId: string;
}

/**
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface ExportOptions {
  nodeIds: NodeId[];
  includeResources?: boolean;
  includeVectorTiles?: boolean;
  includeUIStates?: boolean;
  progressCallback?: (progress: ExportProgress) => void;
}

/**
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category?: 'geographic' | 'economic' | 'demographic' | 'environmental' | 'custom';
  tags?: string[];
  previewImage?: string;
  dataSource?: string;
  lastUpdated?: string;
}

/**
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface TreeNodeExportData {
  nodes: Record<NodeId, TreeNode>;
  nodeIds: NodeId[];
  rootIds: NodeId[];
  metadata?: {
    totalCount: number;
    treeDepth: number;
  };
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
