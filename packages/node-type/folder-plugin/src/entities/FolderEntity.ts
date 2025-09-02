/**
 * Folder Entity Definitions
 * 6分類エンティティシステム対応
 *
 * FolderはTreeNodeそのものに近い存在だが、
 * フォルダ固有のメタデータや設定を管理するためのエンティティを定義
 */

import type { NodeId, EntityId, PeerEntity, Timestamp } from '@hierarchidb/common-type';

/**
 * FolderEntity - フォルダのメタデータ（PeerEntity）
 * TreeNodeと1:1対応で、フォルダ固有の設定を保持
 */
export interface FolderSettings {
  allowNestedFolders: boolean;
  maxDepth: number;
  sortOrder: 'name' | 'date' | 'size';
}

export interface FolderEntity extends PeerEntity {
  id: EntityId;
  nodeId: NodeId;
  name?: string;
  description?: string;
  category?: string;
  settings?: FolderSettings;
  tags?: EntityId[];
}

/**
 * フォルダ操作の結果
 */
export interface FolderOperationResult {
  success: boolean;
  folderId?: NodeId;
  message?: string;
  error?: Error;
  affectedCount?: number;
}

/**
 * フォルダ検索クエリ
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
export interface FolderBookmark {
  id: EntityId;
  folderId: NodeId;
  label?: string;
  name?: string;
  url?: string;
  createdAt: Timestamp;
}

export interface FolderTemplate {
  id: EntityId;
  folderId: NodeId;
  name: string;
  description?: string;
  createdAt: Timestamp;
  content?: Record<string, unknown>;
  type?: string;
}

export type FolderWorkingCopy = FolderEntity & { workingCopyId: EntityId };

export interface FolderStatsSummary {
  totalFolders: number;
  totalBookmarks: number;
  totalTemplates: number;
}

export interface FolderStructureNode {
  nodeId: NodeId;
  name: string;
  children?: FolderStructureNode[];
}
