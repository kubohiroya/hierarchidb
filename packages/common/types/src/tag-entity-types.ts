/**
 * Tag Entity Types
 * システム全体で使用されるタグ管理のためのエンティティ型定義
 */

import type { NodeId, EntityId } from './id-types';
import type { RelationalEntity } from './entity-types';
import { Timestamp } from './primitive-types';

/**
 * TagEntity - システム全体で使用されるタグ
 * RelationalEntityとして実装し、複数のノードから参照される
 */
export interface TagEntity extends RelationalEntity {
  /** タグの名前（表示名） */
  name: string;

  /** タグの色（16進数カラーコード） */
  color: string;

  /** タグの説明 */
  description?: string;

  /** タグのカテゴリ（システム定義またはユーザー定義） */
  category: 'system' | 'user' | 'auto';

  /** 使用頻度（検索時の順序決定に使用） */
  usageCount: number;
}

/**
 * TagSuggestion - タグ入力時の候補表示用
 */
export interface TagSuggestion {
  id: EntityId;
  name: string;
  color: string;
  usageCount: number;
  description?: string;
}

/**
 * NodeTagAssociation - ノードとタグの関連付け
 * Many-to-Many関係を管理するための中間テーブル
 */
export interface NodeTagAssociation {
  id: EntityId;
  nodeId: NodeId;
  tagId: EntityId;
  assignedAt: Timestamp;
  assignedBy?: string; // ユーザーID（オプション）
}

/**
 * TagUsageStatistics - タグの使用統計
 */
export interface TagUsageStatistics {
  tagId: EntityId;
  totalUsage: number;
  recentUsage: number; // 過去30日間の使用回数
  nodeTypes: Record<string, number>; // ノードタイプ別使用回数
  lastUsedAt: Timestamp;
}

/**
 * TagSearchOptions - タグ検索オプション
 */
export interface TagSearchOptions {
  query?: string;
  category?: 'system' | 'user' | 'auto';
  limit?: number;
  sortBy?: 'name' | 'usageCount' | 'recentUsage';
  sortOrder?: 'asc' | 'desc';
}
