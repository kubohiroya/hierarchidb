/**
 * BatchSessionManager - Manages batch processing sessions and orchestrates workers
 *
 * This manager handles:
 * - Session lifecycle (create, pause, resume, cancel)
 * - Task queue management and distribution
 * - Worker pool coordination
 * - Progress tracking and reporting
 * - Error handling and recovery
 */

import type { NodeId } from '@hierarchidb/common-types';
import { BaseBatchSessionManager } from '@hierarchidb/batch-runtime-services';
import type { BatchProgressEvent, BatchSessionStatus } from '@hierarchidb/common-api';
import { type BatchSessionRecord, type BatchTaskRecord, shapeDB } from '../database/ShapeDB.js';
import { SessionController } from './SessionController.js';
import { ShapeBatchSession } from './ShapeBatchSession.js';
import type { BatchSession, BatchStatus, ProcessingStage, ProgressInfo, StageStatus } from '../../common/types/index.js';
import type { BatchProcessConfig } from './types.js';
import type { DownloadTaskPayload, ShapeBatchCommandMap } from '../../common/types/index.js';

const logBatchSessionWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[ShapeBatchSessionManager]', message, error);
};

const STAGES: ProcessingStage[] = ['download', 'simplify1', 'simplify2', 'vectortile'];

export interface BatchSessionOptions {
  maxConcurrentTasks?: number;
  retryAttempts?: number;
  retryDelay?: number;
  timeoutMs?: number;
  enableResourceTracking?: boolean;
}

type SessionStartContext = {
  mode?: 'new' | 'resume';
  buildStartedAt?: number;
};

export class BatchSessionManager extends BaseBatchSessionManager {
  private legacyProgressCallbacks = new Map<string, (progress: ProgressInfo) => void>();

  constructor() {
    super();
    // WorkerPoolManager is now created per session by SessionController
  }

  async startBatchSession(_nodeId: NodeId): Promise<BatchSessionStatus> {
    throw new Error('Shape BatchSessionManager requires prepareSession/createSession to start.');
  }

  async initialize(): Promise<void> {
    // Resume any incomplete sessions from previous runs
    await this.resumeIncompleteSessions();
  }

  async shutdown(): Promise<void> {
    // Cancel all active sessions
    for (const [nodeId] of this.sessions) {
      await this.pauseSession(nodeId);
      this.sessions.delete(nodeId);
      this.legacyProgressCallbacks.delete(String(nodeId));
    }
    // WorkerPools are now managed by individual SessionControllers
  }

  // Session Lifecycle Management
  async createSession(
    nodeId: NodeId,
    config: BatchProcessConfig,
    downloadTaskPayloads: DownloadTaskPayload[],
    options: BatchSessionOptions = {},
    context: SessionStartContext = {},
  ): Promise<BatchSession> {
    const existing = await shapeDB.getBatchSession(nodeId);
    if (existing && this.sessions.has(nodeId)) {
      return existing;
    }
    if (existing?.status === 'running') {
      const taskCount = await shapeDB.batchTasks.where('nodeId').equals(nodeId).count();
      if (taskCount > 0) {
        this.sessions.delete(nodeId);
      }
    }
    if (existing) {
      this.sessions.delete(nodeId);
    }

    const mode = context.mode ?? 'new';
    const buildStartedAt = context.buildStartedAt ?? existing?.startedAt ?? Date.now();
    const now = Date.now();
    const baseProgress: ProgressInfo = mode === 'new' ? {
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      percentage: 0,
      currentStage: 'download',
      currentTask: 'Initializing...',
    } : (existing?.progress ?? {
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      percentage: 0,
      currentStage: 'download',
      currentTask: 'Initializing...',
    });
    if (mode === 'new') {
      await this.cleanupStaleTasks(nodeId, buildStartedAt);
    }
    const session: BatchSessionRecord = existing ?? {
      nodeId,
      status: 'running' as const,
      config,
      startedAt: buildStartedAt,
      updatedAt: now,
      progress: baseProgress,
      stages: this.initializeStages(config),
      resourceUsage: {
        memoryUsed: 0,
        memoryPeak: 0,
        cpuPercent: 0,
        storageUsed: 0,
        networkBytesReceived: 0,
        networkBytesSent: 0,
      },
    };
    const stages = mode === 'new' ? this.initializeStages(config) : (session.stages ?? this.initializeStages(config));
    const updatedSession: BatchSessionRecord = {
      ...session,
      status: 'running',
      config,
      updatedAt: now,
      startedAt: buildStartedAt,
      progress: {
        ...baseProgress,
        total: Math.max(baseProgress.total ?? 0, downloadTaskPayloads.length),
      },
      stages,
    };

    await shapeDB.batchSessions.put(updatedSession);

    // Create session controller with per-session worker pool
    const controller = new SessionController(
      nodeId,
      downloadTaskPayloads,
      config,
      options,
    );

    //  Start processing
    const shared = new ShapeBatchSession(
      nodeId,
      { concurrency: options.maxConcurrentTasks },
      controller,
      (ev) => this.emitLegacyProgress(String(nodeId), ev),
    );
    controller.setPauseHandler(async (stage, message) => {
      await shared.pause();
      shared.emitWarning(stage, message);
    });
    this.registerSession(shared);
    // Run without blocking the caller.
    shared
      .initialize()
      .then(() => shared.start())
      .catch(async (e) => {
        if (e instanceof Error && e.name === 'AbortError') {
          return;
        }
        console.error('Shape shared session failed', e);
      });


    return session;
  }

  async pauseSession(nodeId: string): Promise<void> {
    const resolved = nodeId as NodeId;
    if (this.sessions.has(resolved)) {
      await this.pauseBatchSession(resolved);
      return;
    }
    const existing = await shapeDB.getBatchSession(resolved);
    if (!existing) {
      throw new Error(`Session ${nodeId} not found`);
    }
    await shapeDB.updateBatchSession(resolved, {
      status: 'paused',
      updatedAt: Date.now(),
    });
  }

  async resumeSession(nodeId: string): Promise<void> {
    const resolved = nodeId as NodeId;
    if (this.sessions.has(resolved)) {
      await this.resumeBatchSession(resolved);
      return;
    }
    const existing = await shapeDB.getBatchSession(resolved);
    if (!existing) {
      throw new Error(`Session ${nodeId} not found`);
    }
    const downloadTasks = await shapeDB.batchTasks
      .where('nodeId')
      .equals(resolved)
      .and((task) => task.taskType === 'download')
      .toArray();
    const downloadPayloads = downloadTasks
      .map((task) => task.inputData as DownloadTaskPayload | undefined)
      .filter((payload): payload is DownloadTaskPayload => Boolean(payload));
    if (downloadPayloads.length === 0) {
      throw new Error(`Session ${nodeId} missing download payloads`);
    }
    await this.createSession(resolved, existing.config as BatchProcessConfig, downloadPayloads, {}, {
      mode: 'resume',
      buildStartedAt: existing.startedAt,
    });
  }

  async getSessionStatus(nodeId: string): Promise<BatchStatus> {
    const session = await shapeDB.getBatchSession(nodeId as NodeId);
    if (!session) {
      throw new Error(`Session ${nodeId} not found`);
    }

    const tasks = await shapeDB.getBatchTasks(nodeId as NodeId);
    const currentTasks = tasks.filter((t: BatchTaskRecord) => t.status === 'running');
    const queuedTasks = tasks.filter((t: BatchTaskRecord) => t.status === 'waiting').length;
    const errors = tasks
      .filter((t: BatchTaskRecord) => t.status === 'failed')
      .map((t: BatchTaskRecord) => ({
        taskId: t.taskId,
        nodeId: t.nodeId,
        error: t.errorMessage || 'Unknown error',
        timestamp: t.completedAt || Date.now(),
        stage: t.taskType,
        retryable: (t.retryCount || 0) < 3,
      }));

    return {
      session,
      currentTasks,
      queuedTasks,
      errors,
      warnings: [],
      estimatedTimeRemaining: this.calculateTimeRemaining(session, tasks),
      throughput: this.calculateThroughput(tasks),
    };
  }

  // Progress Tracking
  onProgress(nodeId: string, callback: (progress: ProgressInfo) => void): () => void {
    this.legacyProgressCallbacks.set(nodeId, callback);
    return () => {
      const current = this.legacyProgressCallbacks.get(nodeId);
      if (current === callback) {
        this.legacyProgressCallbacks.delete(nodeId);
      }
    };
  }

  async dispatchCommand<K extends keyof ShapeBatchCommandMap>(
    command: K,
    payload: ShapeBatchCommandMap[K],
  ): Promise<void> {
    const nodeId = payload.nodeId as NodeId;
    const shared = this.sessions.get(nodeId) as ShapeBatchSession | undefined;
    if (!shared) {
      throw new Error(`Batch session ${nodeId} not found`);
    }

    switch (command) {
      case 'session/pause':
        STAGES.forEach((stage) => { shared.pauseStage(stage); });
        await this.pauseSession(String(nodeId));
        break;
      case 'session/resume':
        shared.resumeAllStages();
        await this.resumeSession(String(nodeId));
        break;
      case 'stage/pause':
        shared.pauseStage((payload as {stage: ProcessingStage}).stage);
        break;
      case 'stage/resume':
        shared.resumeStage((payload as {stage: ProcessingStage}).stage);
        break;
      default:
        logBatchSessionWarning(`Unknown batch command ${String(command)}`, undefined);
        break;
    }
  }

  protected async onSessionProgress(session: ShapeBatchSession, event: BatchProgressEvent): Promise<void> {
    const payload = event.payload ?? {};
    const total = payload.total ?? 0;
    const completed = payload.completed ?? 0;
    const failed = payload.failed ?? 0;
    const skipped = payload.skipped ?? 0;
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    const progress: ProgressInfo = {
      total,
      completed,
      failed,
      skipped,
      percentage,
      currentStage: (event.stage as ProcessingStage) ?? 'processing',
      currentTask: payload.currentTask,
    };
    await shapeDB.updateBatchSession(session.getState().nodeId, { progress });
  }

  protected async onSessionStatusChange(session: ShapeBatchSession): Promise<void> {
    const state = session.getState();
    if (state.status === 'idle') {
      return;
    }
    const updates: Partial<BatchSessionRecord> = {
      status: state.status,
      updatedAt: Date.now(),
    };
    if (state.status === 'completed' || state.status === 'failed') {
      updates.completedAt = Date.now();
      this.sessions.delete(state.nodeId);
      this.legacyProgressCallbacks.delete(String(state.nodeId));
    }
    await shapeDB.updateBatchSession(state.nodeId, updates);
  }

  private emitLegacyProgress(nodeId: string, progress: ProgressInfo): void {
    const callback = this.legacyProgressCallbacks.get(nodeId);
    if (!callback) return;
    try {
      callback(progress);
    } catch (error) {
      logBatchSessionWarning(`Progress callback for session ${nodeId} failed`, error);
    }
  }

  /*
  private async updateProgress(nodeId: string, progress: Partial<ProgressInfo>): Promise<void> {
    const session = await shapeDB.getBatchSession(nodeId as NodeId);
    if (!session) return;

    const updatedProgress = { ...session.progress, ...progress };
    updatedProgress.percentage =
      updatedProgress.total > 0 ? (updatedProgress.completed / updatedProgress.total) * 100 : 0;

    await shapeDB.updateBatchSession(nodeId as NodeId, {
      progress: updatedProgress,
    });

    // Notify callback
    const callback = this.progressCallbacks.get(nodeId);
    if (callback) {
      callback(updatedProgress);
    }
  }
   */

  // Private Methods
  private initializeStages(_config: BatchProcessConfig): Record<ProcessingStage, StageStatus> {
    const stages: ProcessingStage[] = ['download', 'simplify1', 'simplify2', 'vectortile'];
    const stageStatus = {} as Record<ProcessingStage, StageStatus>;

    for (const stage of stages) {
      stageStatus[stage] = {
        status: 'waiting',
        progress: 0,
        tasksTotal: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
      };
    }

    return stageStatus;
  }

  private async resumeIncompleteSessions(): Promise<void> {
    const incompleteSessions = await shapeDB.batchSessions
      .where('status')
      .anyOf(['running', 'paused'])
      .toArray();

    for (const session of incompleteSessions) {
      const allTasks = await shapeDB.batchTasks
        .where('nodeId')
        .equals(session.nodeId)
        .toArray();
      const cutoff = session.startedAt ?? 0;
      const staleTasks = cutoff > 0
        ? allTasks.filter((task) => this.getTaskTimestamp(task) < cutoff)
        : [];
      if (staleTasks.length > 0) {
        await shapeDB.batchTasks.bulkDelete(staleTasks.map((task) => task.taskId));
      }
      const staleIds = new Set(staleTasks.map((task) => task.taskId));
      const runningTasks = allTasks.filter((task) => task.status === 'running' && !staleIds.has(task.taskId));
      if (runningTasks.length > 0) {
        const resetAt = Date.now();
        const resetTasks = runningTasks.map((task) => ({
          ...task,
          status: 'waiting' as const,
          progress: 0,
          message: undefined,
          startedAt: undefined,
          completedAt: undefined,
          retryCount: undefined,
          outputData: undefined,
          errorMessage: undefined,
          updatedAt: resetAt,
        }));
        await shapeDB.batchTasks.bulkPut(resetTasks);
      }
      if (session.status === 'running') {
        // Switch to paused so users can resume after reload.
        await shapeDB.updateBatchSession(session.nodeId, {
          status: 'paused',
          updatedAt: Date.now(),
        });
      }
    }
  }

  // (removed unused helpers to satisfy dts build rules)

  private calculateTimeRemaining(
    session: BatchSessionRecord,
    tasks: BatchTaskRecord[],
  ): number | undefined {
    const completedTasks = tasks.filter((t: BatchTaskRecord) => t.status === 'completed');
    if (completedTasks.length === 0) return undefined;

    const avgTaskTime =
      completedTasks.reduce((sum: number, task: BatchTaskRecord) => {
        if (task.startedAt && task.completedAt) {
          return sum + (task.completedAt - task.startedAt);
        }
        return sum;
      }, 0) / completedTasks.length;

    const remainingTasks = session.progress.total - session.progress.completed;
    return remainingTasks * avgTaskTime;
  }

  private calculateThroughput(
    tasks: BatchTaskRecord[],
  ): { tasksPerSecond: number; bytesPerSecond: number } | undefined {
    const recentTasks = tasks.filter(
      (t: BatchTaskRecord) => t.status === 'completed' && t.completedAt && t.completedAt > Date.now() - 60000, // Last minute
    );

    if (recentTasks.length === 0) {
      return undefined;
    }

    const tasksPerSecond = recentTasks.length / 60;
    const bytesPerSecond = 0; // Would need to track bytes processed

    return { tasksPerSecond, bytesPerSecond };
  }

  private getTaskTimestamp(task: BatchTaskRecord): number {
    return task.updatedAt ?? task.createdAt ?? task.startedAt ?? 0;
  }

  private async cleanupStaleTasks(nodeId: NodeId, buildStartedAt: number): Promise<void> {
    if (!Number.isFinite(buildStartedAt) || buildStartedAt <= 0) return;
    const tasks = await shapeDB.batchTasks.where('nodeId').equals(nodeId).toArray();
    const stale = tasks.filter((task) => this.getTaskTimestamp(task) < buildStartedAt);
    if (stale.length === 0) return;
    await shapeDB.batchTasks.bulkDelete(stale.map((task) => task.taskId));
  }
}
