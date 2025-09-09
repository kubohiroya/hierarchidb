/**
  * @file ShapeError.ts
 * @description ERIA-Cartograph: Shape
  */

export type ShapeErrorType =
  | 'WORKER_DISCONNECTED'
  | 'WORKER_TIMEOUT'
  | 'WORKER_MEMORY_ERROR'
  | 'INVALID_COUNTRY_CODE'
  | 'DATA_SOURCE_ERROR'
  | 'INVALID_DATA_FORMAT'
  | 'NETWORK_ERROR'
  | 'CORS_ERROR'
  | 'RATE_LIMIT_ERROR';

/**
 * Shape processing error
 */
export interface ShapeError extends Error {
  type: ShapeErrorType;
  code?: string;
  recoverable: boolean;
  retryable?: boolean;
  retryDelay?: number;
  suggestedAction?: string;
  userFriendlyMessage?: string;
  invalidCodes?: string[];
  retryAfter?: number;
  exponentialBackoff?: boolean;
}