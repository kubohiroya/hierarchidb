/**
 * Folder API interface - UI-Worker通信契約
 */

import { NodeId } from '@hierarchidb/00-core';
import { 
  FolderEntity, 
  CreateFolderData, 
  UpdateFolderData,
  FolderBookmark,
  FolderTemplate,
  FolderStatsSummary,
  FolderSearchQuery
} from './types';

/**
 * Main Folder API interface for UI-Worker communication via PluginRegistry
 */
export interface FolderAPI extends Record<string, (...args: any[]) => Promise<any>> {
  // Core folder operations
  createEntity(nodeId: NodeId, data: CreateFolderData): Promise<FolderEntity>;
  getEntity(nodeId: NodeId): Promise<FolderEntity | undefined>;
  updateEntity(nodeId: NodeId, data: UpdateFolderData): Promise<void>;
  deleteEntity(nodeId: NodeId): Promise<void>;

  // Folder hierarchy operations
  moveFolder(folderNodeId: NodeId, newParentNodeId: NodeId): Promise<void>;
  copyFolder(sourceNodeId: NodeId, targetParentNodeId: NodeId, newName?: string): Promise<FolderEntity>;
  duplicateFolder(folderNodeId: NodeId): Promise<FolderEntity>;

  // Folder settings operations
  updateSettings(nodeId: NodeId, settings: FolderEntity['settings']): Promise<void>;
  getSettings(nodeId: NodeId): Promise<FolderEntity['settings'] | undefined>;
  resetSettings(nodeId: NodeId): Promise<void>;

  // Folder statistics operations
  getStatistics(nodeId: NodeId): Promise<FolderEntity['statistics'] | undefined>;
  refreshStatistics(nodeId: NodeId): Promise<FolderEntity['statistics']>;
  getStatsSummary(nodeId: NodeId): Promise<FolderStatsSummary>;

  // Folder search operations
  searchFolders(query: FolderSearchQuery): Promise<FolderSearchResult>;
  findSimilarFolders(nodeId: NodeId): Promise<FolderEntity[]>;
  getFolderPath(nodeId: NodeId): Promise<FolderPathInfo[]>;

  // Bookmark operations
  createBookmark(userNodeId: NodeId, targetFolderId: NodeId, label: string): Promise<FolderBookmark>;
  updateBookmark(bookmarkId: string, data: Partial<FolderBookmark>): Promise<void>;
  deleteBookmark(bookmarkId: string): Promise<void>;
  getBookmarks(userNodeId: NodeId): Promise<FolderBookmark[]>;

  // Template operations
  createTemplate(nodeId: NodeId, name: string, description?: string): Promise<FolderTemplate>;
  applyTemplate(templateId: string, targetParentNodeId: NodeId): Promise<FolderApplyTemplateResult>;
  updateTemplate(templateId: string, data: Partial<FolderTemplate>): Promise<void>;
  deleteTemplate(templateId: string): Promise<void>;
  getTemplates(nodeId: NodeId): Promise<FolderTemplate[]>;

  // Batch operations
  bulkMove(folderNodeIds: NodeId[], newParentNodeId: NodeId): Promise<BulkOperationResult>;
  bulkDelete(folderNodeIds: NodeId[]): Promise<BulkOperationResult>;
  bulkUpdateSettings(folderNodeIds: NodeId[], settings: Partial<FolderEntity['settings']>): Promise<BulkOperationResult>;

  // Access control operations
  checkPermission(nodeId: NodeId, userId: string, operation: FolderOperation): Promise<boolean>;
  updatePermissions(nodeId: NodeId, permissions: NonNullable<FolderEntity['settings']>['permissions']): Promise<void>;
  getEffectivePermissions(nodeId: NodeId, userId: string): Promise<EffectivePermissions>;
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
export interface FolderApplyTemplateResult {
  success: boolean;
  createdFolders: FolderEntity[];
  rootFolder: FolderEntity;
  errors: string[];
  warnings: string[];
}

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