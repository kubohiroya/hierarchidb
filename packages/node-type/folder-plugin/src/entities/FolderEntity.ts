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
export interface FolderEntity extends PeerEntity {
  id: EntityId; // Add explicit id field for compatibility
  nodeId: NodeId;
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
