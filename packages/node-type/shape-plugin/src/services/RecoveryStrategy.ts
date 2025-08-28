/**
 * @file RecoveryStrategy.ts
 * @description エラーリカバリ戦略のパターン実装
 * 
 * リカバリ戦略：
 * 1. 自動リトライ（指数バックオフ）
 * 2. 部分的再開（チェックポイントから）
 * 3. パラメータ調整（リソース削減）
 * 4. 代替処理（フォールバック）
 */

import type { BaseShapeError, ActionType } from '../types/ShapeErrorHierarchy';
import { ErrorCategory, ErrorSeverity } from '../types/ShapeErrorHierarchy';
import type { BatchConfig } from '../types/BatchConfig';
import type { TreeNodeId } from '@hierarchidb/core';

// ========================================
// リカバリ戦略インターフェース
// ========================================

/**
 * リカバリコンテキスト
 */
export interface RecoveryContext {
  error: BaseShapeError;
  sessionId: string;
  treeNodeId: TreeNodeId;
  config: BatchConfig;
  attemptNumber: number;
  previousAttempts: RecoveryAttempt[];
}

/**
 * リカバリ試行記録
 */
export interface RecoveryAttempt {
  timestamp: number;
  strategy: string;
  success: boolean;
  error?: BaseShapeError;
  adjustedParams?: Record<string, any>;
}

/**
 * リカバリ結果
 */
export interface RecoveryResult {
  success: boolean;
  strategy: string;
  newConfig?: Partial<BatchConfig>;
  resumePoint?: ResumePoint;
  message?: string;
  nextAttemptDelay?: number;
}

/**
 * 再開ポイント
 */
export interface ResumePoint {
  stage: 'download' | 'simplify1' | 'simplify2' | 'vectorTiles';
  taskIndex: number;
  completedTasks: string[];
  skipTasks?: string[];
}

/**
 * リカバリ戦略の基底インターフェース
 */
export interface RecoveryStrategy {
  name: string;
  description: string;
  applicableCategories: ErrorCategory[];
  maxAttempts: number;
  
  /**
   * この戦略が適用可能かチェック
   */
  canApply(context: RecoveryContext): boolean;
  
  /**
   * リカバリを実行
   */
  execute(context: RecoveryContext): Promise<RecoveryResult>;
  
  /**
   * 次回試行までの待機時間を計算
   */
  calculateDelay(attemptNumber: number): number;
}

// ========================================
// 具体的なリカバリ戦略の実装
// ========================================

/**
 * 指数バックオフリトライ戦略
 */
export class ExponentialBackoffRetryStrategy implements RecoveryStrategy {
  name = 'ExponentialBackoffRetry';
  description = '指数バックオフでリトライ';
  applicableCategories = [ErrorCategory.NETWORK, ErrorCategory.WORKER];
  maxAttempts = 5;
  
  private baseDelay = 1000; // 1秒
  private maxDelay = 60000; // 60秒
  private multiplier = 2;
  
  canApply(context: RecoveryContext): boolean {
    return context.error.retryable && 
           context.attemptNumber < this.maxAttempts &&
           this.applicableCategories.includes(context.error.category);
  }
  
  async execute(context: RecoveryContext): Promise<RecoveryResult> {
    const delay = this.calculateDelay(context.attemptNumber);
    
    return {
      success: true,
      strategy: this.name,
      message: `${delay}ms後にリトライします（試行 ${context.attemptNumber + 1}/${this.maxAttempts}）`,
      nextAttemptDelay: delay
    };
  }
  
  calculateDelay(attemptNumber: number): number {
    // ジッターを追加して同時リトライを防ぐ
    const jitter = Math.random() * 0.3; // 0-30%のランダム性
    const delay = Math.min(
      this.baseDelay * Math.pow(this.multiplier, attemptNumber) * (1 + jitter),
      this.maxDelay
    );
    return Math.floor(delay);
  }
}

/**
 * 並行数削減戦略
 */
export class ReduceConcurrencyStrategy implements RecoveryStrategy {
  name = 'ReduceConcurrency';
  description = '並行処理数を削減してリトライ';
  applicableCategories = [ErrorCategory.NETWORK, ErrorCategory.WORKER];
  maxAttempts = 3;
  
  canApply(context: RecoveryContext): boolean {
    // メモリエラーやレート制限の場合に適用
    const errorType = context.error.type;
    return (
      errorType === 'WORKER_MEMORY_ERROR' ||
      errorType === 'RATE_LIMIT_ERROR' ||
      errorType === 'WORKER_TIMEOUT'
    ) && context.attemptNumber < this.maxAttempts;
  }
  
  async execute(context: RecoveryContext): Promise<RecoveryResult> {
    const currentConfig = context.config;
    const reductionFactor = 0.5; // 50%に削減
    
    const newConfig: Partial<BatchConfig> = {
      download: {
        ...currentConfig.download,
        concurrentDownloads: Math.max(
          1,
          Math.floor(currentConfig.download.concurrentDownloads * reductionFactor)
        )
      },
      simplify1: {
        ...currentConfig.simplify1,
        concurrentProcesses: Math.max(
          1,
          Math.floor(currentConfig.simplify1.concurrentProcesses * reductionFactor)
        )
      },
      simplify2: {
        ...currentConfig.simplify2,
        concurrentProcesses: Math.max(
          1,
          Math.floor(currentConfig.simplify2.concurrentProcesses * reductionFactor)
        )
      }
    };
    
    return {
      success: true,
      strategy: this.name,
      newConfig,
      message: `並行処理数を${Math.floor((1 - reductionFactor) * 100)}%削減しました`
    };
  }
  
  calculateDelay(attemptNumber: number): number {
    return 2000 * attemptNumber; // 2秒 × 試行回数
  }
}

/**
 * チェックポイント再開戦略
 */
export class CheckpointResumeStrategy implements RecoveryStrategy {
  name = 'CheckpointResume';
  description = 'チェックポイントから処理を再開';
  applicableCategories = [ErrorCategory.WORKER, ErrorCategory.DATA];
  maxAttempts = 3;
  
  // チェックポイント保存先（実際はIndexedDBなど）
  private checkpoints = new Map<string, ResumePoint>();
  
  canApply(context: RecoveryContext): boolean {
    // セッションIDのチェックポイントが存在し、回復可能なエラーの場合
    return context.error.recoverable && 
           this.hasCheckpoint(context.sessionId);
  }
  
  async execute(context: RecoveryContext): Promise<RecoveryResult> {
    const checkpoint = await this.loadCheckpoint(context.sessionId);
    
    if (!checkpoint) {
      return {
        success: false,
        strategy: this.name,
        message: 'チェックポイントが見つかりません'
      };
    }
    
    return {
      success: true,
      strategy: this.name,
      resumePoint: checkpoint,
      message: `ステージ ${checkpoint.stage} のタスク ${checkpoint.taskIndex} から再開します`
    };
  }
  
  calculateDelay(attemptNumber: number): number {
    return 1000; // 即座に再開
  }
  
  private hasCheckpoint(sessionId: string): boolean {
    return this.checkpoints.has(sessionId);
  }
  
  private async loadCheckpoint(sessionId: string): Promise<ResumePoint | null> {
    return this.checkpoints.get(sessionId) || null;
  }
  
  /**
   * チェックポイントを保存
   */
  async saveCheckpoint(sessionId: string, point: ResumePoint): Promise<void> {
    this.checkpoints.set(sessionId, point);
  }
}

/**
 * データサイズ削減戦略
 */
export class ReduceDataSizeStrategy implements RecoveryStrategy {
  name = 'ReduceDataSize';
  description = 'データサイズを削減してリトライ';
  applicableCategories = [ErrorCategory.WORKER];
  maxAttempts = 2;
  
  canApply(context: RecoveryContext): boolean {
    // メモリエラーの場合に適用
    return context.error.type === 'WORKER_MEMORY_ERROR' &&
           context.attemptNumber < this.maxAttempts;
  }
  
  async execute(context: RecoveryContext): Promise<RecoveryResult> {
    const currentConfig = context.config;
    
    // 処理する地域やレベルを削減する提案
    const newConfig: Partial<BatchConfig> = {
      simplify1: {
        ...currentConfig.simplify1,
        featureAreaThreshold: currentConfig.simplify1.featureAreaThreshold * 2, // 閾値を上げて小さい地物を除外
        minVertexCountForAreaFilter: Math.floor(
          currentConfig.simplify1.minVertexCountForAreaFilter * 1.5
        )
      },
      simplify2: {
        ...currentConfig.simplify2,
        simplify: currentConfig.simplify2.simplify * 2, // 簡略化を強化
        tolerance: currentConfig.simplify2.tolerance * 2
      }
    };
    
    return {
      success: true,
      strategy: this.name,
      newConfig,
      message: 'データ処理パラメータを調整してメモリ使用量を削減しました'
    };
  }
  
  calculateDelay(attemptNumber: number): number {
    return 3000; // 3秒待機
  }
}

/**
 * フォールバック戦略
 */
export class FallbackStrategy implements RecoveryStrategy {
  name = 'Fallback';
  description = '代替データソースまたは処理方法を使用';
  applicableCategories = [ErrorCategory.DATA, ErrorCategory.NETWORK];
  maxAttempts = 1;
  
  private fallbackSources = new Map<string, string[]>([
    ['naturalearth', ['geoboundaries', 'gadm']],
    ['gadm', ['naturalearth', 'geoboundaries']],
    ['geoboundaries', ['naturalearth', 'gadm']]
  ]);
  
  canApply(context: RecoveryContext): boolean {
    // データソースエラーで代替ソースが利用可能な場合
    return context.error.type === 'DATA_SOURCE_UNAVAILABLE' &&
           this.hasFallback(context.config.dataSource);
  }
  
  async execute(context: RecoveryContext): Promise<RecoveryResult> {
    const currentSource = context.config.dataSource || 'naturalearth';
    const alternatives = this.fallbackSources.get(currentSource) || [];
    
    if (alternatives.length === 0) {
      return {
        success: false,
        strategy: this.name,
        message: '代替データソースが見つかりません'
      };
    }
    
    const newSource = alternatives[0];
    return {
      success: true,
      strategy: this.name,
      newConfig: {
        dataSource: newSource as any
      },
      message: `データソースを ${currentSource} から ${newSource} に変更しました`
    };
  }
  
  calculateDelay(attemptNumber: number): number {
    return 0; // 即座に実行
  }
  
  private hasFallback(dataSource?: string): boolean {
    return dataSource ? this.fallbackSources.has(dataSource) : false;
  }
}

// ========================================
// リカバリ戦略マネージャー
// ========================================

/**
 * リカバリ戦略を管理・実行するマネージャー
 */
export class RecoveryStrategyManager {
  private strategies: RecoveryStrategy[] = [];
  private attemptHistory = new Map<string, RecoveryAttempt[]>();
  
  constructor() {
    // デフォルト戦略を登録
    this.registerStrategy(new ExponentialBackoffRetryStrategy());
    this.registerStrategy(new ReduceConcurrencyStrategy());
    this.registerStrategy(new CheckpointResumeStrategy());
    this.registerStrategy(new ReduceDataSizeStrategy());
    this.registerStrategy(new FallbackStrategy());
  }
  
  /**
   * 戦略を登録
   */
  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * 適用可能な最優先戦略を選択
   */
  selectStrategy(context: RecoveryContext): RecoveryStrategy | null {
    // 適用可能な戦略を選定
    const applicableStrategies = this.strategies.filter(s => s.canApply(context));
    
    if (applicableStrategies.length === 0) {
      return null;
    }
    
    // 優先順位: CheckpointResume > ReduceConcurrency > FallBack > ExponentialBackoff
    const priorityOrder = [
      'CheckpointResume',
      'ReduceConcurrency', 
      'Fallback',
      'ReduceDataSize',
      'ExponentialBackoffRetry'
    ];
    
    const sortedStrategies = applicableStrategies.sort((a, b) => {
      const aIndex = priorityOrder.indexOf(a.name);
      const bIndex = priorityOrder.indexOf(b.name);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
    
    return sortedStrategies[0];
  }
  
  /**
   * 最適な戦略を選択して実行
   */
  async executeRecovery(context: RecoveryContext): Promise<RecoveryResult> {
    // 適用可能な戦略を選定
    const applicableStrategies = this.strategies.filter(s => s.canApply(context));
    
    if (applicableStrategies.length === 0) {
      return {
        success: false,
        strategy: 'none',
        message: '適用可能なリカバリ戦略がありません'
      };
    }
    
    // 優先順位：CheckpointResume > ReduceConcurrency > FallBack > ExponentialBackoff
    const priorityOrder = [
      'CheckpointResume',
      'ReduceConcurrency',
      'Fallback',
      'ReduceDataSize',
      'ExponentialBackoffRetry'
    ];
    
    const sortedStrategies = applicableStrategies.sort((a, b) => {
      const aIndex = priorityOrder.indexOf(a.name);
      const bIndex = priorityOrder.indexOf(b.name);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
    
    const selectedStrategy = sortedStrategies[0];
    const result = await selectedStrategy.execute(context);
    
    // 履歴を記録
    this.recordAttempt(context.sessionId, {
      timestamp: Date.now(),
      strategy: selectedStrategy.name,
      success: result.success,
      error: result.success ? undefined : context.error,
      adjustedParams: result.newConfig
    });
    
    return result;
  }
  
  /**
   * リカバリ試行を記録
   */
  private recordAttempt(sessionId: string, attempt: RecoveryAttempt): void {
    const history = this.attemptHistory.get(sessionId) || [];
    history.push(attempt);
    this.attemptHistory.set(sessionId, history);
  }
  
  /**
   * セッションの試行履歴を取得
   */
  getAttemptHistory(sessionId: string): RecoveryAttempt[] {
    return this.attemptHistory.get(sessionId) || [];
  }
  
  /**
   * 履歴をクリア
   */
  clearHistory(sessionId: string): void {
    this.attemptHistory.delete(sessionId);
  }
}