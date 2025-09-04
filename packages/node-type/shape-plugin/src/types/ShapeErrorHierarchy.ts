/**
 * @file ShapeErrorHierarchy.ts
 * @description Shape処理における体系的なエラー階層定義
 * 
 * エラー設計方針：
 * 1. エラーをカテゴリ別に分類（Worker/Network/Data/Validation）
 * 2. 各エラーに明確な属性を定義（リカバリ可能性、リトライ可否など）
 * 3. ユーザーフレンドリーなメッセージとアクションを提供
 * 4. エラーコンテキストの保持（デバッグ情報、スタックトレース）
 */

import type { TreeNodeId } from '@hierarchidb/core';

// ========================================
// エラーカテゴリの定義
// ========================================

/**
 * エラーの大分類
 */
export enum ErrorCategory {
  WORKER = 'worker',           // Worker通信・処理関連
  NETWORK = 'network',         // ネットワーク通信関連
  DATA = 'data',              // データ処理・検証関連
  VALIDATION = 'validation',   // 入力検証関連
  SYSTEM = 'system'           // システムエラー
}

/**
 * エラーの深刻度
 */
export enum ErrorSeverity {
  CRITICAL = 'CRITICAL',   // 致命的エラー（処理継続不可）
  ERROR = 'ERROR',        // エラー（リトライ可能）
  WARNING = 'WARNING',     // 警告（処理は継続可能）
  INFO = 'INFO'           // 情報（ユーザー通知）
}

// ========================================
// 基底エラー型
// ========================================

/**
 * Shape処理エラーの基底インターフェース
 */
export interface BaseShapeError extends Error {
  // エラー識別情報
  category: ErrorCategory;
  type: string;
  code: string;
  severity: ErrorSeverity;
  
  // エラー詳細
  message: string;
  userMessage?: string;
  technicalDetails?: Record<string, any>;
  
  // リカバリ情報
  recoverable: boolean;
  retryable: boolean;
  suggestedActions?: SuggestedAction[];
  
  // コンテキスト情報
  timestamp: number;
  sessionId?: string;
  treeNodeId?: TreeNodeId;
  stage?: BatchProcessingStage;
  // 任意の付帯情報
  metadata?: Record<string, any>;
  
  // エラーチェーン
  cause?: Error | BaseShapeError;
  stack?: string;
}

/**
 * 推奨アクション
 */
export interface SuggestedAction {
  type: ActionType;
  label: string;
  description?: string;
  params?: Record<string, any>;
}

export enum ActionType {
  RETRY = 'RETRY',
  RETRY_WITH_BACKOFF = 'RETRY_WITH_BACKOFF',
  REDUCE_CONCURRENCY = 'REDUCE_CONCURRENCY',
  REDUCE_DATA_SIZE = 'REDUCE_DATA_SIZE',
  CHANGE_CONFIGURATION = 'CHANGE_CONFIGURATION',
  CHECK_CONNECTION = 'CHECK_CONNECTION',
  CHECK_PERMISSIONS = 'CHECK_PERMISSIONS',
  REPORT_ISSUE = 'REPORT_ISSUE',
  CANCEL = 'CANCEL'
}

export type BatchProcessingStage = 
  | 'download'
  | 'simplify1'
  | 'simplify2'
  | 'vectorTiles';

// ========================================
// Worker関連エラー
// ========================================

export interface WorkerError extends BaseShapeError {
  category: ErrorCategory.WORKER;
  workerId?: string;
  workerType?: string;
}

export interface WorkerDisconnectedError extends WorkerError {
  type: 'WORKER_DISCONNECTED';
  code: 'WRK001';
  lastHeartbeat?: number;
}

export interface WorkerTimeoutError extends WorkerError {
  type: 'WORKER_TIMEOUT';
  code: 'WRK002';
  timeoutDuration: number;
  operationType?: string;
}

export interface WorkerMemoryError extends WorkerError {
  type: 'WORKER_MEMORY_ERROR';
  code: 'WRK003';
  memoryUsage?: {
    used: number;
    limit: number;
  };
}

// ========================================
// ネットワーク関連エラー
// ========================================

export interface NetworkError extends BaseShapeError {
  category: ErrorCategory.NETWORK;
  url?: string;
  method?: string;
  statusCode?: number;
}

export interface NetworkConnectionError extends NetworkError {
  type: 'NETWORK_CONNECTION_ERROR';
  code: 'NET001';
}

export interface CORSError extends NetworkError {
  type: 'CORS_ERROR';
  code: 'NET002';
  origin?: string;
  targetOrigin?: string;
}

export interface RateLimitError extends NetworkError {
  type: 'RATE_LIMIT_ERROR';
  code: 'NET003';
  retryAfter?: number;
  limit?: number;
  remaining?: number;
  reset?: number;
}

export interface NetworkTimeoutError extends NetworkError {
  type: 'NETWORK_TIMEOUT';
  code: 'NET004';
  timeoutDuration: number;
}

// ========================================
// データ関連エラー
// ========================================

export interface DataError extends BaseShapeError {
  category: ErrorCategory.DATA;
  dataSource?: string;
  dataType?: string;
}

export interface DataSourceUnavailableError extends DataError {
  type: 'DATA_SOURCE_UNAVAILABLE';
  code: 'DAT001';
  alternativeSources?: string[];
}

export interface InvalidDataFormatError extends DataError {
  type: 'INVALID_DATA_FORMAT';
  code: 'DAT002';
  expectedFormat?: string;
  actualFormat?: string;
  validationErrors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface DataCorruptionError extends DataError {
  type: 'DATA_CORRUPTION';
  code: 'DAT003';
  corruptedFields?: string[];
  checksumMismatch?: boolean;
}

// ========================================
// 検証関連エラー
// ========================================

export interface ValidationError extends BaseShapeError {
  category: ErrorCategory.VALIDATION;
  validationContext?: string;
}

export interface InvalidCountryCodeError extends ValidationError {
  type: 'INVALID_COUNTRY_CODE';
  code: 'VAL001';
  invalidCodes: string[];
  validCodes?: string[];
}

export interface InvalidAdminLevelError extends ValidationError {
  type: 'INVALID_ADMIN_LEVEL';
  code: 'VAL002';
  invalidLevels: number[];
  validRange: {
    min: number;
    max: number;
  };
}

export interface ConfigurationError extends ValidationError {
  type: 'CONFIGURATION_ERROR';
  code: 'VAL003';
  invalidFields: Array<{
    field: string;
    value: any;
    reason: string;
  }>;
}

// ========================================
// エラーファクトリー
// ========================================

/**
 * エラーファクトリークラス
 */
export class ShapeErrorFactory {
  /**
   * Worker切断エラーを作成
   */
  static createWorkerDisconnectedError(
    message: string,
    sessionId?: string,
    workerId?: string
  ): WorkerDisconnectedError {
    return {
      name: 'WorkerDisconnectedError',
      category: ErrorCategory.WORKER,
      type: 'WORKER_DISCONNECTED',
      code: 'WRK001',
      severity: ErrorSeverity.ERROR,
      message,
      userMessage: 'バックグラウンド処理との接続が切断されました。',
      recoverable: true,
      retryable: true,
      suggestedActions: [
        {
          type: ActionType.RETRY,
          label: '再接続',
          description: 'Worker接続を再試行します'
        }
      ],
      timestamp: Date.now(),
      sessionId,
      workerId,
      lastHeartbeat: Date.now()
    };
  }

  /**
   * レート制限エラーを作成
   */
  static createRateLimitError(
    url: string,
    retryAfter: number,
    limit?: number
  ): RateLimitError {
    return {
      name: 'RateLimitError',
      category: ErrorCategory.NETWORK,
      type: 'RATE_LIMIT_ERROR',
      code: 'NET003',
      severity: ErrorSeverity.WARNING,
      message: `Rate limit exceeded for ${url}. Retry after ${retryAfter} seconds.`,
      userMessage: `APIの利用制限に達しました。${retryAfter}秒後に再試行してください。`,
      recoverable: true,
      retryable: true,
      suggestedActions: [
        {
          type: ActionType.RETRY_WITH_BACKOFF,
          label: '自動リトライ',
          description: `${retryAfter}秒後に自動的に再試行`,
          params: { delay: retryAfter * 1000 }
        },
        {
          type: ActionType.REDUCE_CONCURRENCY,
          label: '並行数を減らす',
          description: '同時ダウンロード数を減らして再試行'
        }
      ],
      timestamp: Date.now(),
      url,
      method: 'GET',
      retryAfter,
      limit
    };
  }

  /**
   * 無効な国コードエラーを作成
   */
  static createInvalidCountryCodeError(
    invalidCodes: string[],
    validCodes?: string[]
  ): InvalidCountryCodeError {
    return {
      name: 'InvalidCountryCodeError',
      category: ErrorCategory.VALIDATION,
      type: 'INVALID_COUNTRY_CODE',
      code: 'VAL001',
      severity: ErrorSeverity.ERROR,
      message: `Invalid country codes: ${invalidCodes.join(', ')}`,
      userMessage: `無効な国コードが指定されました: ${invalidCodes.join(', ')}`,
      recoverable: true,
      retryable: false,
      suggestedActions: [
        {
          type: ActionType.CHANGE_CONFIGURATION,
          label: '国コードを修正',
          description: '有効なISO A2国コードを選択してください',
          params: { validCodes }
        }
      ],
      timestamp: Date.now(),
      invalidCodes,
      validCodes,
      validationContext: 'country_selection'
    };
  }

  /**
   * Generic Worker error creation
   */
  static createWorkerError(
    type: string,
    message: string,
    metadata?: Record<string, any>
  ): WorkerError {
    return {
      name: 'WorkerError',
      category: ErrorCategory.WORKER,
      type,
      code: type.replace('WORKER_', 'WRK'),
      severity: ErrorSeverity.ERROR,
      message,
      userMessage: message,
      recoverable: true,
      retryable: true,
      suggestedActions: [
        {
          type: ActionType.RETRY,
          label: '再試行',
          description: '処理を再実行します'
        }
      ],
      timestamp: Date.now(),
      metadata: metadata
    };
  }

  /**
   * Generic Network error creation
   */
  static createNetworkError(
    type: string,
    message: string,
    metadata?: Record<string, any>
  ): NetworkError {
    return {
      name: 'NetworkError',
      category: ErrorCategory.NETWORK,
      type,
      code: type.replace('NETWORK_', 'NET').replace('CORS_', 'NET').replace('RATE_LIMIT_', 'NET'),
      severity: ErrorSeverity.ERROR,
      message,
      userMessage: message,
      recoverable: true,
      retryable: true,
      suggestedActions: [
        {
          type: ActionType.CHECK_CONNECTION,
          label: '接続確認',
          description: 'ネットワーク接続を確認してください'
        },
        {
          type: ActionType.RETRY,
          label: '再試行',
          description: '処理を再実行します'
        }
      ],
      timestamp: Date.now(),
      metadata: metadata
    };
  }

  /**
   * Generic Data error creation
   */
  static createDataError(
    type: string,
    message: string,
    metadata?: Record<string, any>
  ): DataError {
    return {
      name: 'DataError',
      category: ErrorCategory.DATA,
      type,
      code: type.replace('INVALID_DATA_FORMAT', 'DAT002').replace('DATA_SOURCE_', 'DAT'),
      severity: ErrorSeverity.ERROR,
      message,
      userMessage: message,
      recoverable: false,
      retryable: false,
      suggestedActions: [
        {
          type: ActionType.REPORT_ISSUE,
          label: '問題を報告',
          description: 'データの問題を報告してください'
        }
      ],
      timestamp: Date.now(),
      metadata: metadata
    };
  }

  /**
   * Generic Validation error creation
   */
  static createValidationError(
    type: string,
    message: string,
    metadata?: Record<string, any>
  ): ValidationError {
    return {
      name: 'ValidationError',
      category: ErrorCategory.VALIDATION,
      type,
      code: type.replace('INVALID_', 'VAL'),
      severity: ErrorSeverity.ERROR,
      message,
      userMessage: message,
      recoverable: true,
      retryable: false,
      suggestedActions: [
        {
          type: ActionType.CHANGE_CONFIGURATION,
          label: '設定を修正',
          description: '入力値を正しい形式に修正してください'
        }
      ],
      timestamp: Date.now(),
      metadata: metadata
    };
  }

  /**
   * Generic System error creation
   */
  static createSystemError(
    type: string,
    message: string,
    metadata?: Record<string, any>
  ): BaseShapeError {
    return {
      name: 'SystemError',
      category: ErrorCategory.SYSTEM,
      type,
      code: type.replace('CIRCUIT_BREAKER_', 'SYS').replace('SYSTEM_', 'SYS'),
      severity: ErrorSeverity.CRITICAL,
      message,
      userMessage: message,
      recoverable: false,
      retryable: false,
      suggestedActions: [
        {
          type: ActionType.REPORT_ISSUE,
          label: 'システム管理者に連絡',
          description: 'システムエラーが発生しました。管理者に連絡してください。'
        }
      ],
      timestamp: Date.now(),
      metadata: metadata
    };
  }
}

// ========================================
// エラー判定ヘルパー
// ========================================

/**
 * エラー型ガード
 */
export const ErrorTypeGuards = {
  isWorkerError: (error: any): error is WorkerError => {
    return error?.category === ErrorCategory.WORKER;
  },
  
  isNetworkError: (error: any): error is NetworkError => {
    return error?.category === ErrorCategory.NETWORK;
  },
  
  isDataError: (error: any): error is DataError => {
    return error?.category === ErrorCategory.DATA;
  },
  
  isValidationError: (error: any): error is ValidationError => {
    return error?.category === ErrorCategory.VALIDATION;
  },
  
  isRetryable: (error: any): boolean => {
    return error?.retryable === true;
  },
  
  isRecoverable: (error: any): boolean => {
    return error?.recoverable === true;
  },
  
  isCritical: (error: any): boolean => {
    return error?.severity === ErrorSeverity.CRITICAL;
  }
};
