/**
  * Folder Entity Definitions
 * 6
  * FolderTreeNode
   */

import type { NodeId, Timestamp } from '@hierarchidb/common-type';

/**
  * FolderEntity - PeerEntity
 * TreeNode1:1
  */
export interface FolderSettings {
  allowNestedFolders: boolean;
  maxDepth: number;
  sortOrder: 'name' | 'date' | 'size';
}

export interface FolderEntity {
  id: NodeId;
  nodeId: NodeId;
  name?: string;
  description?: string;
  category?: string;
  settings?: FolderSettings;
  tags?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}

/**
    */
export interface FolderOperationResult {
  success: boolean;
  folderId?: NodeId;
  message?: string;
  error?: Error;
  affectedCount?: number;
}

/**
    */
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

// Additional types re-exported by types/index.ts
export type FolderWorkingCopy = FolderEntity & { workingCopyId: NodeId };

export interface FolderStatsSummary {
  totalFolders: number;
}

export interface FolderStructureNode {
  nodeId: NodeId;
  name: string;
  children?: FolderStructureNode[];
}
