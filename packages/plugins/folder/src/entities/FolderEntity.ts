/**
 * Folder Entity Definitions
 * 6分類エンティティシステム対応
 * 
 * FolderはTreeNodeそのものに近い存在だが、
 * フォルダ固有のメタデータや設定を管理するためのエンティティを定義
 */

import type { 
  NodeId,
  PeerEntity,
  GroupEntity,
  Timestamp
} from '@hierarchidb/00-core';

/**
 * FolderEntity - フォルダのメタデータ（PeerEntity）
 * TreeNodeと1:1対応で、フォルダ固有の設定を保持
 */
export interface FolderEntity extends PeerEntity {
  nodeId: NodeId;
  
  // フォルダ基本情報
  name: string;
  description?: string;
  
  // フォルダ設定
  settings?: {
    // 表示設定
    displayOptions?: {
      iconColor?: string;
      iconType?: 'default' | 'custom';
      customIcon?: string;
      sortOrder?: 'name' | 'date' | 'type' | 'custom';
      sortDirection?: 'asc' | 'desc';
      viewMode?: 'list' | 'grid' | 'tree';
    };
    
    // アクセス制御
    permissions?: {
      isPublic?: boolean;
      isReadOnly?: boolean;
      allowedUsers?: string[];
      deniedUsers?: string[];
    };
    
    // フォルダルール
    rules?: {
      maxChildren?: number;
      allowedChildTypes?: string[];
      autoArchiveAfterDays?: number;
      requireApprovalForChanges?: boolean;
    };
  };
  
  // フォルダ統計
  statistics?: {
    childCount: number;
    descendantCount: number;
    totalSize?: number;
    lastAccessedAt?: Timestamp;
    accessCount?: number;
  };
  
  // メタデータ
  tags?: string[];
  metadata?: Record<string, any>;
  
  // タイムスタンプ（PeerEntityから継承）
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}

/**
 * FolderBookmark - フォルダのブックマーク（GroupEntity）
 * ユーザーが頻繁にアクセスするフォルダのブックマーク
 */
export interface FolderBookmark extends GroupEntity {
  nodeId: NodeId; // ブックマークを持つユーザーのルートノード
  groupId: string;
  
  // ブックマーク情報
  targetFolderId: NodeId; // ブックマーク対象のフォルダ
  label: string; // ユーザーが付けた名前
  color?: string; // 視覚的な識別用の色
  icon?: string; // カスタムアイコン
  
  // 使用統計
  accessCount: number;
  lastAccessedAt?: Timestamp;
  
  // 並び順
  sortOrder: number;
  
  // タイムスタンプ（GroupEntityから継承）
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * FolderTemplate - フォルダテンプレート（GroupEntity）
 * よく使うフォルダ構造のテンプレート
 */
export interface FolderTemplate extends GroupEntity {
  nodeId: NodeId; // テンプレートを所有するノード
  groupId: string;
  
  // テンプレート情報
  templateName: string;
  templateDescription?: string;
  
  // フォルダ構造定義
  structure: FolderStructureNode;
  
  // 使用統計
  usageCount: number;
  lastUsedAt?: Timestamp;
  
  // カテゴリと並び順
  category?: string;
  sortOrder: number;
  
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
  settings?: FolderEntity['settings'];
  children?: FolderStructureNode[];
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
  tags?: string[];
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