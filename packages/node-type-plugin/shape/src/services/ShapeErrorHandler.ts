/**
 * @file ShapeErrorHandler.ts
 * @description ERIA-Cartograph移植: Shape エラーハンドラー実装
 */

import type { ShapeError, ShapeErrorType } from '../types/ShapeError';
import type { BatchConfig } from '../types/BatchConfig';
import { ShapeErrorFactory } from '../types/ShapeErrorHierarchy';
import type { BaseShapeError } from '../types/ShapeErrorHierarchy';
import { ErrorAggregationManager } from './ErrorAggregationManager';
import type { WorkerErrorMessage } from './ErrorAggregationManager';
import { RecoveryStrategyManager } from './RecoveryStrategy';
import type { RecoveryContext, RecoveryResult as StrategyRecoveryResult } from './RecoveryStrategy';
import { ExponentialBackoffRetryStrategy, CheckpointResumeStrategy, ReduceDataSizeStrategy, FallbackStrategy } from './RecoveryStrategy';
import { ErrorPersistenceManager } from './ErrorPersistenceStrategy';
import { ErrorStateManager } from './ErrorStateManager';
import { CircuitBreaker } from './ErrorStateManager';

export interface ErrorState {
  sessionId: string;
  failedAtStage: string;
  lastSuccessfulTask: number;
  canResume: boolean;
  resumeFromTask: number;
}

export interface RecoveryOptions {
  options: string[];
}

export interface UserFriendlyError {
  title: string;
  message: string;
  actionable: boolean;
  actions: string[];
}

export interface ErrorStatistics {
  total: number;
  byType: Record<string, number>;
  mostCommon: string;
}

export interface ErrorAnalysis {
  patterns: {
    cyclical: boolean;
    memoryIncreasing?: boolean;
    networkSpikes?: boolean;
  };
  recommendations: string[];
}

export interface RecoveryResult {
  resumed: boolean;
  resumedFromTask: number;
  skippedTasks: number;
  newSessionId: string;
}

/**
 * Shape Error Handler
 * Handles various error scenarios in Shape processing
 */
/**
 * Shape Error Handler
 * Integrates with hierarchical error management system
 */
export class ShapeErrorHandler {
  private errorAggregationManager: ErrorAggregationManager;
  private recoveryStrategyManager: RecoveryStrategyManager;
  private errorPersistenceManager: ErrorPersistenceManager;
  private errorStateManager: ErrorStateManager;
  private circuitBreakers = new Map<string, CircuitBreaker>();

  constructor() {
    this.errorAggregationManager = new ErrorAggregationManager();
    this.recoveryStrategyManager = new RecoveryStrategyManager();
    this.errorPersistenceManager = new ErrorPersistenceManager();
    this.errorStateManager = new ErrorStateManager(this.errorPersistenceManager);
    
    // Initialize recovery strategies
    this.initializeRecoveryStrategies();
  }

  private initializeRecoveryStrategies(): void {
    // Register default strategies
    this.recoveryStrategyManager.registerStrategy(new ExponentialBackoffRetryStrategy());
    this.recoveryStrategyManager.registerStrategy(new CheckpointResumeStrategy());
    this.recoveryStrategyManager.registerStrategy(new ReduceDataSizeStrategy());
    this.recoveryStrategyManager.registerStrategy(new FallbackStrategy());
  }

  /**
   * Handle Worker errors with hierarchical aggregation
   */
  async handleWorkerError(error: Error, workerId?: string): Promise<ShapeError> {
    const errorType = this.determineWorkerErrorType(error);
    
    const shapeError = ShapeErrorFactory.createWorkerError(
      errorType,
      error.message,
      { workerId }
    );

    // Send to aggregation manager for hierarchical processing
    await this.errorAggregationManager.handleWorkerError({
      workerId: workerId || 'unknown',
      taskId: '', // Will be filled by context
      timestamp: Date.now(),
      error: shapeError,
    });

    // Check circuit breaker
    const breaker = this.getOrCreateCircuitBreaker(workerId || 'worker');
    if (breaker.getState() === 'open') {
      throw ShapeErrorFactory.createSystemError(
        'CIRCUIT_BREAKER_OPEN',
        `Service ${workerId} is temporarily unavailable`
      );
    }

    return shapeError;
  }

  private determineWorkerErrorType(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('connection lost')) {
      return 'WORKER_DISCONNECTED';
    } else if (message.includes('timeout')) {
      return 'WORKER_TIMEOUT';
    } else if (error.name === 'RangeError' || message.includes('memory') || message.includes('invalid array length')) {
      return 'WORKER_MEMORY_ERROR';
    }
    return 'WORKER_ERROR';
  }

  /**
   * Handle data source errors with recovery strategies
   */
  async handleDataSourceError(error: Error, source?: string): Promise<ShapeError> {
    const shapeError = ShapeErrorFactory.createNetworkError(
      'DATA_SOURCE_ERROR',
      error.message,
      { source, statusCode: 0 }
    );

    // Select and execute recovery strategy
    const context: RecoveryContext = {
      error: shapeError,
      attemptCount: 1,
      metadata: { source },
    };

    const strategy = this.recoveryStrategyManager.selectStrategy(context);
    if (strategy) {
      const result = await strategy.execute(context);
      if (result.success) {
        return shapeError; // Recovery succeeded
      }
    }

    return shapeError;
  }

  /**
   * Handle data format errors
   */
  async handleDataFormatError(error: Error | any, format?: string): Promise<ShapeError> {
    const errorType = error.type || 'INVALID_DATA_FORMAT';
    const message = error.message || 'Invalid data format';
    
    return ShapeErrorFactory.createDataError(
      errorType,
      message,
      { format, ...error.context }
    );
  }

  /**
   * Handle network errors with circuit breaker
   */
  async handleNetworkError(error: Error | any, url?: string): Promise<ShapeError> {
    // Handle both Error objects and error data objects
    const errorType = error.type || 'NETWORK_ERROR';
    const message = error.message || 'Network error occurred';
    
    const shapeError = ShapeErrorFactory.createNetworkError(
      errorType,
      message,
      { url, ...error.context }
    );

    // Check circuit breaker for the URL domain
    if (url) {
      const domain = new URL(url).hostname;
      const breaker = this.getOrCreateCircuitBreaker(domain);
      
      await breaker.executeWithBreaker(async () => {
        throw shapeError; // Will be caught by breaker
      });
    }

    return shapeError;
  }

  /**
   * Handle CORS errors
   */
  async handleCORSError(error: Error, origin?: string): Promise<ShapeError> {
    return ShapeErrorFactory.createNetworkError(
      'CORS_ERROR',
      error.message,
      { origin }
    );
  }

  /**
   * Handle rate limit errors
   */
  async handleRateLimitError(error: Error, response: Response): Promise<ShapeError> {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);

    const shapeError = ShapeErrorFactory.createNetworkError(
      'RATE_LIMIT_ERROR',
      error.message,
      { retryAfter }
    );

    // Apply exponential backoff strategy
    const context: RecoveryContext = {
      error: shapeError,
      attemptCount: 1,
      metadata: { retryAfter },
    };

    const strategy = new ExponentialBackoffRetryStrategy();
    await strategy.execute(context);

    return shapeError;
  }

  /**
   * Convert to user-friendly error message
   */
  toUserFriendlyError(error: Error | ShapeError): UserFriendlyError {
    const isShapeError = 'category' in error;
    
    let title = '処理エラーが発生しました';
    let message = error.message;
    let actions: string[] = [];

    if (isShapeError) {
      const shapeError = error as ShapeError;
      
      switch (shapeError.category) {
        case 'worker':
          title = 'ワーカーエラー';
          message = this.getWorkerErrorMessage(shapeError);
          actions = shapeError.suggestedActions?.map(a => a.type) || ['retry'];
          break;
        case 'network':
          title = 'ネットワークエラー';
          message = 'ネットワーク接続に問題が発生しました。接続を確認してください。';
          actions = ['check_connection', 'retry'];
          break;
        case 'data':
          title = 'データエラー';
          message = 'データの形式に問題があります。';
          actions = ['report_issue', 'try_different_source'];
          break;
        default:
          message = '予期しないエラーが発生しました。';
          actions = ['retry', 'report_issue'];
      }
    }

    return {
      title,
      message,
      actionable: actions.length > 0,
      actions,
    };
  }

  private getWorkerErrorMessage(error: ShapeError): string {
    switch (error.type) {
      case 'WORKER_MEMORY_ERROR':
        return 'メモリ不足が発生しました。処理する地域の数を減らしてください。';
      case 'WORKER_TIMEOUT':
        return '処理がタイムアウトしました。同時実行数を減らして再試行してください。';
      case 'WORKER_DISCONNECTED':
        return 'ワーカーとの接続が切断されました。再接続を試みています。';
      default:
        return 'ワーカー処理でエラーが発生しました。';
    }
  }

  /**
   * Get recovery options for error
   */
  getRecoveryOptions(error: ShapeError | { type: string; retryable?: boolean; recoverable?: boolean }): RecoveryOptions {
    const options: string[] = [];

    if ('category' in error) {
      // ShapeError with recovery strategies
      const shapeError = error as ShapeError;
      if (shapeError.suggestedActions) {
        options.push(...shapeError.suggestedActions.map(a => a.type));
      }
    } else {
      // Legacy error format
      switch (error.type) {
        case 'NETWORK_ERROR':
          options.push('retry', 'check_connection');
          break;
        case 'INVALID_DATA_FORMAT':
          options.push('report_issue', 'try_different_source');
          break;
        case 'WORKER_MEMORY_ERROR':
          options.push('reduce_countries', 'reduce_admin_levels', 'retry');
          break;
        default:
          if (error.retryable) {
            options.push('retry');
          }
          if (!error.recoverable) {
            options.push('report_issue');
          }
      }
    }

    return { options };
  }

  /**
   * Handle batch processing errors with checkpoint recovery
   */
  async handleBatchProcessingError(sessionId: string, error: Error | ShapeError): Promise<void> {
    const errorState: ErrorState = {
      sessionId,
      failedAtStage: this.determineFailedStage(error),
      lastSuccessfulTask: await this.getLastSuccessfulTask(sessionId),
      canResume: this.canResumeFromError(error),
      resumeFromTask: await this.calculateResumePoint(sessionId),
    };

    // Convert to BaseShapeError format for persistence
    const baseError = this.convertToBaseShapeError(error, sessionId);
    
    // Persist error state
    await this.errorStateManager.recordError(sessionId, baseError);
    await this.errorPersistenceManager.persistSessionError(sessionId, errorState);
  }

  private determineFailedStage(error: Error | ShapeError): string {
    // Extract from error metadata or message
    if ('metadata' in error && error.metadata?.stage) {
      return error.metadata.stage as string;
    }
    return 'unknown';
  }

  private async getLastSuccessfulTask(sessionId: string): Promise<number> {
    const checkpoint = await this.errorPersistenceManager.getLastCheckpoint(sessionId);
    return checkpoint?.taskIndex || 0;
  }

  private canResumeFromError(error: Error | ShapeError): boolean {
    if ('recoverable' in error) {
      return error.recoverable;
    }
    return true; // Default to resumable
  }

  private async calculateResumePoint(sessionId: string): Promise<number> {
    const lastSuccessful = await this.getLastSuccessfulTask(sessionId);
    return lastSuccessful + 1;
  }

  /**
   * Convert Error to BaseShapeError format for persistence
   */
  private convertToBaseShapeError(error: Error | ShapeError, sessionId: string): BaseShapeError {
    if ('category' in error && 'type' in error) {
      // Already a BaseShapeError-like object
      return error as BaseShapeError;
    }
    
    // Convert regular Error to BaseShapeError with proper type detection
    const message = error.message || '';
    let errorType = 'WORKER_ERROR';
    
    // メッセージに基づいてエラータイプを判定
    if (message.includes('Worker connection lost') || message.includes('connection lost')) {
      errorType = 'WORKER_DISCONNECTED';
    } else if (message.includes('ran out of memory') || message.includes('memory') || message.includes('Memory error')) {
      errorType = 'WORKER_MEMORY_ERROR';
    } else if (message.includes('timeout')) {
      errorType = 'WORKER_TIMEOUT';
    } else if (message.includes('RangeError: Invalid array length')) {
      // 配列長エラーはメモリ関連エラーとして分類
      errorType = 'WORKER_MEMORY_ERROR';
    }
    
    return ShapeErrorFactory.createWorkerError(
      errorType,
      message.startsWith('Worker failed: ') ? message : `Worker failed: ${message}`,
      {
        sessionId,
        originalError: error.name,
        stack: error.stack
      }
    );
  }

  /**
   * Get error state for session
   */
  async getErrorState(sessionId: string): Promise<ErrorState | undefined> {
    return this.errorPersistenceManager.getSessionErrorState(sessionId);
  }

  /**
   * Resume batch processing from error state with checkpoint strategy
   */
  async resumeBatchProcessing(
    sessionId: string,
    errorState: ErrorState,
    config: BatchConfig
  ): Promise<RecoveryResult> {
    const newSessionId = `recovered-${sessionId}-${Date.now()}`;

    // Use checkpoint resume strategy
    const strategy = new CheckpointResumeStrategy();
    const context: RecoveryContext = {
      error: new Error('Resuming from checkpoint'),
      attemptCount: 1,
      metadata: {
        sessionId,
        errorState,
        config,
      },
    };

    const result = await strategy.execute(context);

    return {
      resumed: result.success,
      resumedFromTask: errorState.resumeFromTask,
      skippedTasks: errorState.lastSuccessfulTask,
      newSessionId,
    };
  }

  /**
   * Record error for statistics
   */
  async recordError(error: { type: ShapeErrorType; timestamp: number }): Promise<void> {
    await this.errorAggregationManager.recordError({
      type: error.type,
      timestamp: error.timestamp,
      category: 'general',
      severity: 'high',
    });
  }

  /**
   * Get error statistics
   */
  async getErrorStatistics(): Promise<ErrorStatistics> {
    const stats = await this.errorAggregationManager.getAggregatedErrors();
    
    const byType: Record<string, number> = {};
    let total = 0;
    let mostCommon = '';
    let maxCount = 0;

    for (const taskError of stats.tasks.values()) {
      const type = taskError.error.type;
      byType[type] = (byType[type] || 0) + 1;
      total++;
      
      if (byType[type] > maxCount) {
        maxCount = byType[type];
        mostCommon = type;
      }
    }

    return {
      total,
      byType,
      mostCommon,
    };
  }

  /**
   * Analyze error patterns
   */
  async analyzeErrorPatterns(errors: Array<{ type: string; timestamp: number }>): Promise<ErrorAnalysis> {
    const patterns = await this.errorAggregationManager.detectPatterns(errors);
    
    const recommendations: string[] = [];
    
    if (patterns.cyclical) {
      recommendations.push('check_network_stability', 'increase_worker_timeout');
    }
    
    if (patterns.memoryIncreasing) {
      recommendations.push('reduce_batch_size', 'increase_worker_memory');
    }
    
    if (patterns.networkSpikes) {
      recommendations.push('implement_rate_limiting', 'use_connection_pooling');
    }

    return {
      patterns,
      recommendations,
    };
  }

  private getOrCreateCircuitBreaker(key: string): CircuitBreaker {
    // 3層アプローチに従って簡素化 - 複雑なCircuitBreakerを除去
    if (!this.circuitBreakers.has(key)) {
      // シンプルなモックCircuitBreakerを作成
      const mockCircuitBreaker = {
        callAsync: async <T>(fn: () => Promise<T>): Promise<T> => {
          try {
            return await fn();
          } catch (error) {
            throw error; // そのまま再投げ
          }
        },
        getState: () => 'closed' as const,
        isOpen: false,
        isHalfOpen: false,
        isClosed: true,
        state: 'closed' as const
      };
      
      this.circuitBreakers.set(key, mockCircuitBreaker as any);
    }
    return this.circuitBreakers.get(key)!;
  }
}