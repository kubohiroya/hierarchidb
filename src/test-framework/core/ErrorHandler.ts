// ErrorHandler interface - Error detection, classification, and recovery

import type {
  NodeId,
  SessionId
} from '../types/SessionTypes.js';
import type {
  CapturedEvent
} from '../types/EventTypes.js';

/**
 * ErrorHandler - Interface for comprehensive error handling in build session testing
 * 
 * Provides error detection, classification, and recovery capabilities for
 * the 5 error categories specified in requirements 6.1-6.5:
 * 1. Worker crashes
 * 2. Communication timeouts  
 * 3. Invalid metadata
 * 4. Session timeouts
 * 5. Subscriber callback failures
 */
export interface ErrorHandler {
  /**
   * Detect errors from captured events
   * Analyzes event stream for error patterns and anomalies
   */
  detectErrors(events: CapturedEvent[], nodeId: NodeId): ErrorDetectionResult[];

  /**
   * Classify detected error by severity, impact, and urgency
   * Provides detailed classification for recovery planning
   */
  classifyError(error: ErrorDetectionResult): ErrorClassificationResult;

  /**
   * Attempt error recovery using appropriate strategies
   * Returns recovery result with success status and details
   */
  recoverFromError(
    sessionId: SessionId,
    classification: ErrorClassificationResult
  ): Promise<ErrorRecoveryResult>;

  /**
   * Check if error category is recoverable
   * Returns true if automatic recovery is possible
   */
  isRecoverable(category: ErrorCategory): boolean;

  /**
   * Get error statistics for analysis
   * Provides metrics for error patterns and recovery effectiveness
   */
  getErrorStatistics(sessionId?: SessionId): ErrorStatistics;

  /**
   * Clear error history for cleanup
   * Removes stored error records for memory management
   */
  clearErrorHistory(sessionId?: SessionId): void;
}

/**
 * Error categories as defined in requirements 6.1-6.5
 */
export type ErrorCategory = 
  | 'worker-crash'                    // 6.1: Worker process crashes
  | 'communication-timeout'           // 6.2: Communication timeouts
  | 'invalid-metadata'               // 6.3: Invalid metadata
  | 'session-timeout'                // 6.4: Session timeouts
  | 'subscriber-callback-failure';   // 6.5: Subscriber callback failures

/**
 * Error detection result
 */
export interface ErrorDetectionResult {
  errorId: string;
  category: ErrorCategory;
  timestamp: number;
  nodeId: NodeId;
  description: string;
  context: Record<string, any>;
}

/**
 * Error classification result with severity and impact assessment
 */
export interface ErrorClassificationResult {
  errorId: string;
  category: ErrorCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  isRecurring: boolean;
  cascadeRisk: 'low' | 'medium' | 'high';
  recommendedActions: string[];
  estimatedRecoveryTime: number; // milliseconds
}

/**
 * Error recovery result
 */
export interface ErrorRecoveryResult {
  success: boolean;
  recoveryTime: number; // milliseconds
  strategyUsed: string;
  details?: string;
  error?: string;
}

/**
 * Error recovery strategy configuration
 */
export interface ErrorRecoveryStrategy {
  name: string;
  priority: number;
  maxAttempts: number;
  timeoutMs: number;
}

/**
 * Error statistics for analysis
 */
export interface ErrorStatistics {
  totalErrors: number;
  recoveredErrors: number;
  recoveryRate: number;
  averageRecoveryTime: number;
  errorsByCategory: Record<string, number>;
  mostCommonCategory: ErrorCategory | null;
}