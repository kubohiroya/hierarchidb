/**
  * @file ErrorAggregationManager.ts
 * @description Worker
   * 1. Worker
 * 2.
 * 3.
 * 4.
  */

import type { NodeId } from '@hierarchidb/common-type';
import { BaseShapeError, ErrorCategory, ErrorSeverity } from '../types/ShapeErrorHierarchy';
import { ErrorPersistenceManager } from './ErrorPersistenceStrategy';
import { RecoveryStrategyManager } from './RecoveryStrategy';

// ========================================
// ========================================

/**
    */
export enum ErrorHierarchyLevel {
  TASK = 'TASK', GROUP = 'GROUP', STAGE = 'STAGE', SESSION = 'SESSION', SYSTEM = 'SYSTEM',
}

/**
    */
export interface HierarchicalErrorState {
  taskErrors: Map<string, TaskErrorState>;

  groupErrors: Map<string, GroupErrorState>;

  stageErrors: Map<string, StageErrorState>;

  sessionError?: SessionErrorState;

  metadata: {
    totalErrors: number;
    firstErrorTime: number;
    lastErrorTime: number;
    escalationHistory: EscalationEvent[];
  };
}

/**
    */
export interface TaskErrorState {
  taskId: string;
  taskType: TaskErrorState; //'download' | 'process' | 'simplify' | 'tile';
  target: {
    country?: string;
    adminLevel?: number;
    tileCoords?: { x: number; y: number; z: number };
  };

  error: BaseShapeError;
  workerInfo?: {
    workerId: string;
    workerType: string;
    timestamp: number;
  };

  status: 'active' | 'retrying' | 'failed' | 'skipped' | 'recovered';
  retryCount: number;
  lastRetryTime?: number;

  dependencies: string[];
  blockedTasks: string[];
  canSkip: boolean;
}

/**
    */
export interface GroupErrorState {
  groupId: string;
  groupType: 'country' | 'admin_level' | 'data_source' | 'worker_pool';

  affectedTasks: Set<string>;
  commonPattern?: {
    type: string;
    confidence: number;
    evidence: string[];
  };

  errorDistribution: Map<string, number>;
  failureRate: number;
  trend: 'increasing' | 'stable' | 'decreasing';

  rootCause?: {
    identified: boolean;
    type: string;
    description: string;
    evidence: string[];
  };
}

/**
    */
export interface StageErrorState {
  stage: 'download' | 'simplify1' | 'simplify2' | 'vectorTiles';

  status: 'running' | 'degraded' | 'failed' | 'recovered';
  health: number; // 0-100

  totalTasks: number;
  failedTasks: number;
  succeededTasks: number;
  skippedTasks: number;

  performanceImpact: {
    throughputReduction: number;
    latencyIncrease: number;
    resourceUtilization: number;
  };
}

/**
    */
export interface SessionErrorState {
  sessionId: string;
  criticalityLevel: 'low' | 'medium' | 'high' | 'critical';

  canContinue: boolean;
  requiresIntervention: boolean;
  dataIntegrity: 'intact' | 'partial' | 'compromised';

  recoveryOptions: {
    fullRecovery: boolean;
    partialRecovery: boolean;
    rollbackAvailable: boolean;
  };
}

/**
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
//  Worker
// ========================================

/**
  * Worker
  */
export interface WorkerErrorMessage {
  type: 'ERROR';
  workerId: string;
  workerType: string;
  timestamp: number;

  error: {
    code: string;
    message: string;
    category: ErrorCategory;
    technical?: Record<string, any>;
  };

  context: {
    taskId: string;
    stage: string;
    target?: any;
    progress?: number;
  };

  //  Worker
  workerState?: {
    memoryUsage: number;
    taskQueueLength: number;
    isHealthy: boolean;
  };
}

// ========================================
// ========================================

/**
  * Worker
  */
export class ErrorAggregationManager {
  private hierarchicalState: HierarchicalErrorState;
  private persistenceManager: ErrorPersistenceManager;
  private recoveryManager: RecoveryStrategyManager;

  private escalationThresholds = {
    taskToGroup: 3, //  3
    groupToStage: 2, //  2
    stageToSession: 1, //  1
    failureRateThreshold: 0.3, //  30%
  };

  private patterns = {
    commonErrors: new Map<string, number>(),
    errorSequences: [] as string[][],
    timePatterns: [] as { time: number; count: number }[],
  };

  constructor(
    private sessionId: string,
    private treeNodeId: NodeId,
  ) {
    this.hierarchicalState = this.initializeState();
    this.persistenceManager = new ErrorPersistenceManager();
    this.recoveryManager = new RecoveryStrategyManager();
  }

  /**
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
      * Worker
      */
  async handleWorkerError(message: WorkerErrorMessage): Promise<void> {
    console.log(
      `[ErrorAggregation] Received error from worker ${message.workerId}:`,
      message.error,
    );

    //  1.
    const taskError = await this.recordTaskError(message);

    //  2.
    this.detectTaskPatterns(taskError);

    //  3.
    await this.aggregateToGroup(taskError);

    //  4.
    await this.checkEscalation();

    //  5.
    await this.persistCurrentState();

    //  6.
    await this.selectRecoveryStrategy(taskError);
  }

  /**
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
            */
  private detectTaskPatterns(taskError: TaskErrorState): void {
    if (!taskError.error || !taskError.error.type) {
      console.warn(
        '[ErrorAggregationManager] Invalid error object in detectTaskPatterns:',
        taskError,
      );
      return;
    }

    const errorKey = `${taskError.error.type}_${taskError.error.code}`;

    this.patterns.commonErrors.set(errorKey, (this.patterns.commonErrors.get(errorKey) || 0) + 1);

    const recentSequence = Array.from(this.hierarchicalState.taskErrors.values())
      .slice(-5)
      .map((e) => e.error.type);
    this.patterns.errorSequences.push(recentSequence);

    const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
    const hourPattern = this.patterns.timePatterns.find((p) => p.time === currentHour);
    if (hourPattern) {
      hourPattern.count++;
    } else {
      this.patterns.timePatterns.push({ time: currentHour, count: 1 });
    }
  }

  /**
            */
  private async aggregateToGroup(taskError: TaskErrorState): Promise<void> {
    //  ID
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

    groupError.affectedTasks.add(taskError.taskId);
    groupError.errorDistribution.set(
      taskError.error.type,
      (groupError.errorDistribution.get(taskError.error.type) || 0) + 1,
    );

    const totalTasksInGroup = this.countTasksInGroup(groupId);
    groupError.failureRate = groupError.affectedTasks.size / totalTasksInGroup;

    groupError.trend = this.analyzeTrend(groupError);

    if (groupError.affectedTasks.size >= 3) {
      groupError.commonPattern = this.findCommonPattern(groupError);
    }

    if (groupError.failureRate > 0.5) {
      groupError.rootCause = await this.identifyRootCause(groupError);
    }
  }

  /**
            */
  private async checkEscalation(): Promise<void> {
    for (const [groupId, group] of this.hierarchicalState.groupErrors) {
      if (group.affectedTasks.size >= this.escalationThresholds.taskToGroup) {
        await this.escalateToStage(groupId, group);
      }
    }

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

    stageError.failedTasks += group.affectedTasks.size;
    stageError.health = Math.max(0, 100 - group.failureRate * 100);

    if (stageError.health < 50) {
      stageError.status = 'degraded';
    }
    if (stageError.health < 20) {
      stageError.status = 'failed';
    }

    stageError.performanceImpact = this.calculatePerformanceImpact(stageError);

    this.recordEscalation(
      ErrorHierarchyLevel.GROUP,
      ErrorHierarchyLevel.STAGE,
      `Group ${groupId} failure rate: ${group.failureRate}`,
    );
  }

  /**
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

    if (stage.status === 'failed') {
      this.hierarchicalState.sessionError.criticalityLevel = 'high';

      if (stageId === 'download') {
        this.hierarchicalState.sessionError.canContinue = false;
        this.hierarchicalState.sessionError.criticalityLevel = 'critical';
      }
    }

    this.hierarchicalState.sessionError.dataIntegrity = this.evaluateDataIntegrity();

    this.hierarchicalState.sessionError.requiresIntervention =
      this.hierarchicalState.sessionError.criticalityLevel === 'critical' ||
      !this.hierarchicalState.sessionError.canContinue;

    this.recordEscalation(
      ErrorHierarchyLevel.STAGE,
      ErrorHierarchyLevel.SESSION,
      `Stage ${stageId} failed`,
    );
  }

  /**
            */
  private async persistCurrentState(): Promise<void> {
    //  3 -
    const latestError = Array.from(this.hierarchicalState.taskErrors.values()).sort(
      (a, b) => (b.workerInfo?.timestamp || 0) - (a.workerInfo?.timestamp || 0),
    )[0];

    if (latestError) {
      await this.persistenceManager.saveError(this.sessionId, this.treeNodeId, latestError.error, {
        errorCount: this.hierarchicalState.taskErrors.size,
        timestamp: Date.now(),
      });
    }
  }

  /**
            */
  private async selectRecoveryStrategy(taskError: TaskErrorState): Promise<void> {
    const context = {
      error: taskError.error,
      sessionId: this.sessionId,
      treeNodeId: this.treeNodeId,
      config: {
        retryLimit: 3,
        timeoutMs: 30000,
        enableRecovery: true,
        logLevel: 'info',
      }, attemptNumber: taskError.retryCount,
      previousAttempts: [],
    };

    const strategy = await this.recoveryManager.executeRecovery(context);
    console.log(`[Recovery] Selected strategy: ${strategy.strategy} for task ${taskError.taskId}`);
  }

  // ========================================
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
    if (context.stage === 'download') return false;

    return message.error.category !== ErrorCategory.SYSTEM;
  }

  private determineGroupId(taskError: TaskErrorState): string {
    if (taskError.target.country) {
      return `country_${taskError.target.country}`;
    }

    return `error_${taskError.error.type}`;
  }

  private determineGroupType(taskError: TaskErrorState): GroupErrorState['groupType'] {
    if (taskError.target.country) return 'country';
    if (taskError.target.adminLevel !== undefined) return 'admin_level';
    if (taskError.workerInfo) return 'worker_pool';
    return 'data_source';
  }

  private countTasksInGroup(groupId: string): number {
    //  ID
    const tasksInGroup = Array.from(this.taskErrors.values()).filter(task =>
      this.categorizeTaskError(task) === this.extractGroupTypeFromId(groupId),
    );
    return tasksInGroup.length || 1; //  1
  }

  private analyzeTrend(group: GroupErrorState): 'increasing' | 'stable' | 'decreasing' {
    //  :
    const now = Date.now();
    const recentWindow = 60000; //  1
    const previousWindow = 120000; //  2

    const recentErrors = group.errors.filter(error =>
      now - error.timestamp < recentWindow,
    ).length;

    const previousErrors = group.errors.filter(error =>
      now - error.timestamp >= recentWindow && now - error.timestamp < previousWindow,
    ).length;

    if (recentErrors > previousErrors * 1.2) return 'increasing';
    if (recentErrors < previousErrors * 0.8) return 'decreasing';
    return 'stable';
  }

  private findCommonPattern(group: GroupErrorState): GroupErrorState['commonPattern'] {
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
    const pattern = group.commonPattern;
    if (!pattern) return undefined;

    if (pattern.type.includes('NETWORK')) {
      return {
        identified: true,
        type: 'network_issue',
        description: 'ネットワーク接続に問題がある可能性があります',
        evidence: [`${group.affectedTasks.size}個のタスクが同様のネットワークエラー`],
      };
    }

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

  private extractStageFromGroup(groupId: string): string {
    //  ID
    if (groupId.includes('download')) return 'download';
    if (groupId.includes('simplify')) return 'simplify';
    if (groupId.includes('tile')) return 'vectorTiles';
    if (groupId.includes('upload')) return 'upload';
    if (groupId.includes('validate')) return 'validate';

    return 'process';
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
      (s) => s.status === 'failed',
    ).length;

    if (stageFailures === 0) return 'intact';
    if (stageFailures === 1) return 'partial';
    return 'compromised';
  }

  private recordEscalation(
    from: ErrorHierarchyLevel,
    to: ErrorHierarchyLevel,
    trigger: string,
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
            */
  async recordError(errorInfo: {
    type: string;
    timestamp: number;
    category: TaskErrorState;
    severity: string;
  }): Promise<void> {
    //  TaskErrorState
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
      * ShapeErrorHandler
      */
  async detectPatterns(errors: Array<{ type: string; timestamp: number }>): Promise<{
    cyclical: boolean;
    memoryIncreasing: boolean;
    networkSpikes: boolean;
    bursty: boolean;
  }> {
    const now = Date.now();
    const recentWindow = 5 * 60 * 1000; //  5
    const recentErrors = errors.filter((e) => now - e.timestamp < recentWindow);

    const cyclical = this.detectCyclicalPattern(recentErrors);

    const memoryIncreasing = this.detectMemoryIncreasingPattern(recentErrors);

    const networkSpikes = this.detectNetworkSpikes(recentErrors);

    const bursty = this.detectBurstPattern(recentErrors);

    return {
      cyclical,
      memoryIncreasing,
      networkSpikes,
      bursty,
    };
  }

  // ========================================
  // ========================================

  /**
            */
  getHierarchicalState(): HierarchicalErrorState {
    return this.hierarchicalState;
  }

  /**
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
    const affectedTasks: string[] = [];
    const visited = new Set<string>();

    const queue = [...taskError.blockedTasks];

    while (queue.length > 0) {
      const taskId = queue.shift()!;
      if (visited.has(taskId)) continue;
      visited.add(taskId);
      affectedTasks.push(taskId);

      for (const otherError of this.taskErrors.values()) {
        if (otherError.blockedTasks.includes(taskId) && !visited.has(otherError.taskId)) {
          queue.push(otherError.taskId);
        }
      }
    }

    return affectedTasks;
  }

  private calculateCascadeRisk(taskError: TaskErrorState): number {
    //  0-1
    const blockedCount = taskError.blockedTasks.length;
    const totalTasks = this.hierarchicalState.taskErrors.size;

    return Math.min(1, blockedCount / Math.max(1, totalTasks));
  }

  /**
            */
  private detectCyclicalPattern(errors: Array<{ type: string; timestamp: number }>): boolean {
    if (errors.length < 3) return false;

    const errorsByType = errors.reduce(
      (acc, error) => {
        acc[error.type] = acc[error.type] || [];
        acc[error.type]?.push(error.timestamp);
        return acc;
      },
      {} as Record<string, number[]>,
    );

    for (const [_type, timestamps] of Object.entries(errorsByType)) {
      if (timestamps.length >= 3) {
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

        if (variance < avgInterval * 0.3) {
          return true;
        }
      }
    }

    return false;
  }

  /**
            */
  private detectMemoryIncreasingPattern(
    errors: Array<{ type: string; timestamp: number }>,
  ): boolean {
    const memoryErrors = errors.filter(
      (e) => e.type.includes('MEMORY') || e.type.includes('OUT_OF_MEMORY'),
    );

    if (memoryErrors.length < 2) return false;

    const sortedByTime = memoryErrors.sort((a, b) => a.timestamp - b.timestamp);
    const recentHalf = sortedByTime.slice(Math.floor(sortedByTime.length / 2));

    return recentHalf.length > sortedByTime.length / 3;
  }

  /**
            */
  private detectNetworkSpikes(errors: Array<{ type: string; timestamp: number }>): boolean {
    const networkErrors = errors.filter(
      (e) => e.type.includes('NETWORK') || e.type.includes('CONNECTION') || e.type.includes('CORS'),
    );

    if (networkErrors.length < 3) return false;

    const spikeWindow = 2 * 60 * 1000; //  2
    const now = Date.now();
    const recentSpike = networkErrors.filter((e) => now - e.timestamp < spikeWindow);

    return recentSpike.length >= 3;
  }

  /**
            */
  private detectBurstPattern(errors: Array<{ type: string; timestamp: number }>): boolean {
    if (errors.length < 5) return false;

    const burstWindow = 1 * 60 * 1000; //  1
    const now = Date.now();
    const recentBurst = errors.filter((e) => now - e.timestamp < burstWindow);

    return recentBurst.length >= 5;
  }
}
