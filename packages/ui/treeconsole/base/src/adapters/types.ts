/**
 * TreeConsole APIアダプター 型定義
 *
 * 新旧API変換に特化した型定義を提供します。
 * 既存TreeConsole実装のコールバック形式と新しいObservable形式の橋渡しを行います。
 */

import type { WorkerAPI } from '@hierarchidb/common-api';
import type {
  NodeId,
  TreeNode,
  TreeChangeEvent,
  TreeChangeEventType,
  // OnNameConflict, // Removed - using local function type instead
  // Timestamp // Removed - unused
} from '@hierarchidb/common-core';

/**
 * WorkerAPIベースのコールバック形式
 */
export type TreeChangeCallback = (event: TreeChangeEvent) => void;

/**
 * サブスクリプション解除関数
 */
export type UnsubscribeFunction = () => void;

/**
 * アダプターの実行コンテキスト
 * 各API呼び出しで共有される設定情報
 */
export interface AdapterContext {
  /** 呼び出し元のビューID（TreeConsoleコンポーネントのインスタンス識別） */
  viewId: string;
  /** コマンドグループID（関連する操作をグループ化） */
  groupId: string;
  /** 名前衝突時の処理方針 */
  onNameConflict?: (name: string) => string;
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
  defaultOnNameConflict?: (name: string) => string;
}

/**
 * 展開状態変更イベント（新しいWorkerAPIベース）
 */
export interface ExpandedStateChange {
  nodeId: NodeId;
  expanded: boolean;
  timestamp?: number;
}

/**
 * サブツリー変更イベント（新しいWorkerAPIベース）
 */
export interface SubTreeChange {
  type: TreeChangeEventType;
  nodeId: NodeId;
  node?: TreeNode;
  previousNode?: TreeNode;
  timestamp: number;
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

// Legacy types for backward compatibility
export type LegacyCallback<T = unknown> = (data: T) => void;
export type LegacyUnsubscribe = () => void;
export type LegacyExpandedStateChanges = ExpandedStateChange[];
export type LegacySubTreeChanges = SubTreeChange[];
