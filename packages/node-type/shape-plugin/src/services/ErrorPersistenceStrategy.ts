/**
  * @file ErrorPersistenceStrategy.ts
 * @description HierarchiDB
   * - EphemeralDB:
 * - CoreDB:
 * - :
  */

import Dexie, { Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-type';
import { BaseShapeError, ErrorCategory, ErrorSeverity } from '../types/ShapeErrorHierarchy';

// ========================================
// ========================================

/**
    */
export enum StorageTarget {
  MEMORY = 'MEMORY', EPHEMERAL = 'EPHEMERAL', CORE = 'CORE', HYBRID = 'HYBRID',
}

/**
    */
export interface PersistenceStrategy {
  errorSummary: StorageTarget.CORE;

  errorDetails: StorageTarget.EPHEMERAL;
  stackTrace: StorageTarget.EPHEMERAL;
  technicalContext: StorageTarget.EPHEMERAL;

  recoveryAttempts: StorageTarget.EPHEMERAL;
  checkpoints: StorageTarget.EPHEMERAL;

  realtimeStats: StorageTarget.MEMORY;
  aggregatedStats: StorageTarget.CORE;

  taskErrors: StorageTarget.EPHEMERAL;
  taskDependencies: StorageTarget.MEMORY;
}

// ========================================
//  CoreDB
// ========================================

/**
  * CoreDB
  */
export interface CoreErrorSummary {
  id: string;
  nodeId: NodeId;
  treeNodeId: NodeId;
  sessionId: string;

  errorType: string;
  errorCode: string;
  category: ErrorCategory;
  severity: ErrorSeverity;

  occurredAt: number;
  resolvedAt?: number;

  wasResolved: boolean;
  resolutionType?: 'auto' | 'manual' | 'skipped';

  retryCount: number;
  recoveryDuration?: number;
  dataLossOccurred: boolean;
}

// ========================================
//  EphemeralDB
// ========================================

/**
  * EphemeralDB
  */
export interface EphemeralErrorDetails {
  sessionId: string;
  treeNodeId: string;

  fullError: {
    type: string;
    category: string;
    severity: string;
    message: string;
    timestamp: number;
    recoverable: boolean;
    retryable: boolean;
  };

  context: {
    timestamp: number;
    errorCount: number;
  };

  debug: {};

  recovery: {
    attempts: [];
    checkpoints: [];
  };

  taskErrors: {};

  expiresAt: number;
}

/**
    */
export interface CheckpointData {
  id: string;
  timestamp: number;
  stage: string;
  completedTasks: string[];
  pendingTasks: string[];
  state: Record<string, any>;
  isValid: boolean;
}

/**
    */
export interface TaskErrorMap {
  [taskId: string]: {
    error: BaseShapeError;
    retryCount: number;
    lastAttempt: number;
    canSkip: boolean;
    dependencies: string[];
  };
}

// ========================================
// ========================================

/**
    */
export class RuntimeErrorCache {
  private activeErrors = new Map<string, BaseShapeError>();

  private taskDependencies = new Map<string, Set<string>>();

  public sessionErrors = new Map<
    string,
    Array<{
      timestamp: number;
      stage?: string;
      metadata?: any;
    }>
  >();

  private stats = {
    totalErrors: 0,
    errorsByType: new Map<string, number>(),
    errorRate: 0,
    lastErrorTime: 0,
    recoverySuccessRate: 0,
  };

  //  Circuit Breaker
  private circuitBreakers = new Map<
    string,
    {
      state: 'open' | 'half-open' | 'closed';
      failures: number;
      lastFailure: number;
      nextRetry: number;
    }
  >();

  /**
            */
  addError(sessionId: string, error: BaseShapeError): void {
    this.activeErrors.set(sessionId, error);
    this.updateStatistics(error);
    this.updateCircuitBreaker(error);
  }

  /**
            */
  updateDependencies(taskId: string, dependencies: string[]): void {
    this.taskDependencies.set(taskId, new Set(dependencies));
  }

  /**
            */
  getAffectedTasks(failedTaskId: string): string[] {
    const affected: string[] = [];

    for (const [taskId, deps] of this.taskDependencies) {
      if (deps.has(failedTaskId)) {
        affected.push(taskId);
      }
    }

    return affected;
  }

  /**
      * Circuit Breaker
      */
  shouldCircuitBreak(serviceId: string): boolean {
    const breaker = this.circuitBreakers.get(serviceId);
    if (!breaker) return false;

    if (breaker.state === 'open') {
      if (Date.now() >= breaker.nextRetry) {
        breaker.state = 'half-open';
        return false;
      }
      return true;
    }

    return false;
  }

  private updateStatistics(error: BaseShapeError): void {
    this.stats.totalErrors++;
    this.stats.errorsByType.set(error.type, (this.stats.errorsByType.get(error.type) || 0) + 1);
    this.stats.lastErrorTime = Date.now();
  }

  private updateCircuitBreaker(error: BaseShapeError): void {
    if (error.category !== ErrorCategory.NETWORK && error.category !== ErrorCategory.DATA) return;

    const serviceId = error.technicalDetails?.serviceId || 'default';
    const breaker = this.circuitBreakers.get(serviceId) || {
      state: 'closed' as const,
      failures: 0,
      lastFailure: 0,
      nextRetry: 0,
    };

    breaker.failures++;
    breaker.lastFailure = Date.now();

    //  5Circuit Open
    if (breaker.failures >= 5) {
      breaker.state = 'open';
      breaker.nextRetry = Date.now() + 30000; //  30
    }

    this.circuitBreakers.set(serviceId, breaker);
  }
}

// ========================================
// ========================================

/**
  * EphemeralDB
  */
class ShapeEphemeralDB extends Dexie {
  errorDetails!: Table<EphemeralErrorDetails>;
  checkpoints!: Table<CheckpointData>;

  constructor() {
    super(getDBName('shape-ephemeral-db'));

    this.version(1).stores({
      errorDetails: 'sessionId, treeNodeId, expiresAt',
      checkpoints: 'id, sessionId, timestamp, isValid',
    });

    this.on('ready', () => {
      setInterval(() => this.cleanupExpired(), 60000); //  1
    });
  }

  private async cleanupExpired(): Promise<void> {
    const now = Date.now();
    await this.errorDetails.where('expiresAt').below(now).delete();
  }
}

/**
    */
export class ErrorPersistenceManager {
  private ephemeralDB: ShapeEphemeralDB;
  private memoryCache: RuntimeErrorCache;
  private sessionLifetime = 24 * 60 * 60 * 1000; //  24

  constructor() {
    this.ephemeralDB = new ShapeEphemeralDB();
    this.memoryCache = new RuntimeErrorCache();
  }

  /**
            */
  async saveError(
    sessionId: string,
    treeNodeId: NodeId,
    error: BaseShapeError,
    context?: any,
  ): Promise<void> {
    //  3 -

    //  1.
    this.memoryCache.addError(sessionId, error);

    //  2. EphemeralDB undefined
    const ephemeralDetails: EphemeralErrorDetails = {
      sessionId: sessionId || `session-${Date.now()}`, //  undefined
      treeNodeId: String(treeNodeId || 'unknown'), //  TreeNodeIdundefined
      //  fullError
      fullError: {
        type: error.type,
        category: error.category,
        severity: error.severity,
        message: error.message,
        timestamp: error.timestamp || Date.now(),
        recoverable: error.recoverable || false,
        retryable: error.retryable || false,
        //  cause metadata
      } as BaseShapeError,
      context: {
        timestamp: context?.timestamp || Date.now(),
        errorCount: typeof context?.errorCount === 'number' ? context.errorCount : 1,
      },
      debug: {
        //  stackTrace
        stackTrace: undefined,
        workerState: undefined,
      },
      recovery: {
        attempts: [],
        checkpoints: [],
      },
      taskErrors: {},
      expiresAt: Date.now() + this.sessionLifetime,
    };

    //  3
    console.log('[EphemeralDB] Attempting to save:', JSON.stringify(ephemeralDetails, null, 2));

    try {
      await this.ephemeralDB.errorDetails.put(ephemeralDetails);
      console.log('[EphemeralDB] Successfully saved error details');
    } catch (error) {
      console.error('[EphemeralDB] Failed to save error details:', error);
      console.log('[EphemeralDB] Failed object structure:', ephemeralDetails);
      throw error;
    }

    //  3. CoreDB
    await this.saveToCoreDB({
      id: `${sessionId}-${Date.now()}`,
      nodeId: treeNodeId as NodeId, //  TreeNodeIdNodeId
      treeNodeId,
      sessionId,
      errorType: error.type,
      errorCode: error.code || 'UNKNOWN',
      category: error.category,
      severity: error.severity,
      occurredAt: error.timestamp || Date.now(),
      wasResolved: false,
      retryCount: 0,
      dataLossOccurred: false,
    });
  }

  /**
      * EphemeralDB
      */
  async getErrorDetails(sessionId: string): Promise<EphemeralErrorDetails | undefined> {
    return await this.ephemeralDB.errorDetails.get(sessionId);
  }

  /**
      * EphemeralDB
      */
  async saveCheckpoint(
    sessionId: string,
    checkpoint: Omit<CheckpointData, 'id' | 'timestamp'>,
  ): Promise<void> {
    const data: CheckpointData = {
      ...checkpoint,
      id: `${sessionId}-${Date.now()}`,
      timestamp: Date.now(),
    };

    await this.ephemeralDB.checkpoints.add(data);
  }

  /**
            */
  getActiveErrors(): Map<string, BaseShapeError> {
    return this.memoryCache['activeErrors'];
  }

  /**
      * Circuit Breaker
      */
  shouldCircuitBreak(serviceId: string): boolean {
    return this.memoryCache.shouldCircuitBreak(serviceId);
  }

  /**
            */
  async getLastCheckpoint(sessionId: string): Promise<{ taskIndex: number } | null> {
    const sessionErrors = this.memoryCache.sessionErrors.get(sessionId);
    if (!sessionErrors || sessionErrors.length === 0) {
      return null;
    }

    const lastError = sessionErrors[sessionErrors.length - 1];
    return {
      taskIndex: lastError?.metadata?.lastSuccessfulTask || 0,
    };
  }

  /**
            */
  async getSessionErrorState(sessionId: string): Promise<any> {
    const sessionErrors = this.memoryCache.sessionErrors.get(sessionId);
    if (!sessionErrors || sessionErrors.length === 0) {
      return null;
    }

    const lastError = sessionErrors[sessionErrors.length - 1];
    return {
      sessionId,
      failedAtStage: lastError?.stage || 'unknown',
      lastSuccessfulTask: lastError?.metadata?.lastSuccessfulTask || 0,
      canResume: true,
      resumeFromTask: (lastError?.metadata?.lastSuccessfulTask || 0) + 1,
    };
  }

  /**
            */
  async persistSessionError(sessionId: string, errorState: any): Promise<void> {
    const errors = this.memoryCache.sessionErrors.get(sessionId) || [];
    errors.push({
      timestamp: Date.now(),
      stage: errorState.failedAtStage,
      metadata: {
        lastSuccessfulTask: errorState.lastSuccessfulTask,
        canResume: errorState.canResume,
      },
    });
    this.memoryCache.sessionErrors.set(sessionId, errors);
  }

  /**
            */
  getAffectedTasks(failedTaskId: string): string[] {
    return this.memoryCache.getAffectedTasks(failedTaskId);
  }

  /**
            */
  async cleanupSession(sessionId: string): Promise<void> {
    //  EphemeralDB
    await this.ephemeralDB.errorDetails.where('sessionId').equals(sessionId).delete();
    await this.ephemeralDB.checkpoints.where('sessionId').equals(sessionId).delete();

  }

  /**
      * CoreDBWorker
      */
  private async saveToCoreDB(summary: CoreErrorSummary): Promise<void> {
    try {
      //  WorkerAPICoreDB
      //  WorkerAPI
      await this.coreDB.transaction('rw', this.coreDB.errorSummaries, async () => {
        await this.coreDB.errorSummaries.add(summary);
      });
      console.log('Successfully saved error summary to CoreDB:', summary.id);
    } catch (error) {
      console.error('Failed to save error summary to CoreDB:', error);
    }
  }
}
