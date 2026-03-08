// Error handling and classification type definitions

export interface ErrorHandler {
  // Error detection and classification
  detectError(context: ExecutionContext): ErrorClassification | null;
  classifyError(error: Error, context: ExecutionContext): ErrorSeverity;
  
  // Error response and recovery
  handleError(error: ClassifiedError): ErrorResponse;
  attemptRecovery(error: ClassifiedError): RecoveryResult;
  
  // Error reporting and logging
  reportError(error: ClassifiedError, response: ErrorResponse): void;
  logError(error: ClassifiedError, context: ExecutionContext): void;
}

export interface ExecutionContext {
  sessionId?: SessionId;
  nodeId?: NodeId;
  stage?: BuildStage;
  taskId?: TaskId;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ErrorClassification {
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverable: boolean;
  requiresUserIntervention: boolean;
}

export type ErrorCategory = 
  | 'worker-communication'
  | 'event-streaming'
  | 'session-state'
  | 'performance'
  | 'data-integrity';

export type ErrorSeverity = 
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export interface ClassifiedError {
  originalError: Error;
  classification: ErrorClassification;
  context: ExecutionContext;
  detectedAt: number;
}

export interface ErrorResponse {
  action: ErrorAction;
  message: string;
  retryable: boolean;
  retryDelay?: number;
  fallbackStrategy?: string;
}

export type ErrorAction = 
  | 'retry'
  | 'fallback'
  | 'abort'
  | 'escalate'
  | 'ignore';

export interface RecoveryResult {
  success: boolean;
  action: string;
  duration: number;
  error?: Error;
  metadata?: Record<string, unknown>;
}

import type { SessionId, NodeId, BuildStage, TaskId } from './SessionTypes.js';