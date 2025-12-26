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
import type { BatchProgressEvent } from '@hierarchidb/common-api';
import { type BatchSessionRecord, type BatchTaskRecord, shapeDB } from '../database/ShapeDB.js';
import { SessionController } from './SessionController.js';
import { ShapeBatchSession } from './ShapeBatchSession.js';
import type { BatchSession, BatchStatus, ProcessingStage, ProgressInfo, StageStatus } from '../../common/types/index.js';
import type { BatchProcessConfig } from './types.js';
import type { UrlMetadata, ShapeBatchCommandMap } from '../../common/types/index.js';

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

export class BatchSessionManager extends BaseBatchSessionManager {
  private legacyProgressCallbacks = new Map<string, (progress: ProgressInfo) => void>();

  constructor() {
    super();
    // WorkerPoolManager is now created per session by SessionController
  }

  async startBatchSession(_nodeId: NodeId): Promise<string> {
    throw new Error('Shape BatchSessionManager requires prepareSession/createSession to start.');
  }

  async initialize(): Promise<void> {
    // Resume any incomplete sessions from previous runs
    await this.resumeIncompleteSessions();
  }

  async shutdown(): Promise<void> {
    // Cancel all active sessions
    for (const [sessionId] of this.sessions) {
      await this.cancelSession(sessionId);
    }
    // WorkerPools are now managed by individual SessionControllers
  }

  // Session Lifecycle Management
  async createSession(
    nodeId: NodeId,
    config: BatchProcessConfig,
    urlMetadata: UrlMetadata[],
    options: BatchSessionOptions = {},
  ): Promise<BatchSession> {
    const sessionId = String(nodeId);
    const existing = await shapeDB.getBatchSession(sessionId);
    if (existing) {
      if (existing.status === 'running') {
        const taskCount = await shapeDB.batchTasks.where('sessionId').equals(sessionId).count();
        if (taskCount > 0) {
          return existing;
        }
      }
      this.sessions.delete(sessionId);
      await shapeDB.batchTasks.where('sessionId').equals(sessionId).delete();
      await shapeDB.batchSessions.delete(sessionId);
    }

    // Create session record
    const session = await shapeDB.createBatchSession({
      sessionId,
      nodeId,
      status: 'running',
      config,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      progress: {
        total: urlMetadata.length,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
        currentStage: 'download',
        currentTask: 'Initializing...',
      },
      stages: this.initializeStages(config),
      resourceUsage: {
        memoryUsed: 0,
        memoryPeak: 0,
        cpuPercent: 0,
        storageUsed: 0,
        networkBytesReceived: 0,
        networkBytesSent: 0,
      },
    });

    // Create session controller with per-session worker pool
    const controller = new SessionController(
      session.sessionId,
      nodeId,
      urlMetadata,
      config,
      options,
    );

    //  Start processing
    const shared = new ShapeBatchSession(
      session.sessionId,
      nodeId,
      { concurrency: options.maxConcurrentTasks },
      controller,
      (ev) => this.emitLegacyProgress(session.sessionId, ev),
    );
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

  async pauseSession(sessionId: string): Promise<void> {
    await this.pauseBatchSession(sessionId);
  }

  async resumeSession(sessionId: string): Promise<void> {
    await this.resumeBatchSession(sessionId);
  }

  async cancelSession(sessionId: string): Promise<void> {
    await this.cancelBatchSession(sessionId);

    // Cancel all pending tasks
    const tasks = await shapeDB.getBatchTasks(sessionId);
    for (const task of tasks) {
      if (task.status === 'waiting' || task.status === 'running') {
        await shapeDB.updateBatchTask(task.taskId, {
          status: 'cancelled',
        });
      }
    }
  }

  async getSessionStatus(sessionId: string): Promise<BatchStatus> {
    const session = await shapeDB.getBatchSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const tasks = await shapeDB.getBatchTasks(sessionId);
    const currentTasks = tasks.filter((t: BatchTaskRecord) => t.status === 'running');
    const queuedTasks = tasks.filter((t: BatchTaskRecord) => t.status === 'waiting').length;
    const errors = tasks
      .filter((t: BatchTaskRecord) => t.status === 'failed')
      .map((t: BatchTaskRecord) => ({
        taskId: t.taskId,
        sessionId: t.sessionId,
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
  onProgress(sessionId: string, callback: (progress: ProgressInfo) => void): () => void {
    this.legacyProgressCallbacks.set(sessionId, callback);
    return () => {
      const current = this.legacyProgressCallbacks.get(sessionId);
      if (current === callback) {
        this.legacyProgressCallbacks.delete(sessionId);
      }
    };
  }

  async dispatchCommand<K extends keyof ShapeBatchCommandMap>(
    command: K,
    payload: ShapeBatchCommandMap[K],
  ): Promise<void> {
    const sessionId = payload.sessionId as string;
    const shared = this.sessions.get(sessionId) as ShapeBatchSession | undefined;
    if (!shared) {
      throw new Error(`Batch session ${sessionId} not found`);
    }

    switch (command) {
      case 'session/pause':
        STAGES.forEach((stage) => { shared.pauseStage(stage); });
        await this.pauseSession(sessionId);
        break;
      case 'session/resume':
        shared.resumeAllStages();
        await this.resumeSession(sessionId);
        break;
      case 'session/cancel':
        shared.resumeAllStages();
        await this.cancelSession(sessionId);
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
    await shapeDB.updateBatchSession(session.getState().sessionId, { progress });
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
    if (state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled') {
      updates.completedAt = Date.now();
      this.sessions.delete(state.sessionId);
      this.legacyProgressCallbacks.delete(state.sessionId);
    }
    await shapeDB.updateBatchSession(state.sessionId, updates);
  }

  private emitLegacyProgress(sessionId: string, progress: ProgressInfo): void {
    const callback = this.legacyProgressCallbacks.get(sessionId);
    if (!callback) return;
    try {
      callback(progress);
    } catch (error) {
      logBatchSessionWarning(`Progress callback for session ${sessionId} failed`, error);
    }
  }

  /*
  private async updateProgress(sessionId: string, progress: Partial<ProgressInfo>): Promise<void> {
    const session = await shapeDB.getBatchSession(sessionId);
    if (!session) return;

    const updatedProgress = { ...session.progress, ...progress };
    updatedProgress.percentage =
      updatedProgress.total > 0 ? (updatedProgress.completed / updatedProgress.total) * 100 : 0;

    await shapeDB.updateBatchSession(sessionId, {
      progress: updatedProgress,
    });

    // Notify callback
    const callback = this.progressCallbacks.get(sessionId);
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
      if (session.status === 'running') {
        // Mark as failed since we're restarting
        await shapeDB.updateBatchSession(session.sessionId, {
          status: 'failed',
          completedAt: Date.now(),
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
}
