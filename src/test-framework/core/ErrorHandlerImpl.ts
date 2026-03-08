// ErrorHandlerImpl - Error detection, classification, and recovery implementation

import type {
  ErrorHandler,
  ErrorCategory,
  ErrorClassificationResult,
  ErrorRecoveryResult,
  ErrorRecoveryStrategy
} from './ErrorHandler.js';
import type {
  NodeId,
  SessionId
} from '../types/SessionTypes.js';
import type {
  NotificationType,
  CapturedEvent
} from '../types/EventTypes.js';

/**
 * ErrorHandlerImpl - Concrete implementation of comprehensive error handling
 * 
 * Provides error detection, classification, and recovery capabilities for
 * build session testing. Handles 5 error categories as specified in requirements 6.1-6.5.
 * 
 * Error Categories:
 * 1. Worker crashes (6.1)
 * 2. Communication timeouts (6.2) 
 * 3. Invalid metadata (6.3)
 * 4. Session timeouts (6.4)
 * 5. Subscriber callback failures (6.5)
 */
export class ErrorHandlerImpl implements ErrorHandler {
  private readonly errorHistory = new Map<SessionId, ErrorRecord[]>();
  private readonly recoveryStrategies = new Map<ErrorCategory, ErrorRecoveryStrategy[]>();
  private readonly errorThresholds = new Map<ErrorCategory, number>();
  private errorCounter = 0;

  constructor() {
    this.initializeRecoveryStrategies();
    this.initializeErrorThresholds();
  }

  /**
   * Detect errors from captured events
   * Contract: events must be provided, nodeId must be valid
   */
  detectErrors(events: CapturedEvent[], nodeId: NodeId): ErrorDetectionResult[] {
    // Contract validation - immediate error on violation
    if (!events) {
      throw new Error('Contract violation: events must be provided');
    }

    if (!nodeId || typeof nodeId !== 'string' || nodeId.trim() === '') {
      throw new Error('Contract violation: nodeId must be non-empty string');
    }

    const detectedErrors: ErrorDetectionResult[] = [];

    // Analyze events for error patterns
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      
      // Worker crash detection (6.1)
      const workerCrashError = this.detectWorkerCrash(event, events, i);
      if (workerCrashError) {
        detectedErrors.push(workerCrashError);
      }

      // Communication timeout detection (6.2)
      const timeoutError = this.detectCommunicationTimeout(event, events, i);
      if (timeoutError) {
        detectedErrors.push(timeoutError);
      }

      // Invalid metadata detection (6.3)
      const metadataError = this.detectInvalidMetadata(event);
      if (metadataError) {
        detectedErrors.push(metadataError);
      }

      // Session timeout detection (6.4)
      const sessionTimeoutError = this.detectSessionTimeout(event, events, i);
      if (sessionTimeoutError) {
        detectedErrors.push(sessionTimeoutError);
      }

      // Subscriber callback failure detection (6.5)
      const callbackError = this.detectSubscriberCallbackFailure(event);
      if (callbackError) {
        detectedErrors.push(callbackError);
      }
    }

    return detectedErrors;
  }

  /**
   * Classify detected error
   * Contract: error must be valid ErrorDetectionResult
   */
  classifyError(error: ErrorDetectionResult): ErrorClassificationResult {
    // Contract validation
    if (!error || !error.category || !error.errorId) {
      throw new Error('Contract violation: error must be valid ErrorDetectionResult');
    }

    const validCategories: ErrorCategory[] = [
      'worker-crash', 'communication-timeout', 'invalid-metadata',
      'session-timeout', 'subscriber-callback-failure'
    ];

    if (!validCategories.includes(error.category)) {
      throw new Error(`Contract violation: invalid error category '${error.category}'`);
    }

    // Determine severity based on category and context
    let severity: 'low' | 'medium' | 'high' | 'critical';
    let impact: string;
    let urgency: 'low' | 'medium' | 'high' | 'critical';

    switch (error.category) {
      case 'worker-crash':
        severity = 'critical';
        impact = 'Complete session failure, all tasks affected';
        urgency = 'critical';
        break;

      case 'communication-timeout':
        severity = 'high';
        impact = 'Event delivery disruption, potential data loss';
        urgency = 'high';
        break;

      case 'invalid-metadata':
        severity = 'high';
        impact = 'Session initialization failure, cannot proceed';
        urgency = 'high';
        break;

      case 'session-timeout':
        severity = 'medium';
        impact = 'Session cleanup required, progress may be lost';
        urgency = 'medium';
        break;

      case 'subscriber-callback-failure':
        severity = 'medium';
        impact = 'UI update failure, user experience degraded';
        urgency = 'medium';
        break;

      default:
        // This should never happen due to contract validation above
        throw new Error(`Unhandled error category: ${error.category}`);
    }

    // Check for error frequency patterns
    const isRecurring = this.checkRecurringPattern(error);
    const cascadeRisk = this.assessCascadeRisk(error);

    // Adjust severity based on patterns
    if (isRecurring && severity !== 'critical') {
      severity = this.escalateSeverity(severity);
    }

    if (cascadeRisk === 'high' && urgency !== 'critical') {
      urgency = this.escalateUrgency(urgency);
    }

    return {
      errorId: error.errorId,
      category: error.category,
      severity,
      impact,
      urgency,
      isRecurring,
      cascadeRisk,
      recommendedActions: this.generateRecommendedActions(error.category, severity),
      estimatedRecoveryTime: this.estimateRecoveryTime(error.category, severity)
    };
  }

  /**
   * Attempt error recovery
   * Contract: sessionId and classification must be valid
   */
  async recoverFromError(
    sessionId: SessionId,
    classification: ErrorClassificationResult
  ): Promise<ErrorRecoveryResult> {
    // Contract validation
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      throw new Error('Contract violation: sessionId must be non-empty string');
    }

    if (!classification || !classification.errorId || !classification.category) {
      throw new Error('Contract violation: classification must be valid ErrorClassificationResult');
    }

    const recoveryStartTime = Date.now();
    const strategies = this.recoveryStrategies.get(classification.category) || [];

    if (strategies.length === 0) {
      return {
        success: false,
        recoveryTime: 0,
        strategyUsed: 'none',
        error: `No recovery strategies available for category '${classification.category}'`
      };
    }

    // Try recovery strategies in order of preference
    for (const strategy of strategies) {
      try {
        const strategyResult = await this.executeRecoveryStrategy(
          sessionId,
          classification,
          strategy
        );

        if (strategyResult.success) {
          const recoveryTime = Date.now() - recoveryStartTime;
          
          // Record successful recovery
          this.recordRecoverySuccess(sessionId, classification, strategy, recoveryTime);

          return {
            success: true,
            recoveryTime,
            strategyUsed: strategy.name,
            details: strategyResult.details
          };
        }
      } catch (error) {
        // Continue to next strategy
        console.warn(`Recovery strategy '${strategy.name}' failed:`, error);
      }
    }

    // All strategies failed
    const recoveryTime = Date.now() - recoveryStartTime;
    this.recordRecoveryFailure(sessionId, classification, recoveryTime);

    return {
      success: false,
      recoveryTime,
      strategyUsed: 'all-failed',
      error: 'All recovery strategies failed'
    };
  }

  /**
   * Check if error is recoverable
   * Contract: category must be valid ErrorCategory
   */
  isRecoverable(category: ErrorCategory): boolean {
    // Contract validation
    const validCategories: ErrorCategory[] = [
      'worker-crash', 'communication-timeout', 'invalid-metadata',
      'session-timeout', 'subscriber-callback-failure'
    ];

    if (!validCategories.includes(category)) {
      throw new Error(`Contract violation: invalid error category '${category}'`);
    }

    // Define recoverability by category
    switch (category) {
      case 'worker-crash':
        return true; // Can restart worker
      case 'communication-timeout':
        return true; // Can retry communication
      case 'invalid-metadata':
        return false; // Cannot fix invalid metadata automatically
      case 'session-timeout':
        return true; // Can extend or restart session
      case 'subscriber-callback-failure':
        return true; // Can isolate failing subscriber
      default:
        return false;
    }
  }

  /**
   * Get error statistics for analysis
   * Contract: sessionId must be valid if provided
   */
  getErrorStatistics(sessionId?: SessionId): ErrorStatistics {
    // Contract validation
    if (sessionId !== undefined) {
      if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
        throw new Error('Contract violation: sessionId must be non-empty string if provided');
      }
    }

    if (sessionId) {
      // Statistics for specific session
      const sessionErrors = this.errorHistory.get(sessionId) || [];
      return this.calculateSessionStatistics(sessionErrors);
    } else {
      // Global statistics across all sessions
      return this.calculateGlobalStatistics();
    }
  }

  /**
   * Clear error history for cleanup
   * Contract: sessionId must be valid if provided
   */
  clearErrorHistory(sessionId?: SessionId): void {
    // Contract validation
    if (sessionId !== undefined) {
      if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
        throw new Error('Contract violation: sessionId must be non-empty string if provided');
      }
    }

    if (sessionId) {
      this.errorHistory.delete(sessionId);
    } else {
      this.errorHistory.clear();
    }
  }

  // Private helper methods

  private initializeRecoveryStrategies(): void {
    // Worker crash recovery strategies
    this.recoveryStrategies.set('worker-crash', [
      {
        name: 'restart-worker',
        priority: 1,
        maxAttempts: 3,
        timeoutMs: 30000
      },
      {
        name: 'fallback-to-main-thread',
        priority: 2,
        maxAttempts: 1,
        timeoutMs: 60000
      }
    ]);

    // Communication timeout recovery strategies
    this.recoveryStrategies.set('communication-timeout', [
      {
        name: 'retry-with-backoff',
        priority: 1,
        maxAttempts: 5,
        timeoutMs: 10000
      },
      {
        name: 'reset-connection',
        priority: 2,
        maxAttempts: 2,
        timeoutMs: 20000
      }
    ]);

    // Invalid metadata recovery strategies
    this.recoveryStrategies.set('invalid-metadata', [
      {
        name: 'validate-and-sanitize',
        priority: 1,
        maxAttempts: 1,
        timeoutMs: 5000
      }
    ]);

    // Session timeout recovery strategies
    this.recoveryStrategies.set('session-timeout', [
      {
        name: 'extend-session',
        priority: 1,
        maxAttempts: 2,
        timeoutMs: 5000
      },
      {
        name: 'restart-session',
        priority: 2,
        maxAttempts: 1,
        timeoutMs: 30000
      }
    ]);

    // Subscriber callback failure recovery strategies
    this.recoveryStrategies.set('subscriber-callback-failure', [
      {
        name: 'isolate-failing-subscriber',
        priority: 1,
        maxAttempts: 1,
        timeoutMs: 1000
      },
      {
        name: 'reset-subscriber-state',
        priority: 2,
        maxAttempts: 2,
        timeoutMs: 5000
      }
    ]);
  }

  private initializeErrorThresholds(): void {
    this.errorThresholds.set('worker-crash', 3);
    this.errorThresholds.set('communication-timeout', 10);
    this.errorThresholds.set('invalid-metadata', 1);
    this.errorThresholds.set('session-timeout', 5);
    this.errorThresholds.set('subscriber-callback-failure', 20);
  }

  private detectWorkerCrash(
    event: CapturedEvent,
    events: CapturedEvent[],
    index: number
  ): ErrorDetectionResult | null {
    // Look for worker crash indicators
    if (event.eventType === 'error' && event.payload) {
      const payload = event.payload as any;
      
      if (payload.type === 'worker-crash' || 
          payload.message?.includes('worker terminated') ||
          payload.message?.includes('worker crashed')) {
        
        return {
          errorId: `worker_crash_${++this.errorCounter}`,
          category: 'worker-crash',
          timestamp: event.timestamp,
          nodeId: event.nodeId,
          description: 'Worker process crashed unexpectedly',
          context: {
            eventIndex: index,
            payload: payload
          }
        };
      }
    }

    return null;
  }

  private detectCommunicationTimeout(
    event: CapturedEvent,
    events: CapturedEvent[],
    index: number
  ): ErrorDetectionResult | null {
    // Look for communication timeout patterns
    if (index > 0) {
      const prevEvent = events[index - 1];
      const timeDiff = event.timestamp - prevEvent.timestamp;
      
      // Timeout threshold: 30 seconds
      if (timeDiff > 30000 && event.eventType === 'heartbeat') {
        return {
          errorId: `comm_timeout_${++this.errorCounter}`,
          category: 'communication-timeout',
          timestamp: event.timestamp,
          nodeId: event.nodeId,
          description: `Communication timeout detected: ${timeDiff}ms gap`,
          context: {
            eventIndex: index,
            timeDiff,
            prevEventType: prevEvent.eventType
          }
        };
      }
    }

    return null;
  }

  private detectInvalidMetadata(event: CapturedEvent): ErrorDetectionResult | null {
    // Look for invalid metadata in session-state events
    if (event.eventType === 'session-state' && event.payload) {
      const payload = event.payload as any;
      
      // Check for required metadata fields
      if (payload.metadata) {
        const metadata = payload.metadata;
        
        // Contract violations in metadata
        if (!metadata.nodeId || typeof metadata.nodeId !== 'string') {
          return {
            errorId: `invalid_metadata_${++this.errorCounter}`,
            category: 'invalid-metadata',
            timestamp: event.timestamp,
            nodeId: event.nodeId,
            description: 'Invalid metadata: missing or invalid nodeId',
            context: {
              metadata: metadata
            }
          };
        }

        if (!metadata.buildType || !['new', 'reset', 'cache-cleared'].includes(metadata.buildType)) {
          return {
            errorId: `invalid_metadata_${++this.errorCounter}`,
            category: 'invalid-metadata',
            timestamp: event.timestamp,
            nodeId: event.nodeId,
            description: 'Invalid metadata: invalid buildType',
            context: {
              metadata: metadata
            }
          };
        }

        if (!Array.isArray(metadata.stages) || metadata.stages.length === 0) {
          return {
            errorId: `invalid_metadata_${++this.errorCounter}`,
            category: 'invalid-metadata',
            timestamp: event.timestamp,
            nodeId: event.nodeId,
            description: 'Invalid metadata: invalid stages array',
            context: {
              metadata: metadata
            }
          };
        }
      }
    }

    return null;
  }

  private detectSessionTimeout(
    event: CapturedEvent,
    events: CapturedEvent[],
    index: number
  ): ErrorDetectionResult | null {
    // Look for session timeout indicators
    if (event.eventType === 'session-state' && event.payload) {
      const payload = event.payload as any;
      
      if (payload.status === 'timeout' || payload.error?.includes('timeout')) {
        return {
          errorId: `session_timeout_${++this.errorCounter}`,
          category: 'session-timeout',
          timestamp: event.timestamp,
          nodeId: event.nodeId,
          description: 'Session timeout detected',
          context: {
            eventIndex: index,
            sessionStatus: payload.status,
            error: payload.error
          }
        };
      }
    }

    return null;
  }

  private detectSubscriberCallbackFailure(event: CapturedEvent): ErrorDetectionResult | null {
    // Look for subscriber callback failure indicators
    if (event.eventType === 'error' && event.payload) {
      const payload = event.payload as any;
      
      if (payload.type === 'subscriber-error' || 
          payload.message?.includes('callback failed') ||
          payload.message?.includes('subscriber exception')) {
        
        return {
          errorId: `callback_failure_${++this.errorCounter}`,
          category: 'subscriber-callback-failure',
          timestamp: event.timestamp,
          nodeId: event.nodeId,
          description: 'Subscriber callback execution failed',
          context: {
            payload: payload
          }
        };
      }
    }

    return null;
  }

  private checkRecurringPattern(error: ErrorDetectionResult): boolean {
    // Simple recurring pattern detection
    // In real implementation, would analyze error history for patterns
    return false;
  }

  private assessCascadeRisk(error: ErrorDetectionResult): 'low' | 'medium' | 'high' {
    // Assess risk of error cascading to other components
    switch (error.category) {
      case 'worker-crash':
        return 'high'; // Can affect entire session
      case 'communication-timeout':
        return 'medium'; // Can affect event delivery
      case 'invalid-metadata':
        return 'high'; // Can prevent session start
      case 'session-timeout':
        return 'low'; // Isolated to session
      case 'subscriber-callback-failure':
        return 'low'; // Isolated to subscriber
      default:
        return 'medium';
    }
  }

  private escalateSeverity(severity: 'low' | 'medium' | 'high' | 'critical'): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity) {
      case 'low': return 'medium';
      case 'medium': return 'high';
      case 'high': return 'critical';
      case 'critical': return 'critical';
      default: return severity;
    }
  }

  private escalateUrgency(urgency: 'low' | 'medium' | 'high' | 'critical'): 'low' | 'medium' | 'high' | 'critical' {
    switch (urgency) {
      case 'low': return 'medium';
      case 'medium': return 'high';
      case 'high': return 'critical';
      case 'critical': return 'critical';
      default: return urgency;
    }
  }

  private generateRecommendedActions(category: ErrorCategory, severity: 'low' | 'medium' | 'high' | 'critical'): string[] {
    const actions: string[] = [];

    switch (category) {
      case 'worker-crash':
        actions.push('Restart worker process');
        if (severity === 'critical') {
          actions.push('Fallback to main thread execution');
          actions.push('Investigate crash cause');
        }
        break;

      case 'communication-timeout':
        actions.push('Retry communication with exponential backoff');
        if (severity === 'high' || severity === 'critical') {
          actions.push('Reset connection');
          actions.push('Check network connectivity');
        }
        break;

      case 'invalid-metadata':
        actions.push('Validate and sanitize metadata');
        actions.push('Request corrected metadata from source');
        break;

      case 'session-timeout':
        actions.push('Extend session timeout');
        if (severity === 'high' || severity === 'critical') {
          actions.push('Restart session with saved state');
        }
        break;

      case 'subscriber-callback-failure':
        actions.push('Isolate failing subscriber');
        actions.push('Reset subscriber state');
        if (severity === 'high' || severity === 'critical') {
          actions.push('Remove problematic subscriber');
        }
        break;
    }

    return actions;
  }

  private estimateRecoveryTime(category: ErrorCategory, severity: 'low' | 'medium' | 'high' | 'critical'): number {
    // Estimate recovery time in milliseconds
    const baseTime = {
      'worker-crash': 30000,
      'communication-timeout': 10000,
      'invalid-metadata': 5000,
      'session-timeout': 15000,
      'subscriber-callback-failure': 2000
    };

    const severityMultiplier = {
      'low': 1,
      'medium': 1.5,
      'high': 2,
      'critical': 3
    };

    return baseTime[category] * severityMultiplier[severity];
  }

  private async executeRecoveryStrategy(
    sessionId: SessionId,
    classification: ErrorClassificationResult,
    strategy: ErrorRecoveryStrategy
  ): Promise<{ success: boolean; details?: string }> {
    // Simulate recovery strategy execution
    // In real implementation, would execute actual recovery logic
    
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
    
    // Success rate varies by strategy and error category
    const successRate = this.getStrategySuccessRate(classification.category, strategy.name);
    const success = Math.random() < successRate;
    
    return {
      success,
      details: success 
        ? `Strategy '${strategy.name}' executed successfully`
        : `Strategy '${strategy.name}' failed to recover`
    };
  }

  private getStrategySuccessRate(category: ErrorCategory, strategyName: string): number {
    // Define success rates for different strategy/category combinations
    const rates: Record<string, number> = {
      'worker-crash:restart-worker': 0.8,
      'worker-crash:fallback-to-main-thread': 0.95,
      'communication-timeout:retry-with-backoff': 0.7,
      'communication-timeout:reset-connection': 0.9,
      'invalid-metadata:validate-and-sanitize': 0.6,
      'session-timeout:extend-session': 0.85,
      'session-timeout:restart-session': 0.95,
      'subscriber-callback-failure:isolate-failing-subscriber': 0.9,
      'subscriber-callback-failure:reset-subscriber-state': 0.75
    };

    return rates[`${category}:${strategyName}`] || 0.5;
  }

  private recordRecoverySuccess(
    sessionId: SessionId,
    classification: ErrorClassificationResult,
    strategy: ErrorRecoveryStrategy,
    recoveryTime: number
  ): void {
    const record: ErrorRecord = {
      errorId: classification.errorId,
      category: classification.category,
      timestamp: Date.now(),
      recovered: true,
      recoveryStrategy: strategy.name,
      recoveryTime
    };

    this.addErrorRecord(sessionId, record);
  }

  private recordRecoveryFailure(
    sessionId: SessionId,
    classification: ErrorClassificationResult,
    recoveryTime: number
  ): void {
    const record: ErrorRecord = {
      errorId: classification.errorId,
      category: classification.category,
      timestamp: Date.now(),
      recovered: false,
      recoveryTime
    };

    this.addErrorRecord(sessionId, record);
  }

  private addErrorRecord(sessionId: SessionId, record: ErrorRecord): void {
    if (!this.errorHistory.has(sessionId)) {
      this.errorHistory.set(sessionId, []);
    }
    
    const records = this.errorHistory.get(sessionId)!;
    records.push(record);
    
    // Keep only last 100 records per session
    if (records.length > 100) {
      records.splice(0, records.length - 100);
    }
  }

  private calculateSessionStatistics(errors: ErrorRecord[]): ErrorStatistics {
    const totalErrors = errors.length;
    const recoveredErrors = errors.filter(e => e.recovered).length;
    const recoveryRate = totalErrors > 0 ? recoveredErrors / totalErrors : 0;

    const errorsByCategory = new Map<ErrorCategory, number>();
    let totalRecoveryTime = 0;

    for (const error of errors) {
      const count = errorsByCategory.get(error.category) || 0;
      errorsByCategory.set(error.category, count + 1);
      
      if (error.recoveryTime) {
        totalRecoveryTime += error.recoveryTime;
      }
    }

    const averageRecoveryTime = recoveredErrors > 0 ? totalRecoveryTime / recoveredErrors : 0;

    return {
      totalErrors,
      recoveredErrors,
      recoveryRate,
      averageRecoveryTime,
      errorsByCategory: Object.fromEntries(errorsByCategory),
      mostCommonCategory: this.getMostCommonCategory(errorsByCategory)
    };
  }

  private calculateGlobalStatistics(): ErrorStatistics {
    const allErrors: ErrorRecord[] = [];
    
    for (const sessionErrors of this.errorHistory.values()) {
      allErrors.push(...sessionErrors);
    }

    return this.calculateSessionStatistics(allErrors);
  }

  private getMostCommonCategory(errorsByCategory: Map<ErrorCategory, number>): ErrorCategory | null {
    let maxCount = 0;
    let mostCommon: ErrorCategory | null = null;

    for (const [category, count] of errorsByCategory.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = category;
      }
    }

    return mostCommon;
  }
}

// Internal interfaces for error handling

interface ErrorDetectionResult {
  errorId: string;
  category: ErrorCategory;
  timestamp: number;
  nodeId: NodeId;
  description: string;
  context: Record<string, any>;
}

interface ErrorRecord {
  errorId: string;
  category: ErrorCategory;
  timestamp: number;
  recovered: boolean;
  recoveryStrategy?: string;
  recoveryTime?: number;
}

interface ErrorStatistics {
  totalErrors: number;
  recoveredErrors: number;
  recoveryRate: number;
  averageRecoveryTime: number;
  errorsByCategory: Record<string, number>;
  mostCommonCategory: ErrorCategory | null;
}