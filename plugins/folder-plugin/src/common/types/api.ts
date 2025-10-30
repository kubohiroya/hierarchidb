/**
  * Folder API interface - UI-Worker
  */

import type { NodeId } from '@hierarchidb/common-types';
import type { CreateFolderData, FolderEntity, FolderSearchQuery, UpdateFolderData } from './types.ts';

/**
 * Main Folder API interface for UI-Worker communication via PluginRegistryImpl
 */
export interface FolderAPI {
  // Core folder-plugin operations
  createEntity(nodeId: NodeId, data: CreateFolderData): Promise<FolderEntity>;

  getEntity(nodeId: NodeId): Promise<FolderEntity | undefined>;

  updateEntity(nodeId: NodeId, data: UpdateFolderData): Promise<void>;

  deleteEntity(nodeId: NodeId): Promise<void>;

  // Folder hierarchy operations
  moveFolder(folderNodeId: NodeId, newParentNodeId: NodeId): Promise<void>;

  copyFolder(
    sourceNodeId: NodeId,
    targetParentNodeId: NodeId,
    newName?: string,
  ): Promise<FolderEntity>;

  duplicateFolder(folderNodeId: NodeId): Promise<FolderEntity>;

  // Folder search operations
  searchFolders(query: FolderSearchQuery): Promise<FolderSearchResult>;

  findSimilarFolders(nodeId: NodeId): Promise<FolderEntity[]>;

  getFolderPath(nodeId: NodeId): Promise<FolderPathInfo[]>;

  // Batch operations
  bulkMove(folderNodeIds: NodeId[], newParentNodeId: NodeId): Promise<BulkOperationResult>;

  bulkDelete(folderNodeIds: NodeId[]): Promise<BulkOperationResult>;

  bulkUpdateSettings(
    folderNodeIds: NodeId[],
    settings: Partial<FolderEntity>,
  ): Promise<BulkOperationResult>;
}

/**
 * Search result types
 */
export interface FolderSearchResult {
  folders: FolderEntity[];
  totalCount: number;
  hasMore: boolean;
  nextOffset?: number;
  searchTime: number;
  query: FolderSearchQuery;
}

export interface FolderPathInfo {
  nodeId: NodeId;
  name: string;
  isRoot: boolean;
  depth: number;
}

/**
 * Template application result
 */

// Template application result removed

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  success: boolean;
  processedCount: number;
  successCount: number;
  failureCount: number;
  errors: Array<{
    nodeId: NodeId;
    error: string;
  }>;
  warnings: string[];
}

/**
 * Permission types
 */
export type FolderOperation =
  | 'read'
  | 'write'
  | 'delete'
  | 'move'
  | 'create_child'
  | 'modify_permissions'
  | 'access_statistics';

export interface EffectivePermissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canMove: boolean;
  canCreateChild: boolean;
  canModifyPermissions: boolean;
  canAccessStatistics: boolean;
  inheritedFrom?: NodeId;
  explicitDeny?: boolean;
  reason?: string;
}

/**
 * Validation result types
 */
export interface FolderValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FolderMoveValidationResult extends FolderValidationResult {
  wouldCreateCycle: boolean;
  targetExists: boolean;
  permissionDenied: boolean;
  exceedsMaxDepth: boolean;
}

/**
 * Folder analytics types
 */
export interface FolderAnalytics {
  nodeId: NodeId;
  accessCount: number;
  lastAccessedAt: number;
  averageChildrenCount: number;
  maxDepth: number;
  totalSize: number;
  growthRate: number;
  popularChildren: Array<{
    nodeId: NodeId;
    name: string;
    accessCount: number;
  }>;
  accessPattern: Array<{
    date: string;
    accessCount: number;
  }>;
}
