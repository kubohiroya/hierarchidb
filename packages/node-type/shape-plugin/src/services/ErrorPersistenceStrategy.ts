/**
 * @file ErrorPersistenceStrategy.ts
 * @description HierarchiDBのデータベース戦略に基づくエラー永続化
 *
 * 永続化戦略：
 * - EphemeralDB: セッション中の詳細なエラー情報とリカバリ状態
 * - CoreDB: 長期分析用の要約情報のみ
 * - メモリ: リアルタイムアクセスが必要な情報
 */

import Dexie, { Table } from 'dexie';
import type { NodeId } from '@hierarchidb/common-core';
import { BaseShapeError, ErrorCategory, ErrorSeverity } from '../types/ShapeErrorHierarchy';

// ========================================
// データベース分離戦略
// ========================================

/**
 * エラー情報の保存先を決定
 */
export enum StorageTarget {
  MEMORY = 'MEMORY', // 一時的、高速アクセス
  EPHEMERAL = 'EPHEMERAL', // セッション期間中
  CORE = 'CORE', // 長期保存
  HYBRID = 'HYBRID', // 複数のストレージに分散
}

/**
 * エラー情報の保存戦略
 */
export interface PersistenceStrategy {
  // 基本情報
  errorSummary: StorageTarget.CORE;

  // 詳細情報
  errorDetails: StorageTarget.EPHEMERAL;
  stackTrace: StorageTarget.EPHEMERAL;
  technicalContext: StorageTarget.EPHEMERAL;

  // リカバリ情報
  recoveryAttempts: StorageTarget.EPHEMERAL;
  checkpoints: StorageTarget.EPHEMERAL;

  // 統計情報
  realtimeStats: StorageTarget.MEMORY;
  aggregatedStats: StorageTarget.CORE;

  // タスク情報
  taskErrors: StorageTarget.EPHEMERAL;
  taskDependencies: StorageTarget.MEMORY;
}

// ========================================
// CoreDB用エンティティ（最小限）
// ========================================

/**
 * CoreDBに保存するエラーサマリー
 */
export interface CoreErrorSummary {
  id: string;
  nodeId: NodeId;
  treeNodeId: NodeId;
  sessionId: string;

  // エラーの基本情報のみ
  errorType: string;
  errorCode: string;
  category: ErrorCategory;
  severity: ErrorSeverity;

  // タイムスタンプ
  occurredAt: number;
  resolvedAt?: number;

  // 結果
  wasResolved: boolean;
  resolutionType?: 'auto' | 'manual' | 'skipped';

  // 統計用の集計情報
  retryCount: number;
  recoveryDuration?: number;
  dataLossOccurred: boolean;
}

// ========================================
// EphemeralDB用エンティティ（詳細）
// ========================================

/**
 * EphemeralDBに保存する詳細エラー情報
 */
export interface EphemeralErrorDetails {
  sessionId: string;
  treeNodeId: string;

  // 基本エラー情報のみ（プリミティブ値のみ）
  fullError: {
    type: string;
    category: string;
    severity: string;
    message: string;
    timestamp: number;
    recoverable: boolean;
    retryable: boolean;
  };

  // 基本コンテキスト（プリミティブ値のみ）
  context: {
    timestamp: number;
    errorCount: number;
  };

  // デバッグ情報（空オブジェクト）
  debug: {};

  // リカバリ状態（空オブジェクト）
  recovery: {
    attempts: [];
    checkpoints: [];
  };

  // タスクレベルエラー（空オブジェクト）
  taskErrors: {};

  // 有効期限
  expiresAt: number;
}

/**
 * チェックポイントデータ
 */
export interface CheckpointData {
  id: string;
  timestamp: number;
  stage: string;
  completedTasks: string[];
  pendingTasks: string[];
  state: Record<string, any>;
  isValid: boolean;
}

/**
 * タスクエラーマップ
 */
export interface TaskErrorMap {
  [taskId: string]: {
    error: BaseShapeError;
    retryCount: number;
    lastAttempt: number;
    canSkip: boolean;
    dependencies: string[];
  };
}

// ========================================
// メモリキャッシュ（高速アクセス）
// ========================================

/**
 * メモリ内で管理するランタイム情報
 */
export class RuntimeErrorCache {
  // アクティブなエラー
  private activeErrors = new Map<string, BaseShapeError>();

  // タスクの依存関係グラフ
  private taskDependencies = new Map<string, Set<string>>();

  // セッションエラーの履歴
  public sessionErrors = new Map<
    string,
    Array<{
      timestamp: number;
      stage?: string;
      metadata?: any;
    }>
  >();

  // リアルタイム統計
  private stats = {
    totalErrors: 0,
    errorsByType: new Map<string, number>(),
    errorRate: 0,
    lastErrorTime: 0,
    recoverySuccessRate: 0,
  };

  // Circuit Breaker状態
  private circuitBreakers = new Map<
    string,
    {
      state: 'open' | 'half-open' | 'closed';
      failures: number;
      lastFailure: number;
      nextRetry: number;
    }
  >();

  /**
   * エラーを追加
   */
  addError(sessionId: string, error: BaseShapeError): void {
    this.activeErrors.set(sessionId, error);
    this.updateStatistics(error);
    this.updateCircuitBreaker(error);
  }

  /**
   * タスク依存関係を更新
   */
  updateDependencies(taskId: string, dependencies: string[]): void {
    this.taskDependencies.set(taskId, new Set(dependencies));
  }

  /**
   * 影響を受けるタスクを取得
   */
  getAffectedTasks(failedTaskId: string): string[] {
    const affected: string[] = [];

    for (const [taskId, deps] of this.taskDependencies) {
      if (deps.has(failedTaskId)) {
        affected.push(taskId);
      }
    }

    return affected;
  }

  /**
   * Circuit Breakerの状態を確認
   */
  shouldCircuitBreak(serviceId: string): boolean {
    const breaker = this.circuitBreakers.get(serviceId);
    if (!breaker) return false;

    if (breaker.state === 'open') {
      // 再試行時間をチェック
      if (Date.now() >= breaker.nextRetry) {
        breaker.state = 'half-open';
        return false;
      }
      return true;
    }

    return false;
  }

  private updateStatistics(error: BaseShapeError): void {
    this.stats.totalErrors++;
    this.stats.errorsByType.set(error.type, (this.stats.errorsByType.get(error.type) || 0) + 1);
    this.stats.lastErrorTime = Date.now();
  }

  private updateCircuitBreaker(error: BaseShapeError): void {
    if (error.category !== ErrorCategory.NETWORK && error.category !== ErrorCategory.DATA) return;

    const serviceId = error.technicalDetails?.serviceId || 'default';
    const breaker = this.circuitBreakers.get(serviceId) || {
      state: 'closed' as const,
      failures: 0,
      lastFailure: 0,
      nextRetry: 0,
    };

    breaker.failures++;
    breaker.lastFailure = Date.now();

    // 5回失敗したらCircuit Open
    if (breaker.failures >= 5) {
      breaker.state = 'open';
      breaker.nextRetry = Date.now() + 30000; // 30秒後に再試行
    }

    this.circuitBreakers.set(serviceId, breaker);
  }
}

// ========================================
// 統合永続化マネージャー
// ========================================

/**
 * EphemeralDB（セッション用）
 */
class ShapeEphemeralDB extends Dexie {
  errorDetails!: Table<EphemeralErrorDetails>;
  checkpoints!: Table<CheckpointData>;

  constructor() {
    super('ShapeEphemeralDB');

    this.version(1).stores({
      errorDetails: 'sessionId, treeNodeId, expiresAt',
      checkpoints: 'id, sessionId, timestamp, isValid',
    });

    // 期限切れデータの自動削除
    this.on('ready', () => {
      setInterval(() => this.cleanupExpired(), 60000); // 1分ごと
    });
  }

  private async cleanupExpired(): Promise<void> {
    const now = Date.now();
    await this.errorDetails.where('expiresAt').below(now).delete();
  }
}

/**
 * エラー永続化の統合マネージャー
 */
export class ErrorPersistenceManager {
  private ephemeralDB: ShapeEphemeralDB;
  private memoryCache: RuntimeErrorCache;
  private sessionLifetime = 24 * 60 * 60 * 1000; // 24時間

  constructor() {
    this.ephemeralDB = new ShapeEphemeralDB();
    this.memoryCache = new RuntimeErrorCache();
  }

  /**
   * エラーを保存（自動的に適切な場所に分散）
   */
  async saveError(
    sessionId: string,
    treeNodeId: NodeId,
    error: BaseShapeError,
    context?: any
  ): Promise<void> {
    // 3層アプローチに従って簡素化 - 複雑なオブジェクトは保存しない

    // 1. メモリキャッシュに追加（即座にアクセス可能）
    this.memoryCache.addError(sessionId, error);

    // 2. EphemeralDB に基本情報のみ保存（完全プリミティブ化・undefined対策）
    const ephemeralDetails: EphemeralErrorDetails = {
      sessionId: sessionId || `session-${Date.now()}`, // undefined対策
      treeNodeId: String(treeNodeId || 'unknown'), // TreeNodeIdを文字列に変換・undefined対策
      // fullError は保存せず、基本プロパティのみ保存
      fullError: {
        type: error.type,
        category: error.category,
        severity: error.severity,
        message: error.message,
        timestamp: error.timestamp || Date.now(),
        recoverable: error.recoverable || false,
        retryable: error.retryable || false,
        // cause や metadata など複雑な構造は除外
      } as BaseShapeError,
      context: {
        timestamp: context?.timestamp || Date.now(),
        errorCount: typeof context?.errorCount === 'number' ? context.errorCount : 1,
      },
      debug: {
        // stackTrace も文字列が長すぎる可能性があるので除外
        stackTrace: undefined,
        workerState: undefined,
      },
      recovery: {
        attempts: [],
        checkpoints: [],
      },
      taskErrors: {},
      expiresAt: Date.now() + this.sessionLifetime,
    };

    // 3層アプローチにより簡素化されたデータを永続化
    console.log('[EphemeralDB] Attempting to save:', JSON.stringify(ephemeralDetails, null, 2));

    try {
      await this.ephemeralDB.errorDetails.put(ephemeralDetails);
      console.log('[EphemeralDB] Successfully saved error details');
    } catch (error) {
      console.error('[EphemeralDB] Failed to save error details:', error);
      console.log('[EphemeralDB] Failed object structure:', ephemeralDetails);
      throw error;
    }

    // 3. CoreDB にサマリーを保存（長期分析用）
    await this.saveToCoreDB({
      id: `${sessionId}-${Date.now()}`,
      nodeId: '' as NodeId, // TODO: 実際のNodeIdを取得
      treeNodeId,
      sessionId,
      errorType: error.type,
      errorCode: error.code || 'UNKNOWN',
      category: error.category,
      severity: error.severity,
      occurredAt: error.timestamp || Date.now(),
      wasResolved: false,
      retryCount: 0,
      dataLossOccurred: false,
    });
  }

  /**
   * エラー詳細を取得（EphemeralDBから）
   */
  async getErrorDetails(sessionId: string): Promise<EphemeralErrorDetails | undefined> {
    return await this.ephemeralDB.errorDetails.get(sessionId);
  }

  /**
   * チェックポイントを保存（EphemeralDBのみ）
   */
  async saveCheckpoint(
    sessionId: string,
    checkpoint: Omit<CheckpointData, 'id' | 'timestamp'>
  ): Promise<void> {
    const data: CheckpointData = {
      ...checkpoint,
      id: `${sessionId}-${Date.now()}`,
      timestamp: Date.now(),
    };

    await this.ephemeralDB.checkpoints.add(data);
  }

  /**
   * アクティブなエラーを取得（メモリから高速）
   */
  getActiveErrors(): Map<string, BaseShapeError> {
    return this.memoryCache['activeErrors'];
  }

  /**
   * Circuit Breaker状態を確認
   */
  shouldCircuitBreak(serviceId: string): boolean {
    return this.memoryCache.shouldCircuitBreak(serviceId);
  }

  /**
   * セッションの最新チェックポイントを取得
   */
  async getLastCheckpoint(sessionId: string): Promise<{ taskIndex: number } | null> {
    const sessionErrors = this.memoryCache.sessionErrors.get(sessionId);
    if (!sessionErrors || sessionErrors.length === 0) {
      return null;
    }

    // 最新のエラー状態から復旧ポイントを算出
    const lastError = sessionErrors[sessionErrors.length - 1];
    return {
      taskIndex: lastError?.metadata?.lastSuccessfulTask || 0,
    };
  }

  /**
   * セッションエラー状態を取得
   */
  async getSessionErrorState(sessionId: string): Promise<any> {
    const sessionErrors = this.memoryCache.sessionErrors.get(sessionId);
    if (!sessionErrors || sessionErrors.length === 0) {
      return null;
    }

    const lastError = sessionErrors[sessionErrors.length - 1];
    return {
      sessionId,
      failedAtStage: lastError?.stage || 'unknown',
      lastSuccessfulTask: lastError?.metadata?.lastSuccessfulTask || 0,
      canResume: true,
      resumeFromTask: (lastError?.metadata?.lastSuccessfulTask || 0) + 1,
    };
  }

  /**
   * セッションエラーを永続化
   */
  async persistSessionError(sessionId: string, errorState: any): Promise<void> {
    // メモリキャッシュに保存
    const errors = this.memoryCache.sessionErrors.get(sessionId) || [];
    errors.push({
      timestamp: Date.now(),
      stage: errorState.failedAtStage,
      metadata: {
        lastSuccessfulTask: errorState.lastSuccessfulTask,
        canResume: errorState.canResume,
      },
    });
    this.memoryCache.sessionErrors.set(sessionId, errors);
  }

  /**
   * 影響を受けるタスクを特定
   */
  getAffectedTasks(failedTaskId: string): string[] {
    return this.memoryCache.getAffectedTasks(failedTaskId);
  }

  /**
   * セッションクリーンアップ
   */
  async cleanupSession(sessionId: string): Promise<void> {
    // EphemeralDBから削除
    await this.ephemeralDB.errorDetails.where('sessionId').equals(sessionId).delete();
    await this.ephemeralDB.checkpoints.where('sessionId').equals(sessionId).delete();

    // メモリキャッシュクリア
    // ※ 実装簡略化のため詳細は省略
  }

  /**
   * CoreDBへの保存（Worker経由で実行される想定）
   */
  private async saveToCoreDB(summary: CoreErrorSummary): Promise<void> {
    // TODO: WorkerAPI経由でCoreDBに保存
    console.log('Save to CoreDB:', summary);
  }
}
