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
  nodeId?: string;
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
  | 'extract1'
  | 'extract2'
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
