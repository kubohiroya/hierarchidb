/**
 * @file ErrorStateManager.ts
 * @description エラー状態の管理と永続化
 * 
 * 機能：
 * 1. エラー状態の保存・復元
 * 2. セッション状態のチェックポイント管理
 * 3. エラー統計の収集・分析
 * 4. リカバリ履歴の管理
 */

import Dexie, { Table } from 'dexie';
import type { TreeNodeId } from '@hierarchidb/core';
import type { BaseShapeError, ErrorCategory } from '../types/ShapeErrorHierarchy';
import type { RecoveryAttempt, ResumePoint } from './RecoveryStrategy';
import type { BatchConfig } from '../types/BatchConfig';

// ========================================
// 3層エラー管理システム（簡素化）
// ========================================

/**
 * A) タスクレベルエラー (Ephemeral - メモリのみ)
 */
export interface TaskError {
  taskId: string;
  type: string;
  message: string;
  timestamp: number;
  retryCount: number;
}

/**
 * B) 集約エラー (Ephemeral - セッション中のみ)
 */
export interface AggregatedError {
  pattern: string;
  occurrences: number;
  firstSeen: number;
  lastSeen: number;
  affectedTasks: string[];
}

/**
 * C) セッション統計 (Persistent - 永続化)
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
// エラー状態データベース
// ========================================

/**
 * エラー状態管理用のIndexedDB
 */
/**
 * エラー状態管理用のIndexedDB（超簡素化版）
 */
class ErrorStateDB extends Dexie {
  // C) セッションレベルの永続化のみ
  sessionStats!: Table<SessionStatsEntity>;
  
  constructor() {
    super('ShapeErrorStateDB_Simple');
    
    this.version(1).stores({
      // セッション統計のみ永続化（最小限）
      sessionStats: '++id, sessionId, treeNodeId, startTime, endTime, totalErrors, resolvedErrors'
    });
  }
}

// ========================================
// エラー状態マネージャー
// ========================================

/**
 * エラー状態を管理するマネージャー
 */
/**
 * エラー状態を管理するマネージャー
 */
/**
 * エラー状態を管理するマネージャー（3層簡素化版）
 */
export class ErrorStateManager {
  private db: ErrorStateDB;
  
  // A) タスクレベルエラー (Ephemeral)
  private taskErrors = new Map<string, TaskError>();
  
  // B) 集約エラー (Ephemeral) 
  private aggregatedErrors = new Map<string, AggregatedError>();
  
  // C) セッション統計 (Persistent)
  private activeSessions = new Map<string, SessionStatsEntity>();
  
  constructor() {
    this.db = new ErrorStateDB();
  }
  
  // ========================================
  // A) タスクレベルエラー管理 (Ephemeral)
  // ========================================
  
  /**
   * タスクエラーを記録 (メモリのみ)
   */
  recordTaskError(taskId: string, error: BaseShapeError): void {
    const taskError: TaskError = {
      taskId,
      type: error.type,
      message: error.message,
      timestamp: error.timestamp || Date.now(),
      retryCount: 0
    };
    
    this.taskErrors.set(taskId, taskError);
    
    // B) 集約エラーパターンを更新
    this.updateAggregatedError(error.type, taskId);
  }
  
  /**
   * タスクエラーを取得
   */
  getTaskError(taskId: string): TaskError | undefined {
    return this.taskErrors.get(taskId);
  }
  
  /**
   * タスクエラーを解決
   */
  resolveTaskError(taskId: string): void {
    this.taskErrors.delete(taskId);
  }
  
  // ========================================
  // B) 集約エラー管理 (Ephemeral)
  // ========================================
  
  /**
   * 集約エラーパターンを更新
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
        affectedTasks: [taskId]
      });
    }
  }
  
  /**
   * 集約エラーを取得
   */
  getAggregatedErrors(): AggregatedError[] {
    return Array.from(this.aggregatedErrors.values());
  }
  
  /**
   * 集約エラーをクリア
   */
  clearAggregatedErrors(): void {
    this.aggregatedErrors.clear();
  }
  
  // ========================================
  // C) セッション統計管理 (Persistent)
  // ========================================
  
  /**
   * セッションを開始
   */
  async startSession(sessionId: string, treeNodeId: TreeNodeId): Promise<void> {
    const session: SessionStatsEntity = {
      sessionId,
      treeNodeId: treeNodeId as string,
      startTime: Date.now(),
      totalErrors: 0,
      resolvedErrors: 0,
      status: 'active'
    };
    
    this.activeSessions.set(sessionId, session);
    
    // データベースに永続化
    session.id = await this.db.sessionStats.add(session);
  }
  
  /**
   * セッション統計を更新
   */
  async updateSessionStats(sessionId: string, increment: { total?: number; resolved?: number }): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    if (increment.total) session.totalErrors += increment.total;
    if (increment.resolved) session.resolvedErrors += increment.resolved;
    
    // データベースに永続化
    if (session.id) {
      await this.db.sessionStats.update(session.id, {
        totalErrors: session.totalErrors,
        resolvedErrors: session.resolvedErrors
      });
    }
  }
  
  /**
   * セッションを終了
   */
  async endSession(sessionId: string, status: 'completed' | 'failed'): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    session.endTime = Date.now();
    session.status = status;
    
    // データベースに永続化
    if (session.id) {
      await this.db.sessionStats.update(session.id, {
        endTime: session.endTime,
        status: session.status
      });
    }
    
    // アクティブセッションから削除
    this.activeSessions.delete(sessionId);
  }
  
  /**
   * セッション統計を取得
   */
  async getSessionStats(sessionId: string): Promise<SessionStatsEntity | undefined> {
    // まずメモリから確認
    const active = this.activeSessions.get(sessionId);
    if (active) return active;
    
    // データベースから取得
    return await this.db.sessionStats
      .where('sessionId')
      .equals(sessionId)
      .first();
  }
  
  // ========================================
  // 統合インターフェース
  // ========================================
  
  /**
   * エラーを記録（ShapeErrorHandlerから使用）
   */
  async recordError(sessionId: string, error: BaseShapeError): Promise<void> {
    // A) タスクレベルで記録
    const taskId = `task-${Date.now()}`;
    this.recordTaskError(taskId, error);
    
    // C) セッション統計を更新
    await this.updateSessionStats(sessionId, { total: 1 });
  }
  
  /**
   * エラー統計を取得
   */
  async getErrorStatistics(): Promise<{ 
    taskErrors: number; 
    aggregatedPatterns: number; 
    sessions: SessionStatsEntity[] 
  }> {
    const recentSessions = await this.db.sessionStats
      .reverse()
      .limit(10)
      .toArray();
    
    return {
      taskErrors: this.taskErrors.size,
      aggregatedPatterns: this.aggregatedErrors.size,
      sessions: recentSessions
    };
  }
  
  /**
   * セッションデータをクリーンアップ
   */
  async cleanupSession(sessionId: string): Promise<void> {
    // A) タスクエラーをクリア（該当セッションのもの）
    for (const [taskId, taskError] of this.taskErrors.entries()) {
      if (taskId.includes(sessionId)) {
        this.taskErrors.delete(taskId);
      }
    }
    
    // B) 集約エラーをクリア
    this.clearAggregatedErrors();
    
    // C) アクティブセッションから削除（DBは保持）
    this.activeSessions.delete(sessionId);
  }
  
  /**
   * 全データをクリア（テスト用）
   */
  async clearAll(): Promise<void> {
    // A) タスクエラーをクリア
    this.taskErrors.clear();
    
    // B) 集約エラーをクリア
    this.aggregatedErrors.clear();
    
    // C) セッション統計をクリア
    this.activeSessions.clear();
    await this.db.sessionStats.clear();
  }
  
  // ========================================
  // レガシー互換メソッド（段階的移行用）
  // ========================================
  
  /**
   * エラー状態を保存（簡素化版）
   */
  async saveErrorState(
    sessionId: string,
    treeNodeId: TreeNodeId,
    error: BaseShapeError,
    recoveryAttempts: RecoveryAttempt[] = []
  ): Promise<void> {
    await this.recordError(sessionId, error);
  }
  
  /**
   * エラー状態を取得（簡素化版）
   */
  async getErrorState(sessionId: string): Promise<BaseShapeError | undefined> {
    // 最新のタスクエラーを返す
    const taskErrors = Array.from(this.taskErrors.values())
      .filter(te => te.taskId.includes(sessionId))
      .sort((a, b) => b.timestamp - a.timestamp);
    
    if (taskErrors.length > 0) {
      const latest = taskErrors[0];
      return {
        type: latest.type,
        category: 'system' as ErrorCategory,
        severity: 'ERROR' as 'ERROR',
        message: latest.message,
        timestamp: latest.timestamp,
        recoverable: true,
        retryable: latest.retryCount < 3
      };
    }
    
    return undefined;
  }
  
  /**
   * エラー状態を解決
   */
  async resolveError(sessionId: string, resolution: string): Promise<void> {
    // 該当セッションのタスクエラーを解決
    for (const [taskId] of this.taskErrors.entries()) {
      if (taskId.includes(sessionId)) {
        this.resolveTaskError(taskId);
      }
    }
    
    // セッション統計を更新
    await this.updateSessionStats(sessionId, { resolved: 1 });
  }
  
  /**
   * リカバリ試行を記録（簡素化版）
   */
  async recordRecoveryAttempt(sessionId: string, attempt: RecoveryAttempt): Promise<void> {
    // 実装を簡素化 - 基本的なログのみ
    console.log(`[ErrorStateManager] Recovery attempt for ${sessionId}:`, attempt.strategy);
  }
}