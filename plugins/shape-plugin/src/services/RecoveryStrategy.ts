/**
  * @file RecoveryStrategy.ts
 * @description
   * 1.
 * 2.
 * 3.
 * 4.
  */

import type { BaseShapeError } from '../common/types/ShapeErrorHierarchy.js';
import { ErrorCategory } from '../common/types/ShapeErrorHierarchy.js';
import type { BatchSessionConfig } from '../common/types/BatchConfig.js';
import type { NodeId } from '@hierarchidb/common-types';
import type { DataSourceName } from '../common/types/data-source.js';

// ========================================
// ========================================

/**
    */
export interface RecoveryContext {
  error: BaseShapeError;
  sessionId: string;
  treeNodeId: NodeId;
  config: BatchSessionConfig;
  attemptNumber: number;
  previousAttempts: RecoveryAttempt[];
}

/**
    */
export interface RecoveryAttempt {
  timestamp: number;
  strategy: string;
  success: boolean;
  error?: BaseShapeError;
  adjustedParams?: Partial<BatchSessionConfig>;
}

/**
    */
export interface RecoveryResult {
  success: boolean;
  strategy: string;
  newConfig?: Partial<BatchSessionConfig>;
  resumePoint?: ResumePoint;
  message?: string;
  nextAttemptDelay?: number;
}

/**
    */
export interface ResumePoint {
  stage: 'download' | 'simplify1' | 'simplify2' | 'vectorTiles';
  taskIndex: number;
  completedTasks: string[];
  skipTasks?: string[];
}

/**
    */
export interface RecoveryStrategy {
  name: string;
  description: string;
  applicableCategories: ErrorCategory[];
  maxAttempts: number;

  /**
            */
  canApply(context: RecoveryContext): boolean;

  /**
            */
  execute(context: RecoveryContext): Promise<RecoveryResult>;

  /**
            */
  calculateDelay(attemptNumber: number): number;
}

// ========================================
// ========================================

/**
    */
export class ExponentialBackoffRetryStrategy implements RecoveryStrategy {
  name = 'ExponentialBackoffRetry';
  description = '指数バックオフでリトライ';
  applicableCategories = [ErrorCategory.NETWORK, ErrorCategory.WORKER];
  maxAttempts = 5;

  private baseDelay = 1000; //  1
  private maxDelay = 60000; //  60
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
      nextAttemptDelay: delay,
    };
  }

  calculateDelay(attemptNumber: number): number {
    const jitter = Math.random() * 0.3; //  0-30%
    const delay = Math.min(
      this.baseDelay * this.multiplier ** attemptNumber * (1 + jitter),
      this.maxDelay,
    );
    return Math.floor(delay);
  }
}

/**
    */
export class ReduceConcurrencyStrategy implements RecoveryStrategy {
  name = 'ReduceConcurrency';
  description = '並行処理数を削減してリトライ';
  applicableCategories = [ErrorCategory.NETWORK, ErrorCategory.WORKER];
  maxAttempts = 3;

  canApply(context: RecoveryContext): boolean {
    const errorType = context.error.type;
    return (
      errorType === 'WORKER_MEMORY_ERROR' ||
      errorType === 'RATE_LIMIT_ERROR' ||
      errorType === 'WORKER_TIMEOUT'
    ) && context.attemptNumber < this.maxAttempts;
  }

  async execute(context: RecoveryContext): Promise<RecoveryResult> {
    const currentConfig = context.config;
    const reductionFactor = 0.5; //  50%

    const newConfig: Partial<BatchSessionConfig> = {
      download: {
        ...currentConfig.download,
        concurrentDownloads: Math.max(
          1,
          Math.floor(currentConfig.download.concurrentDownloads * reductionFactor),
        ),
      },
      simplify1: {
        ...currentConfig.simplify1,
        concurrentProcesses: Math.max(
          1,
          Math.floor(currentConfig.simplify1.concurrentProcesses * reductionFactor),
        ),
      },
      simplify2: {
        ...currentConfig.simplify2,
        concurrentProcesses: Math.max(
          1,
          Math.floor(currentConfig.simplify2.concurrentProcesses * reductionFactor),
        ),
      },
    };

    return {
      success: true,
      strategy: this.name,
      newConfig,
      message: `並行処理数を${Math.floor((1 - reductionFactor) * 100)}%削減しました`,
    };
  }

  calculateDelay(attemptNumber: number): number {
    return 2000 * attemptNumber; //  2
  }
}

/**
    */
export class CheckpointResumeStrategy implements RecoveryStrategy {
  name = 'CheckpointResume';
  description = 'チェックポイントから処理を再開';
  applicableCategories = [ErrorCategory.WORKER, ErrorCategory.DATA];
  maxAttempts = 3;

  //  IndexedDB
  private checkpoints = new Map<string, ResumePoint>();

  canApply(context: RecoveryContext): boolean {
    //  ID
    return context.error.recoverable &&
      this.hasCheckpoint(context.sessionId);
  }

  async execute(context: RecoveryContext): Promise<RecoveryResult> {
    const checkpoint = await this.loadCheckpoint(context.sessionId);

    if (!checkpoint) {
      return {
        success: false,
        strategy: this.name,
        message: 'チェックポイントが見つかりません',
      };
    }

    return {
      success: true,
      strategy: this.name,
      resumePoint: checkpoint,
      message: `ステージ ${checkpoint.stage} のタスク ${checkpoint.taskIndex} から再開します`,
    };
  }

  calculateDelay(_attemptNumber: number): number {
    return 1000;
  }

  private hasCheckpoint(sessionId: string): boolean {
    return this.checkpoints.has(sessionId);
  }

  private async loadCheckpoint(sessionId: string): Promise<ResumePoint | null> {
    return this.checkpoints.get(sessionId) || null;
  }

  /**
            */
  async saveCheckpoint(sessionId: string, point: ResumePoint): Promise<void> {
    this.checkpoints.set(sessionId, point);
  }
}

/**
    */
export class ReduceDataSizeStrategy implements RecoveryStrategy {
  name = 'ReduceDataSize';
  description = 'データサイズを削減してリトライ';
  applicableCategories = [ErrorCategory.WORKER];
  maxAttempts = 2;

  canApply(context: RecoveryContext): boolean {
    return context.error.type === 'WORKER_MEMORY_ERROR' &&
      context.attemptNumber < this.maxAttempts;
  }

  async execute(context: RecoveryContext): Promise<RecoveryResult> {
    const currentConfig = context.config;

    const newConfig: Partial<BatchSessionConfig> = {
      simplify1: {
        ...currentConfig.simplify1,
        featureAreaThreshold: currentConfig.simplify1.featureAreaThreshold * 2, minVertexCountForAreaFilter: Math.floor(
          currentConfig.simplify1.minVertexCountForAreaFilter * 1.5,
        ),
      },
      simplify2: {
        ...currentConfig.simplify2,
        simplify: currentConfig.simplify2.simplify * 2, tolerance: currentConfig.simplify2.tolerance * 2,
      },
    };

    return {
      success: true,
      strategy: this.name,
      newConfig,
      message: 'データ処理パラメータを調整してメモリ使用量を削減しました',
    };
  }

  calculateDelay(_attemptNumber: number): number {
    return 3000; //  3
  }
}

/**
    */
export class FallbackStrategy implements RecoveryStrategy {
  name = 'Fallback';
  description = '代替データソースまたは処理方法を使用';
  applicableCategories = [ErrorCategory.DATA, ErrorCategory.NETWORK];
  maxAttempts = 1;

  private fallbackSources = new Map<DataSourceName, DataSourceName[]>([
    ['naturalearth', ['geoboundaries', 'gadm']],
    ['gadm', ['naturalearth', 'geoboundaries']],
    ['geoboundaries', ['naturalearth', 'gadm']],
  ]);

  canApply(context: RecoveryContext): boolean {
    return context.error.type === 'DATA_SOURCE_UNAVAILABLE' &&
      this.hasFallback(context.config.dataSource);
  }

  async execute(context: RecoveryContext): Promise<RecoveryResult> {
    const currentSource = context.config.dataSource;
    if (!currentSource) {
      return {
        success: false,
        strategy: this.name,
        message: 'データソースが未設定のため代替候補を選択できません',
      };
    }
    const alternatives = this.fallbackSources.get(currentSource) || [];

    if (alternatives.length === 0) {
      return {
        success: false,
        strategy: this.name,
        message: '代替データソースが見つかりません',
      };
    }

    const newSource = alternatives[0];
    return {
      success: true,
      strategy: this.name,
      newConfig: {
        dataSource: newSource as DataSourceName,
      },
      message: `データソースを ${currentSource} から ${newSource} に変更しました`,
    };
  }

  calculateDelay(_attemptNumber: number): number {
    return 0;
  }

  private hasFallback(dataSource?: DataSourceName): boolean {
    return dataSource ? this.fallbackSources.has(dataSource) : false;
  }
}

// ========================================
// ========================================

/**
    */
export class RecoveryStrategyManager {
  private strategies: RecoveryStrategy[] = [];
  private attemptHistory = new Map<string, RecoveryAttempt[]>();

  constructor() {
    this.registerStrategy(new ExponentialBackoffRetryStrategy());
    this.registerStrategy(new ReduceConcurrencyStrategy());
    this.registerStrategy(new CheckpointResumeStrategy());
    this.registerStrategy(new ReduceDataSizeStrategy());
    this.registerStrategy(new FallbackStrategy());
  }

  /**
            */
  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.push(strategy);
  }

  /**
            */
  selectStrategy(context: RecoveryContext): RecoveryStrategy | null {
    const applicableStrategies = this.strategies.filter(s => s.canApply(context));

    if (applicableStrategies.length === 0) {
      return null;
    }

    //  : CheckpointResume > ReduceConcurrency > FallBack > ExponentialBackoff
    const priorityOrder = [
      'CheckpointResume',
      'ReduceConcurrency',
      'Fallback',
      'ReduceDataSize',
      'ExponentialBackoffRetry',
    ];

    const sortedStrategies = applicableStrategies.sort((a, b) => {
      const aIndex = priorityOrder.indexOf(a.name);
      const bIndex = priorityOrder.indexOf(b.name);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

    return sortedStrategies[0] ?? null;
  }

  /**
            */
  async executeRecovery(context: RecoveryContext): Promise<RecoveryResult> {
    const applicableStrategies = this.strategies.filter(s => s.canApply(context));

    if (applicableStrategies.length === 0) {
      return {
        success: false,
        strategy: 'none',
        message: '適用可能なリカバリ戦略がありません',
      };
    }

    //  CheckpointResume > ReduceConcurrency > FallBack > ExponentialBackoff
    const priorityOrder = [
      'CheckpointResume',
      'ReduceConcurrency',
      'Fallback',
      'ReduceDataSize',
      'ExponentialBackoffRetry',
    ];

    const sortedStrategies = applicableStrategies.sort((a, b) => {
      const aIndex = priorityOrder.indexOf(a.name);
      const bIndex = priorityOrder.indexOf(b.name);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

    const selectedStrategy = sortedStrategies[0];
    if (!selectedStrategy) {
      return {
        success: false,
        strategy: 'none',
        message: '適用可能なリカバリ戦略がありません',
      };
    }

    const result = await selectedStrategy.execute(context);

    this.recordAttempt(context.sessionId, {
      timestamp: Date.now(),
      strategy: selectedStrategy.name,
      success: result.success,
      error: result.success ? undefined : context.error,
      adjustedParams: result.newConfig,
    });

    return result;
  }

  /**
            */
  private recordAttempt(sessionId: string, attempt: RecoveryAttempt): void {
    const history = this.attemptHistory.get(sessionId) || [];
    history.push(attempt);
    this.attemptHistory.set(sessionId, history);
  }

  /**
            */
  getAttemptHistory(sessionId: string): RecoveryAttempt[] {
    return this.attemptHistory.get(sessionId) || [];
  }

  /**
            */
  clearHistory(sessionId: string): void {
    this.attemptHistory.delete(sessionId);
  }
}
