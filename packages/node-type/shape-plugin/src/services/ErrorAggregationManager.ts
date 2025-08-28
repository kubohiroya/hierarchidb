/**
 * @file ErrorAggregationManager.ts
 * @description Workerから受信したエラーを階層的に集約・詳細化する管理システム
 *
 * エラー集約の流れ：
 * 1. Worker → タスクレベルエラー受信
 * 2. タスクエラー → パターン検出 → グループエラーに集約
 * 3. グループエラー → 閾値超過 → セッションエラーにエスカレート
 * 4. 各レベルで詳細情報を付加・更新
 */

import type { NodeId } from '@hierarchidb/common-type';
import { BaseShapeError, ErrorCategory, ErrorSeverity } from '../types/ShapeErrorHierarchy';
import { ErrorPersistenceManager } from './ErrorPersistenceStrategy';
import { RecoveryStrategyManager } from './RecoveryStrategy';

// ========================================
// エラー階層の定義
// ========================================

/**
 * エラーの階層レベル
 */
export enum ErrorHierarchyLevel {
  TASK = 'TASK', // 個別タスク
  GROUP = 'GROUP', // タスクグループ
  STAGE = 'STAGE', // 処理ステージ
  SESSION = 'SESSION', // セッション全体
  SYSTEM = 'SYSTEM', // システム全体
}

/**
 * 階層化されたエラー状態
 */
export interface HierarchicalErrorState {
  // タスクレベル（最下層）
  taskErrors: Map<string, TaskErrorState>;

  // グループレベル（中間層）
  groupErrors: Map<string, GroupErrorState>;

  // ステージレベル
  stageErrors: Map<string, StageErrorState>;

  // セッションレベル（最上層）
  sessionError?: SessionErrorState;

  // メタデータ
  metadata: {
    totalErrors: number;
    firstErrorTime: number;
    lastErrorTime: number;
    escalationHistory: EscalationEvent[];
  };
}

/**
 * タスクレベルのエラー状態
 */
export interface TaskErrorState {
  taskId: string;
  taskType: TaskErrorState; //'download' | 'process' | 'simplify' | 'tile';
  target: {
    country?: string;
    adminLevel?: number;
    tileCoords?: { x: number; y: number; z: number };
  };

  // エラー情報
  error: BaseShapeError;
  workerInfo?: {
    workerId: string;
    workerType: string;
    timestamp: number;
  };

  // 状態
  status: 'active' | 'retrying' | 'failed' | 'skipped' | 'recovered';
  retryCount: number;
  lastRetryTime?: number;

  // 影響
  dependencies: string[];
  blockedTasks: string[];
  canSkip: boolean;
}

/**
 * グループレベルのエラー状態
 */
export interface GroupErrorState {
  groupId: string;
  groupType: 'country' | 'admin_level' | 'data_source' | 'worker_pool';

  // 集約情報
  affectedTasks: Set<string>;
  commonPattern?: {
    type: string;
    confidence: number;
    evidence: string[];
  };

  // エラー分析
  errorDistribution: Map<string, number>;
  failureRate: number;
  trend: 'increasing' | 'stable' | 'decreasing';

  // 共通原因分析
  rootCause?: {
    identified: boolean;
    type: string;
    description: string;
    evidence: string[];
  };
}

/**
 * ステージレベルのエラー状態
 */
export interface StageErrorState {
  stage: 'download' | 'simplify1' | 'simplify2' | 'vectorTiles';

  // ステージ全体の状態
  status: 'running' | 'degraded' | 'failed' | 'recovered';
  health: number; // 0-100

  // 集約メトリクス
  totalTasks: number;
  failedTasks: number;
  succeededTasks: number;
  skippedTasks: number;

  // パフォーマンス影響
  performanceImpact: {
    throughputReduction: number;
    latencyIncrease: number;
    resourceUtilization: number;
  };
}

/**
 * セッションレベルのエラー状態
 */
export interface SessionErrorState {
  sessionId: string;
  criticalityLevel: 'low' | 'medium' | 'high' | 'critical';

  // 全体影響
  canContinue: boolean;
  requiresIntervention: boolean;
  dataIntegrity: 'intact' | 'partial' | 'compromised';

  // リカバリ可能性
  recoveryOptions: {
    fullRecovery: boolean;
    partialRecovery: boolean;
    rollbackAvailable: boolean;
  };
}

/**
 * エスカレーションイベント
 */
export interface EscalationEvent {
  timestamp: number;
  fromLevel: ErrorHierarchyLevel;
  toLevel: ErrorHierarchyLevel;
  trigger: string;
  threshold?: number;
  affectedScope: string[];
}

// ========================================
// Workerメッセージインターフェース
// ========================================

/**
 * Workerから受信するエラーメッセージ
 */
export interface WorkerErrorMessage {
  type: 'ERROR';
  workerId: string;
  workerType: string;
  timestamp: number;

  // エラー詳細
  error: {
    code: string;
    message: string;
    category: ErrorCategory;
    technical?: Record<string, any>;
  };

  // コンテキスト
  context: {
    taskId: string;
    stage: string;
    target?: any;
    progress?: number;
  };

  // Worker状態
  workerState?: {
    memoryUsage: number;
    taskQueueLength: number;
    isHealthy: boolean;
  };
}

// ========================================
// エラー集約マネージャー
// ========================================

/**
 * Workerエラーを階層的に集約・管理
 */
export class ErrorAggregationManager {
  private hierarchicalState: HierarchicalErrorState;
  private persistenceManager: ErrorPersistenceManager;
  private recoveryManager: RecoveryStrategyManager;

  // エスカレーション閾値
  private escalationThresholds = {
    taskToGroup: 3, // 3つのタスクエラー → グループエラー
    groupToStage: 2, // 2つのグループエラー → ステージエラー
    stageToSession: 1, // 1つのステージ失敗 → セッションエラー
    failureRateThreshold: 0.3, // 30%の失敗率で自動エスカレート
  };

  // パターン検出
  private patterns = {
    commonErrors: new Map<string, number>(),
    errorSequences: [] as string[][],
    timePatterns: [] as { time: number; count: number }[],
  };

  constructor(
    private sessionId: string,
    private treeNodeId: NodeId
  ) {
    this.hierarchicalState = this.initializeState();
    this.persistenceManager = new ErrorPersistenceManager();
    this.recoveryManager = new RecoveryStrategyManager();
  }

  /**
   * 初期状態を作成
   */
  private initializeState(): HierarchicalErrorState {
    return {
      taskErrors: new Map(),
      groupErrors: new Map(),
      stageErrors: new Map(),
      sessionError: undefined,
      metadata: {
        totalErrors: 0,
        firstErrorTime: 0,
        lastErrorTime: 0,
        escalationHistory: [],
      },
    };
  }

  /**
   * Workerからエラーを受信して処理
   */
  async handleWorkerError(message: WorkerErrorMessage): Promise<void> {
    console.log(
      `[ErrorAggregation] Received error from worker ${message.workerId}:`,
      message.error
    );

    // 1. タスクレベルエラーを記録
    const taskError = await this.recordTaskError(message);

    // 2. パターン検出
    this.detectTaskPatterns(taskError);

    // 3. グループへの集約を検討
    await this.aggregateToGroup(taskError);

    // 4. エスカレーション判定
    await this.checkEscalation();

    // 5. 永続化
    await this.persistCurrentState();

    // 6. リカバリ戦略の選択
    await this.selectRecoveryStrategy(taskError);
  }

  /**
   * タスクエラーを記録
   */
  private async recordTaskError(message: WorkerErrorMessage): Promise<TaskErrorState> {
    const context = message.context || {};
    const taskError: TaskErrorState = {
      taskId: context.taskId || `task-${Date.now()}`,
      taskType: this.inferTaskType(context.stage),
      target: context.target || {},
      error: this.convertToBaseError(message),
      workerInfo: {
        workerId: message.workerId,
        workerType: message.workerType,
        timestamp: message.timestamp,
      },
      status: 'active',
      retryCount: 0,
      dependencies: [],
      blockedTasks: [],
      canSkip: this.canSkipTask(message),
    };

    // 既存のエラーがあれば更新、なければ追加
    const existing = this.hierarchicalState.taskErrors.get(context.taskId || `task-${Date.now()}`);
    if (existing) {
      taskError.retryCount = existing.retryCount + 1;
      taskError.lastRetryTime = Date.now();
    }

    this.hierarchicalState.taskErrors.set(taskError.taskId, taskError);
    this.updateMetadata();

    return taskError;
  }

  /**
   * パターン検出
   */
  private detectTaskPatterns(taskError: TaskErrorState): void {
    // 安全性チェック
    if (!taskError.error || !taskError.error.type) {
      console.warn(
        '[ErrorAggregationManager] Invalid error object in detectTaskPatterns:',
        taskError
      );
      return;
    }

    const errorKey = `${taskError.error.type}_${taskError.error.code}`;

    // エラータイプの頻度
    this.patterns.commonErrors.set(errorKey, (this.patterns.commonErrors.get(errorKey) || 0) + 1);

    // エラーシーケンスの記録
    const recentSequence = Array.from(this.hierarchicalState.taskErrors.values())
      .slice(-5)
      .map((e) => e.error.type);
    this.patterns.errorSequences.push(recentSequence);

    // 時間パターン
    const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
    const hourPattern = this.patterns.timePatterns.find((p) => p.time === currentHour);
    if (hourPattern) {
      hourPattern.count++;
    } else {
      this.patterns.timePatterns.push({ time: currentHour, count: 1 });
    }
  }

  /**
   * グループレベルへの集約
   */
  private async aggregateToGroup(taskError: TaskErrorState): Promise<void> {
    // グループIDを決定（例：国別、エラータイプ別）
    const groupId = this.determineGroupId(taskError);

    let groupError = this.hierarchicalState.groupErrors.get(groupId);
    if (!groupError) {
      groupError = {
        groupId,
        groupType: this.determineGroupType(taskError),
        affectedTasks: new Set(),
        errorDistribution: new Map(),
        failureRate: 0,
        trend: 'stable',
      };
      this.hierarchicalState.groupErrors.set(groupId, groupError);
    }

    // グループエラーを更新
    groupError.affectedTasks.add(taskError.taskId);
    groupError.errorDistribution.set(
      taskError.error.type,
      (groupError.errorDistribution.get(taskError.error.type) || 0) + 1
    );

    // 失敗率を計算
    const totalTasksInGroup = this.countTasksInGroup(groupId);
    groupError.failureRate = groupError.affectedTasks.size / totalTasksInGroup;

    // トレンドを分析
    groupError.trend = this.analyzeTrend(groupError);

    // 共通パターンを検出
    if (groupError.affectedTasks.size >= 3) {
      groupError.commonPattern = this.findCommonPattern(groupError);
    }

    // 根本原因を推定
    if (groupError.failureRate > 0.5) {
      groupError.rootCause = await this.identifyRootCause(groupError);
    }
  }

  /**
   * エスカレーション判定
   */
  private async checkEscalation(): Promise<void> {
    // タスク → グループ
    for (const [groupId, group] of this.hierarchicalState.groupErrors) {
      if (group.affectedTasks.size >= this.escalationThresholds.taskToGroup) {
        await this.escalateToStage(groupId, group);
      }
    }

    // ステージ → セッション
    for (const [stageId, stage] of this.hierarchicalState.stageErrors) {
      const failureRate = stage.failedTasks / stage.totalTasks;
      if (
        failureRate > this.escalationThresholds.failureRateThreshold ||
        stage.status === 'failed'
      ) {
        await this.escalateToSession(stageId, stage);
      }
    }
  }

  /**
   * ステージレベルへエスカレート
   */
  private async escalateToStage(groupId: string, group: GroupErrorState): Promise<void> {
    const stage = this.extractStageFromGroup(groupId);

    let stageError = this.hierarchicalState.stageErrors.get(stage);
    if (!stageError) {
      stageError = {
        stage: stage as any,
        status: 'degraded',
        health: 100,
        totalTasks: 0,
        failedTasks: 0,
        succeededTasks: 0,
        skippedTasks: 0,
        performanceImpact: {
          throughputReduction: 0,
          latencyIncrease: 0,
          resourceUtilization: 0,
        },
      };
      this.hierarchicalState.stageErrors.set(stage, stageError);
    }

    // ステージ状態を更新
    stageError.failedTasks += group.affectedTasks.size;
    stageError.health = Math.max(0, 100 - group.failureRate * 100);

    if (stageError.health < 50) {
      stageError.status = 'degraded';
    }
    if (stageError.health < 20) {
      stageError.status = 'failed';
    }

    // パフォーマンス影響を計算
    stageError.performanceImpact = this.calculatePerformanceImpact(stageError);

    // エスカレーション記録
    this.recordEscalation(
      ErrorHierarchyLevel.GROUP,
      ErrorHierarchyLevel.STAGE,
      `Group ${groupId} failure rate: ${group.failureRate}`
    );
  }

  /**
   * セッションレベルへエスカレート
   */
  private async escalateToSession(stageId: string, stage: StageErrorState): Promise<void> {
    if (!this.hierarchicalState.sessionError) {
      this.hierarchicalState.sessionError = {
        sessionId: this.sessionId,
        criticalityLevel: 'medium',
        canContinue: true,
        requiresIntervention: false,
        dataIntegrity: 'intact',
        recoveryOptions: {
          fullRecovery: true,
          partialRecovery: true,
          rollbackAvailable: true,
        },
      };
    }

    // クリティカリティを更新
    if (stage.status === 'failed') {
      this.hierarchicalState.sessionError.criticalityLevel = 'high';

      // ダウンロードステージが失敗した場合は継続不可
      if (stageId === 'download') {
        this.hierarchicalState.sessionError.canContinue = false;
        this.hierarchicalState.sessionError.criticalityLevel = 'critical';
      }
    }

    // データ整合性を評価
    this.hierarchicalState.sessionError.dataIntegrity = this.evaluateDataIntegrity();

    // 介入の必要性を判定
    this.hierarchicalState.sessionError.requiresIntervention =
      this.hierarchicalState.sessionError.criticalityLevel === 'critical' ||
      !this.hierarchicalState.sessionError.canContinue;

    this.recordEscalation(
      ErrorHierarchyLevel.STAGE,
      ErrorHierarchyLevel.SESSION,
      `Stage ${stageId} failed`
    );
  }

  /**
   * 現在の状態を永続化
   */
  private async persistCurrentState(): Promise<void> {
    // 3層アプローチに従って簡素化 - 複雑なオブジェクトは保存しない
    const latestError = Array.from(this.hierarchicalState.taskErrors.values()).sort(
      (a, b) => (b.workerInfo?.timestamp || 0) - (a.workerInfo?.timestamp || 0)
    )[0];

    if (latestError) {
      // 基本情報のみ保存（複雑なオブジェクトを除外）
      await this.persistenceManager.saveError(this.sessionId, this.treeNodeId, latestError.error, {
        // 複雑なオブジェクトは保存せず、基本情報のみ
        errorCount: this.hierarchicalState.taskErrors.size,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * リカバリ戦略を選択
   */
  private async selectRecoveryStrategy(taskError: TaskErrorState): Promise<void> {
    const context = {
      error: taskError.error,
      sessionId: this.sessionId,
      treeNodeId: this.treeNodeId,
      config: {} as any, // TODO: 実際の設定を取得
      attemptNumber: taskError.retryCount,
      previousAttempts: [],
    };

    const strategy = await this.recoveryManager.executeRecovery(context);
    console.log(`[Recovery] Selected strategy: ${strategy.strategy} for task ${taskError.taskId}`);
  }

  // ========================================
  // ヘルパーメソッド
  // ========================================

  private inferTaskType(stage: string): TaskErrorState['taskType'] {
    switch (stage) {
      case 'download':
        return 'download' as TaskErrorState['taskType'];
      case 'simplify1':
      case 'simplify2':
        return 'simplify';
      case 'vectorTiles':
        return 'tile';
      default:
        return 'process';
    }
  }

  private convertToBaseError(message: WorkerErrorMessage): BaseShapeError {
    const context = message.context || {};
    return {
      name: 'WorkerError',
      category: message.error.category,
      type: message.error.code,
      code: message.error.code,
      severity: ErrorSeverity.ERROR,
      message: message.error.message,
      recoverable: true,
      retryable: true,
      timestamp: message.timestamp,
      sessionId: this.sessionId,
      treeNodeId: this.treeNodeId,
      stage: context.stage as any,
      technicalDetails: message.error.technical,
      suggestedActions: [],
    };
  }

  private canSkipTask(message: WorkerErrorMessage): boolean {
    const context = message.context || {};
    // ダウンロード失敗は通常スキップ不可
    if (context.stage === 'download') return false;

    // その他のステージは条件によりスキップ可能
    return message.error.category !== ErrorCategory.SYSTEM;
  }

  private determineGroupId(taskError: TaskErrorState): string {
    // 国別グループ
    if (taskError.target.country) {
      return `country_${taskError.target.country}`;
    }

    // エラータイプ別グループ
    return `error_${taskError.error.type}`;
  }

  private determineGroupType(taskError: TaskErrorState): GroupErrorState['groupType'] {
    if (taskError.target.country) return 'country';
    if (taskError.target.adminLevel !== undefined) return 'admin_level';
    if (taskError.workerInfo) return 'worker_pool';
    return 'data_source';
  }

  private countTasksInGroup(_groupId: string): number {
    // TODO: 実際のタスク数を計算
    return 100;
  }

  private analyzeTrend(_group: GroupErrorState): 'increasing' | 'stable' | 'decreasing' {
    // TODO: 時系列分析
    return 'stable';
  }

  private findCommonPattern(group: GroupErrorState): GroupErrorState['commonPattern'] {
    // 最も多いエラータイプを見つける
    let maxCount = 0;
    let commonType = '';

    for (const [type, count] of group.errorDistribution) {
      if (count > maxCount) {
        maxCount = count;
        commonType = type;
      }
    }

    return {
      type: commonType,
      confidence: maxCount / group.affectedTasks.size,
      evidence: Array.from(group.affectedTasks).slice(0, 5),
    };
  }

  private async identifyRootCause(group: GroupErrorState): Promise<GroupErrorState['rootCause']> {
    // パターンベースの原因推定
    const pattern = group.commonPattern;
    if (!pattern) return undefined;

    // ネットワークエラーの集中
    if (pattern.type.includes('NETWORK')) {
      return {
        identified: true,
        type: 'network_issue',
        description: 'ネットワーク接続に問題がある可能性があります',
        evidence: [`${group.affectedTasks.size}個のタスクが同様のネットワークエラー`],
      };
    }

    // メモリエラーの集中
    if (pattern.type.includes('MEMORY')) {
      return {
        identified: true,
        type: 'resource_exhaustion',
        description: 'メモリ不足が発生しています',
        evidence: [`並行処理数が多すぎる可能性`],
      };
    }

    return undefined;
  }

  private extractStageFromGroup(_groupId: string): string {
    // TODO: グループIDからステージを抽出
    return 'download';
  }

  private calculatePerformanceImpact(stage: StageErrorState): StageErrorState['performanceImpact'] {
    const failureRate = stage.failedTasks / Math.max(1, stage.totalTasks);

    return {
      throughputReduction: failureRate * 100,
      latencyIncrease: failureRate * 50,
      resourceUtilization: (1 - failureRate) * 100,
    };
  }

  private evaluateDataIntegrity(): 'intact' | 'partial' | 'compromised' {
    const stageFailures = Array.from(this.hierarchicalState.stageErrors.values()).filter(
      (s) => s.status === 'failed'
    ).length;

    if (stageFailures === 0) return 'intact';
    if (stageFailures === 1) return 'partial';
    return 'compromised';
  }

  private recordEscalation(
    from: ErrorHierarchyLevel,
    to: ErrorHierarchyLevel,
    trigger: string
  ): void {
    this.hierarchicalState.metadata.escalationHistory.push({
      timestamp: Date.now(),
      fromLevel: from,
      toLevel: to,
      trigger,
      affectedScope: [],
    });
  }

  private updateMetadata(): void {
    const now = Date.now();
    this.hierarchicalState.metadata.totalErrors++;
    this.hierarchicalState.metadata.lastErrorTime = now;

    if (this.hierarchicalState.metadata.firstErrorTime === 0) {
      this.hierarchicalState.metadata.firstErrorTime = now;
    }
  }

  /**
   * 汎用エラー記録メソッド
   */
  async recordError(errorInfo: {
    type: string;
    timestamp: number;
    category: TaskErrorState;
    severity: string;
  }): Promise<void> {
    // TaskErrorStateとして記録
    const taskError: TaskErrorState = {
      taskId: `error-${Date.now()}`,
      taskType: errorInfo.category,
      target: {},
      error: {
        category: errorInfo.category as any,
        type: errorInfo.type,
        severity: errorInfo.severity as any,
        timestamp: errorInfo.timestamp,
      } as any,
      workerInfo: {
        workerId: 'system',
        timestamp: errorInfo.timestamp,
      },
      metadata: {},
      escalationLevel: 0,
      occurrenceCount: 1,
    };

    this.hierarchicalState.taskErrors.set(taskError.taskId, taskError);
  }

  /**
   * 集約されたエラー情報を取得
   */
  async getAggregatedErrors(): Promise<{
    tasks: Map<string, TaskErrorState>;
    groups: Map<string, any>;
    stages: Map<string, any>;
    session?: any;
  }> {
    return {
      tasks: this.hierarchicalState.taskErrors,
      groups: this.hierarchicalState.groupErrors,
      stages: this.hierarchicalState.stageErrors,
      session: this.hierarchicalState.sessionError,
    };
  }

  /**
   * エラーパターンを分析（ShapeErrorHandler用）
   */
  async detectPatterns(errors: Array<{ type: string; timestamp: number }>): Promise<{
    cyclical: boolean;
    memoryIncreasing: boolean;
    networkSpikes: boolean;
    bursty: boolean;
  }> {
    // エラー頻度とタイミングパターンを分析
    const now = Date.now();
    const recentWindow = 5 * 60 * 1000; // 5分
    const recentErrors = errors.filter((e) => now - e.timestamp < recentWindow);

    // 循環的エラーパターン検出
    const cyclical = this.detectCyclicalPattern(recentErrors);

    // メモリ関連エラーの増加傾向
    const memoryIncreasing = this.detectMemoryIncreasingPattern(recentErrors);

    // ネットワークエラーのスパイク検出
    const networkSpikes = this.detectNetworkSpikes(recentErrors);

    // バースト的エラーパターン検出
    const bursty = this.detectBurstPattern(recentErrors);

    return {
      cyclical,
      memoryIncreasing,
      networkSpikes,
      bursty,
    };
  }

  // ========================================
  // 公開メソッド
  // ========================================

  /**
   * 現在の階層状態を取得
   */
  getHierarchicalState(): HierarchicalErrorState {
    return this.hierarchicalState;
  }

  /**
   * 特定レベルの状態を取得
   */
  getErrorsAtLevel(level: ErrorHierarchyLevel): any {
    switch (level) {
      case ErrorHierarchyLevel.TASK:
        return this.hierarchicalState.taskErrors;
      case ErrorHierarchyLevel.GROUP:
        return this.hierarchicalState.groupErrors;
      case ErrorHierarchyLevel.STAGE:
        return this.hierarchicalState.stageErrors;
      case ErrorHierarchyLevel.SESSION:
        return this.hierarchicalState.sessionError;
      default:
        return null;
    }
  }

  /**
   * エラーの影響範囲を分析
   */
  analyzeImpact(errorId: string): {
    directImpact: string[];
    indirectImpact: string[];
    cascadeRisk: number;
  } {
    const taskError = this.hierarchicalState.taskErrors.get(errorId);
    if (!taskError) {
      return { directImpact: [], indirectImpact: [], cascadeRisk: 0 };
    }

    return {
      directImpact: taskError.blockedTasks,
      indirectImpact: this.findIndirectlyAffectedTasks(taskError),
      cascadeRisk: this.calculateCascadeRisk(taskError),
    };
  }

  private findIndirectlyAffectedTasks(taskError: TaskErrorState): string[] {
    // TODO: 依存関係グラフを辿って間接的に影響を受けるタスクを特定
    return [];
  }

  private calculateCascadeRisk(taskError: TaskErrorState): number {
    // 0-1の範囲でカスケード障害のリスクを計算
    const blockedCount = taskError.blockedTasks.length;
    const totalTasks = this.hierarchicalState.taskErrors.size;

    return Math.min(1, blockedCount / Math.max(1, totalTasks));
  }

  /**
   * 循環的エラーパターンを検出
   */
  private detectCyclicalPattern(errors: Array<{ type: string; timestamp: number }>): boolean {
    if (errors.length < 3) return false;

    // 同じタイプのエラーが定期的に発生しているかチェック
    const errorsByType = errors.reduce(
      (acc, error) => {
        acc[error.type] = acc[error.type] || [];
        acc[error.type]?.push(error.timestamp);
        return acc;
      },
      {} as Record<string, number[]>
    );

    for (const [_type, timestamps] of Object.entries(errorsByType)) {
      if (timestamps.length >= 3) {
        // 時間間隔の一貫性をチェック
        const intervals = [];
        for (let i = 1; i < timestamps.length; i++) {
          if (timestamps[i] && timestamps[i - 1]) {
            intervals.push((timestamps[i] as number) - (timestamps[i - 1] as number));
          }
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance =
          intervals.reduce((acc, interval) => acc + Math.pow(interval - avgInterval, 2), 0) /
          intervals.length;

        // 分散が小さい場合、循環的パターンと判定
        if (variance < avgInterval * 0.3) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * メモリ関連エラーの増加傾向を検出
   */
  private detectMemoryIncreasingPattern(
    errors: Array<{ type: string; timestamp: number }>
  ): boolean {
    const memoryErrors = errors.filter(
      (e) => e.type.includes('MEMORY') || e.type.includes('OUT_OF_MEMORY')
    );

    if (memoryErrors.length < 2) return false;

    // 時系列でメモリエラーが増加傾向にあるかチェック
    const sortedByTime = memoryErrors.sort((a, b) => a.timestamp - b.timestamp);
    const recentHalf = sortedByTime.slice(Math.floor(sortedByTime.length / 2));

    return recentHalf.length > sortedByTime.length / 3;
  }

  /**
   * ネットワークエラーのスパイクを検出
   */
  private detectNetworkSpikes(errors: Array<{ type: string; timestamp: number }>): boolean {
    const networkErrors = errors.filter(
      (e) => e.type.includes('NETWORK') || e.type.includes('CONNECTION') || e.type.includes('CORS')
    );

    if (networkErrors.length < 3) return false;

    // 短時間内の集中的な発生をチェック
    const spikeWindow = 2 * 60 * 1000; // 2分
    const now = Date.now();
    const recentSpike = networkErrors.filter((e) => now - e.timestamp < spikeWindow);

    return recentSpike.length >= 3;
  }

  /**
   * バースト的エラーパターンを検出
   */
  private detectBurstPattern(errors: Array<{ type: string; timestamp: number }>): boolean {
    if (errors.length < 5) return false;

    // 短期間に集中的にエラーが発生しているかチェック
    const burstWindow = 1 * 60 * 1000; // 1分
    const now = Date.now();
    const recentBurst = errors.filter((e) => now - e.timestamp < burstWindow);

    return recentBurst.length >= 5;
  }
}
