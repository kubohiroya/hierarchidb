/**
 * Types for Worker Initialization Notification System
 */

/**
 * Message types for worker initialization communication
 */
export type WorkerInitMessageType =
  | 'INIT_REQUEST'
  | 'INIT_COMPLETE'
  | 'INIT_ERROR'
  | 'INIT_PROGRESS'
  | 'PING'
  | 'PING_RESPONSE';

/**
 * Request message from UI to Worker
 */
export interface WorkerInitRequest {
  type: 'INIT_REQUEST' | 'PING';
  timestamp?: number;
}

/**
 * Response message from Worker to UI
 */
export interface WorkerInitMessage {
  type: WorkerInitMessageType;
  payload?: {
    progress?: number;    // 0-100
    message?: string;     // Status description
    error?: string;       // Error details
    timestamp?: number;   // Message timestamp
  };
}

/**
 * Configuration for Worker initialization
 */
export interface WorkerInitConfig {
  /** Worker instance to monitor */
  worker: Worker;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Initialization step definition
 */
export interface InitializationStep {
  /** Step name/identifier */
  name: string;
  /** Weight for progress calculation (0-100) */
  weight: number;
  /** Optional description */
  description?: string;
}

/**
 * Worker initialization state
 */
export type WorkerInitState =
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'error';

/**
 * Initialization result
 */
export interface InitializationResult {
  success: boolean;
  duration?: number;
  error?: Error;
}