/**
 * TreeConsole APIアダプター 型定義
 * 
 * 新旧API変換に特化した型定義を提供します。
 * 既存TreeConsole実装のコールバック形式と新しいObservable形式の橋渡しを行います。
 */

import type { WorkerAPI } from '@hierarchidb/api';
import type { 
  UUID, 
  TreeNodeId,
  OnNameConflict,
  // Timestamp // Removed - unused
} from '@hierarchidb/core';

/**
 * 既存コードのコールバック形式（移植元のパターン）
 */
export type LegacyCallback<T> = (data: T) => void;

/**
 * 既存コードのサブスクリプション解除関数
 */
export type LegacyUnsubscribe = () => void;

/**
 * アダプターの実行コンテキスト
 * 各API呼び出しで共有される設定情報
 */
export interface AdapterContext {
  /** 呼び出し元のビューID（TreeConsoleコンポーネントのインスタンス識別） */
  viewId: string;
  /** コマンドグループID（関連する操作をグループ化） */
  groupId: UUID;
  /** 名前衝突時の処理方針 */
  onNameConflict: OnNameConflict;
}

/**
 * コマンド実行時のオプション
 */
export interface CommandAdapterOptions {
  /** 実行コンテキスト */
  context: AdapterContext;
  /** リトライ設定（将来的な拡張用） */
  retryConfig?: {
    maxAttempts: number;
    delayMs: number;
  };
}

/**
 * アダプター初期化用の設定
 */
export interface WorkerAPIAdapterConfig {
  /** WorkerAPI インスタンス */
  workerAPI: WorkerAPI;
  /** デフォルトのビューID */
  defaultViewId: string;
  /** デフォルトの名前衝突処理 */
  defaultOnNameConflict?: OnNameConflict;
}

/**
 * ツリー変更イベントの既存形式（移植元で使用されていた形式）
 * 実際の変換時に既存コードを確認して詳細化する予定
 */
export interface LegacyExpandedStateChanges {
  // TODO: 実装時に既存TreeConsoleコードから抽出
  nodeId: TreeNodeId;
  expanded: boolean;
  // その他のプロパティは既存コード確認後に追加
}

export interface LegacySubTreeChanges {
  // TODO: 実装時に既存TreeConsoleコードから抽出  
  type: 'node-created' | 'node-updated' | 'node-deleted';
  nodeId: TreeNodeId;
  // その他のプロパティは既存コード確認後に追加
}

/**
 * エラーハンドリング用の型
 */
export class TreeConsoleAdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'TreeConsoleAdapterError';
  }
}