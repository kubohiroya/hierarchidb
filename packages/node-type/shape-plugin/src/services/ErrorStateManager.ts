/**
  * @file ErrorStateManager.ts
 * @description
   * 1.
 * 2.
 * 3.
 * 4.
  */

import Dexie, { Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { TreeNodeId } from '@hierarchidb/core';
import { BaseShapeError, ErrorCategory, ErrorSeverity } from '../types/ShapeErrorHierarchy';
import type { RecoveryAttempt } from './RecoveryStrategy';

// ========================================
//  3
// ========================================

/**
  * A) (Ephemeral - )
  */
export interface TaskError {
  taskId: string;
  type: string;
  message: string;
  timestamp: number;
  retryCount: number;
}

/**
  * B) (Ephemeral - )
  */
export interface AggregatedError {
  pattern: string;
  occurrences: number;
  firstSeen: number;
  lastSeen: number;
  affectedTasks: string[];
}

/**
  * C) (Persistent - )
  */
export interface SessionStatsEntity {
  id?: number;
  sessionId: string;
  treeNodeId: string;
  startTime: number;
  endTime?: number;
  totalErrors: number;
  resolvedErrors: number;
  status: 'active' | 'completed' | 'failed';
}

// ========================================
// ========================================

/**
  * IndexedDB
  */
/**
  * IndexedDB
  */
class ErrorStateDB extends Dexie {
  //  C)
  sessionStats!: Table<SessionStatsEntity>;

  constructor() {
    super(getDBName('shape-error-state-db'));

    this.version(1).stores({
      sessionStats: '++id, sessionId, treeNodeId, startTime, endTime, totalErrors, resolvedErrors',
    });
  }
}

// ========================================
// ========================================

/**
    */

/**
    */
/**
  * 3
  */
export class ErrorStateManager {
  private db: ErrorStateDB;

  //  A) (Ephemeral)
  private taskErrors = new Map<string, TaskError>();

  //  B) (Ephemeral)
  private aggregatedErrors = new Map<string, AggregatedError>();

  //  C) (Persistent)
  private activeSessions = new Map<string, SessionStatsEntity>();

  constructor() {
    this.db = new ErrorStateDB();
  }

  // ========================================
  //  A) (Ephemeral)
  // ========================================

  /**
      * ()
      */
  recordTaskError(taskId: string, error: BaseShapeError): void {
    const taskError: TaskError = {
      taskId,
      type: error.type,
      message: error.message,
      timestamp: error.timestamp || Date.now(),
      retryCount: 0,
    };

    this.taskErrors.set(taskId, taskError);

    //  B)
    this.updateAggregatedError(error.type, taskId);
  }

  /**
            */
  getTaskError(taskId: string): TaskError | undefined {
    return this.taskErrors.get(taskId);
  }

  /**
            */
  resolveTaskError(taskId: string): void {
    this.taskErrors.delete(taskId);
  }

  // ========================================
  //  B) (Ephemeral)
  // ========================================

  /**
            */
  private updateAggregatedError(errorType: string, taskId: string): void {
    const existing = this.aggregatedErrors.get(errorType);
    const now = Date.now();

    if (existing) {
      existing.occurrences++;
      existing.lastSeen = now;
      existing.affectedTasks.push(taskId);
    } else {
      this.aggregatedErrors.set(errorType, {
        pattern: errorType,
        occurrences: 1,
        firstSeen: now,
        lastSeen: now,
        affectedTasks: [taskId],
      });
    }
  }

  /**
            */
  getAggregatedErrors(): AggregatedError[] {
    return Array.from(this.aggregatedErrors.values());
  }

  /**
            */
  clearAggregatedErrors(): void {
    this.aggregatedErrors.clear();
  }

  // ========================================
  //  C) (Persistent)
  // ========================================

  /**
            */
  async startSession(sessionId: string, treeNodeId: TreeNodeId): Promise<void> {
    const session: SessionStatsEntity = {
      sessionId,
      treeNodeId: treeNodeId as string,
      startTime: Date.now(),
      totalErrors: 0,
      resolvedErrors: 0,
      status: 'active',
    };

    this.activeSessions.set(sessionId, session);

    session.id = await this.db.sessionStats.add(session);
  }

  /**
            */
  async updateSessionStats(
    sessionId: string,
    increment: { total?: number; resolved?: number },
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    if (increment.total) session.totalErrors += increment.total;
    if (increment.resolved) session.resolvedErrors += increment.resolved;

    if (session.id) {
      await this.db.sessionStats.update(session.id, {
        totalErrors: session.totalErrors,
        resolvedErrors: session.resolvedErrors,
      });
    }
  }

  /**
            */
  async endSession(sessionId: string, status: 'completed' | 'failed'): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.endTime = Date.now();
    session.status = status;

    if (session.id) {
      await this.db.sessionStats.update(session.id, {
        endTime: session.endTime,
        status: session.status,
      });
    }

    this.activeSessions.delete(sessionId);
  }

  /**
            */
  async getSessionStats(sessionId: string): Promise<SessionStatsEntity | undefined> {
    const active = this.activeSessions.get(sessionId);
    if (active) return active;

    return await this.db.sessionStats.where('sessionId').equals(sessionId).first();
  }

  // ========================================
  // ========================================

  /**
      * ShapeErrorHandler
      */
  async recordError(sessionId: string, error: BaseShapeError): Promise<void> {
    //  A)
    const taskId = `task-${Date.now()}`;
    this.recordTaskError(taskId, error);

    //  C)
    await this.updateSessionStats(sessionId, { total: 1 });
  }

  /**
            */
  async getErrorStatistics(): Promise<{
    taskErrors: number;
    aggregatedPatterns: number;
    sessions: SessionStatsEntity[];
  }> {
    const recentSessions = await this.db.sessionStats.reverse().limit(10).toArray();

    return {
      taskErrors: this.taskErrors.size,
      aggregatedPatterns: this.aggregatedErrors.size,
      sessions: recentSessions,
    };
  }

  /**
            */
  async cleanupSession(sessionId: string): Promise<void> {
    //  A)
    for (const [taskId, _taskError] of this.taskErrors.entries()) {
      if (taskId.includes(sessionId)) {
        this.taskErrors.delete(taskId);
      }
    }

    //  B)
    this.clearAggregatedErrors();

    //  C) DB
    this.activeSessions.delete(sessionId);
  }

  /**
            */
  async clearAll(): Promise<void> {
    //  A)
    this.taskErrors.clear();

    //  B)
    this.aggregatedErrors.clear();

    //  C)
    this.activeSessions.clear();
    await this.db.sessionStats.clear();
  }

  // ========================================
  // ========================================

  /**
            */
  async saveErrorState(
    sessionId: string,
    _treeNodeId: TreeNodeId,
    error: BaseShapeError,
    _recoveryAttempts: RecoveryAttempt[] = [],
  ): Promise<void> {
    await this.recordError(sessionId, error);
  }

  /**
            */
  async getErrorState(sessionId: string): Promise<BaseShapeError | undefined> {
    const taskErrors = Array.from(this.taskErrors.values())
      .filter((te) => te.taskId.includes(sessionId))
      .sort((a, b) => b.timestamp - a.timestamp);

    if (taskErrors.length > 0) {
      const latest = taskErrors[0];
      if (!latest) {
        throw new Error('latest is undefined');
      }
      return {
        code: latest.taskId,
        name: `ShapeError_${latest.type}`,
        type: latest.type,
        category: 'system' as ErrorCategory,
        severity: ErrorSeverity.ERROR,
        message: latest.message,
        timestamp: latest.timestamp,
        recoverable: true,
        retryable: latest.retryCount < 3,
      };
    }

    return undefined;
  }

  /**
            */
  async resolveError(sessionId: string, _resolution: string): Promise<void> {
    for (const [taskId] of this.taskErrors.entries()) {
      if (taskId.includes(sessionId)) {
        this.resolveTaskError(taskId);
      }
    }

    await this.updateSessionStats(sessionId, { resolved: 1 });
  }

  /**
            */
  async recordRecoveryAttempt(sessionId: string, attempt: RecoveryAttempt): Promise<void> {
    //  -
    console.log(`[ErrorStateManager] Recovery attempt for ${sessionId}:`, attempt.strategy);
  }
}
