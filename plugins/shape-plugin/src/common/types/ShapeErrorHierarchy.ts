import type { TreeNodeId } from '@hierarchidb/common-types';

export enum ErrorCategory {
  WORKER = 'worker',           //  Worker
  NETWORK = 'network', DATA = 'data', VALIDATION = 'validation', SYSTEM = 'system'
}

export enum ErrorSeverity {
  CRITICAL = 'CRITICAL', ERROR = 'ERROR', WARNING = 'WARNING', INFO = 'INFO'
}

export type ErrorMetadata = Record<string, unknown>;

export interface BaseShapeError extends Error {
  category: ErrorCategory;
  type: string;
  code: string;
  severity: ErrorSeverity;

  message: string;
  userMessage?: string;
  technicalDetails?: ErrorMetadata;

  recoverable: boolean;
  retryable: boolean;
  suggestedActions?: SuggestedAction[];

  timestamp: number;
  sessionId?: string;
  treeNodeId?: TreeNodeId;
  stage?: BatchProcessingStage;
  metadata?: ErrorMetadata;

  cause?: Error | BaseShapeError;
  stack?: string;
}

export interface SuggestedAction {
  type: ActionType;
  label: string;
  description?: string;
  params?: ErrorMetadata;
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
    value: unknown;
    reason: string;
  }>;
}

export class ShapeErrorFactory {
  static createWorkerDisconnectedError(
    message: string,
    sessionId?: string,
    workerId?: string,
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
          description: 'Worker接続を再試行します',
        },
      ],
      timestamp: Date.now(),
      sessionId,
      workerId,
      lastHeartbeat: Date.now(),
    };
  }

  static createRateLimitError(
    url: string,
    retryAfter: number,
    limit?: number,
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
          params: { delay: retryAfter * 1000 },
        },
        {
          type: ActionType.REDUCE_CONCURRENCY,
          label: '並行数を減らす',
          description: '同時ダウンロード数を減らして再試行',
        },
      ],
      timestamp: Date.now(),
      url,
      method: 'GET',
      retryAfter,
      limit,
    };
  }

  static createInvalidCountryCodeError(
    invalidCodes: string[],
    validCodes?: string[],
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
          params: { validCodes },
        },
      ],
      timestamp: Date.now(),
      invalidCodes,
      validCodes,
      validationContext: 'country_selection',
    };
  }

  /**
   * Generic Worker error creation
   */
  static createWorkerError(
    type: string,
    message: string,
    metadata?: ErrorMetadata,
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
          description: '処理を再実行します',
        },
      ],
      timestamp: Date.now(),
      metadata: metadata,
    };
  }

  /**
   * Generic Network error creation
   */
  static createNetworkError(
    type: string,
    message: string,
    metadata?: ErrorMetadata,
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
          description: 'ネットワーク接続を確認してください',
        },
        {
          type: ActionType.RETRY,
          label: '再試行',
          description: '処理を再実行します',
        },
      ],
      timestamp: Date.now(),
      metadata: metadata,
    };
  }

  /**
   * Generic Data error creation
   */
  static createDataError(
    type: string,
    message: string,
    metadata?: ErrorMetadata,
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
          description: 'データの問題を報告してください',
        },
      ],
      timestamp: Date.now(),
      metadata: metadata,
    };
  }

  /**
   * Generic Validation error creation
   */
  static createValidationError(
    type: string,
    message: string,
    metadata?: ErrorMetadata,
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
          description: '入力値を正しい形式に修正してください',
        },
      ],
      timestamp: Date.now(),
      metadata: metadata,
    };
  }

  /**
   * Generic System error creation
   */
  static createSystemError(
    type: string,
    message: string,
    metadata?: ErrorMetadata,
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
          description: 'システムエラーが発生しました。管理者に連絡してください。',
        },
      ],
      timestamp: Date.now(),
      metadata: metadata,
    };
  }
}

/*
export const ErrorTypeGuards = {
  isWorkerError: (error: unknown): error is WorkerError => {
    return error?.category === ErrorCategory.WORKER;
  },

  isNetworkError: (error: unknown): error is NetworkError => {
    return error?.category === ErrorCategory.NETWORK;
  },

  isDataError: (error: unknown): error is DataError => {
    return error?.category === ErrorCategory.DATA;
  },

  isValidationError: (error: unknown): error is ValidationError => {
    return error?.category === ErrorCategory.VALIDATION;
  },

  isRetryable: (error: unknown): boolean => {
    return error?.retryable === true;
  },

  isRecoverable: (error: unknown): boolean => {
    return error?.recoverable === true;
  },

  isCritical: (error: unknown): boolean => {
    return error?.severity === ErrorSeverity.CRITICAL;
  },
};
*/