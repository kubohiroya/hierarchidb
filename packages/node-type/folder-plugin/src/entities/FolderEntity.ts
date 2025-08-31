/**
 * Folder Entity Definitions
 * 6分類エンティティシステム対応
 *
 * FolderはTreeNodeそのものに近い存在だが、
 * フォルダ固有のメタデータや設定を管理するためのエンティティを定義
 */

import type {
  NodeId,
  EntityId,
  PeerEntity,
  GroupEntity,
  Timestamp,
} from '@hierarchidb/common-type';

/**
 * FolderEntity - フォルダのメタデータ（PeerEntity）
 * TreeNodeと1:1対応で、フォルダ固有の設定を保持
 */
export interface FolderEntity extends PeerEntity {
  id: EntityId; // Add explicit id field for compatibility
  nodeId: NodeId;

  // フォルダ基本情報
  name: string;
  description?: string;
  category?: string; // カテゴリ追加

  // Simplified settings for compatibility with existing code
  settings?: FolderSettings;

  // フォルダ統計 (for compatibility with shared code)
  statistics?: {
    childCount: number;
    descendantCount: number;
    totalSize?: number;
    lastAccessedAt?: Timestamp;
    accessCount?: number;
  };

  // タイムスタンプ（PeerEntityから継承）
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}

/**
 * Simple FolderSettings for backward compatibility
 */
export interface FolderSettings {
  allowNestedFolders?: boolean;
  maxDepth?: number;
  sortOrder?: 'name' | 'date' | 'type' | 'size';

  // Extended settings from the complex version
  displayOptions?: {
    iconColor?: string;
    iconType?: 'default' | 'custom';
    customIcon?: string;
    sortDirection?: 'asc' | 'desc';
    viewMode?: 'list' | 'grid' | 'tree';
  };

  permissions?: {
    isPublic?: boolean;
    isReadOnly?: boolean;
    allowedUsers?: string[];
    deniedUsers?: string[];
  };

  rules?: {
    maxChildren?: number;
    allowedChildTypes?: string[];
    autoArchiveAfterDays?: number;
    requireApprovalForChanges?: boolean;
  };
}

/**
 * FolderBookmark - フォルダのブックマーク（GroupEntity）
 * ユーザーが頻繁にアクセスするフォルダのブックマーク
 */
export interface FolderBookmark extends GroupEntity {
  id: EntityId; // Add explicit id field
  folderId: EntityId; // Reference to folder-plugin entity (for compatibility with tests)
  nodeId: NodeId; // ブックマークを持つユーザーのルートノード
  groupId: string;

  // ブックマーク情報 - compatible with test expectations
  name: string; // ユーザーが付けた名前
  url: string; // Bookmark URL
  description?: string; // Optional description
  targetFolderId?: NodeId; // ブックマーク対象のフォルダ (optional for compatibility)
  label?: string; // Alternative name (optional)
  color?: string; // 視覚的な識別用の色
  icon?: string; // カスタムアイコン

  // 使用統計
  accessCount?: number;
  lastAccessedAt?: Timestamp;

  // 並び順
  sortOrder?: number;

  // テスト互換性のための追加フィールド
  type: string;
  version: number;

  // タイムスタンプ（GroupEntityから継承）
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * FolderTemplate - フォルダテンプレート（GroupEntity）
 * よく使うフォルダ構造のテンプレート
 */
export interface FolderTemplate extends GroupEntity {
  id: EntityId; // Add explicit id field
  folderId: EntityId; // Reference to folder-plugin entity (for compatibility with tests)
  nodeId: NodeId; // テンプレートを所有するノード
  groupId: string;

  // テンプレート情報 - compatible with test expectations
  name: string; // Template name (for compatibility with tests)
  content: any; // Template content (for compatibility with tests)
  description?: string; // Optional description
  templateName?: string; // Alternative name (optional)
  templateDescription?: string;

  // フォルダ構造定義
  structure?: FolderStructureNode;

  // 使用統計
  usageCount?: number;
  lastUsedAt?: Timestamp;

  // カテゴリと並び順
  category?: string;
  sortOrder?: number;

  // テスト互換性のための追加フィールド
  type: string;
  version: number;

  // タイムスタンプ（GroupEntityから継承）
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * フォルダ構造の定義（テンプレート用）
 */
export interface FolderStructureNode {
  name: string;
  description?: string;
  type: 'folder' | 'file';
  settings?: any; // Simplified to avoid circular reference
  children?: any[]; // Simplified to avoid circular reference
}

/**
 * FolderWorkingCopy - フォルダ編集用のワーキングコピー
 * 編集中の一時的なフォルダ状態
 */
export interface FolderWorkingCopy extends FolderEntity {
  workingCopyId: string;
  workingCopyOf: NodeId;
  copiedAt: Timestamp;
  isDirty: boolean;

  // 編集中の変更追跡
  changes?: {
    renamedFrom?: string;
    movedFrom?: NodeId;
    settingsChanged?: boolean;
    childrenModified?: boolean;
  };

  // 24時間後に自動削除
  expiresAt?: Timestamp;
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

/**
 * フォルダ統計サマリ
 */
export interface FolderStatsSummary {
  totalFolders: number;
  totalFiles: number;
  totalSize: number;
  maxDepth: number;
  averageChildrenPerFolder: number;
  mostRecentlyAccessed: NodeId[];
  mostFrequentlyAccessed: NodeId[];
  largestFolders: Array<{
    folderId: NodeId;
    name: string;
    size: number;
    childCount: number;
  }>;
}
