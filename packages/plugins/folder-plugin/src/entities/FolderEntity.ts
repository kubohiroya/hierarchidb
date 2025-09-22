/**
 * Folder types (TreeNode alias)
 *
 * This file used to define a separate FolderEntity for a plugin-local DB.
 * As of 2025-09-11, folders are represented directly by Core TreeNode.
 * The types below alias to TreeNode and keep auxiliary types for UI/API.
 */

import type { NodeId, TreeNode, Timestamp } from '@hierarchidb/common-type';

// Primary entity alias: treat Folder as Core TreeNode
export type FolderEntity = TreeNode;

// Operation result used by some UI/APIs
export interface FolderOperationResult {
  success: boolean;
  folderId?: NodeId;
  message?: string;
  error?: Error;
  affectedCount?: number;
}

// Search query shape for folder UIs
export interface FolderSearchQuery {
  name?: string;
  parentId?: NodeId;
  hasChildren?: boolean;
  createdAfter?: Timestamp;
  createdBefore?: Timestamp;
  modifiedAfter?: Timestamp;
  modifiedBefore?: Timestamp;
  sortBy?: 'name' | 'date' | 'size';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface FolderStatsSummary {
  totalFolders: number;
}

export interface FolderStructureNode {
  nodeId: NodeId;
  name: string;
  children?: FolderStructureNode[];
}
