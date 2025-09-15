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

import type { NodeId } from '@hierarchidb/common-type';
import { type BatchSessionRecord, type BatchTaskRecord, shapeDB } from '../database/ShapeDB';
import { SessionController } from './SessionController';
import { ShapeBatchSession } from './ShapeBatchSession';
import type { BatchSession, BatchStatus, ProcessingStage, ProgressInfo, StageStatus } from '../types';
import type { BatchProcessConfig } from './types';
import type { UrlMetadata } from '../../shared/types';

export interface BatchSessionOptions {
  maxConcurrentTasks?: number;
  retryAttempts?: number;
  timeoutMs?: number;
  enableResourceTracking?: boolean;
}

export class BatchSessionManager {
  private sharedSessions = new Map<string, ShapeBatchSession>();
  private progressCallbacks = new Map<string, (progress: ProgressInfo) => void>();

  constructor() {
    // WorkerPoolManager is now created per session by SessionController
  }

  async initialize(): Promise<void> {
    // Resume any incomplete sessions from previous runs
    await this.resumeIncompleteSessions();
  }

  async shutdown(): Promise<void> {
    // Cancel all active sessions
    for (const [sessionId] of this.sharedSessions) {
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
    // Check for existing active sessions
    const existingSessions = await shapeDB.getActiveBatchSessions(nodeId);
    if (existingSessions.length > 0) {
      throw new Error(`Node ${nodeId} already has an active batch session`);
    }

    // Create session record
    const session = await shapeDB.createBatchSession({
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
    const shared = new ShapeBatchSession(session.sessionId, nodeId, { concurrency: options.maxConcurrentTasks }, controller, (ev) => {
      try {
        this.progressCallbacks.get(session.sessionId)?.({
          total: ev.total,
          completed: ev.completed,
          failed: ev.failed,
          skipped: 0,
          percentage: ev.percentage,
          currentStage: (ev.stage as ProcessingStage) ?? 'processing',
          currentTask: ev.currentTask,
        });
      } catch {
      }
    });
    this.sharedSessions.set(session.sessionId, shared);
    //  Run without
    shared.initialize().then(() => shared.start()).catch((e) => console.error('Shape shared session failed', e));


    return session;
  }

  async pauseSession(sessionId: string): Promise<void> {
    const shared = this.sharedSessions.get(sessionId);
    if (!shared) throw new Error(`Session ${sessionId} not found`);
    await shared.pause();
    await shapeDB.updateBatchSession(sessionId, {
      status: 'paused',
    });
  }

  async resumeSession(sessionId: string): Promise<void> {
    const shared = this.sharedSessions.get(sessionId);
    if (!shared) throw new Error(`Session ${sessionId} not found`);
    await shared.resume();

    await shapeDB.updateBatchSession(sessionId, {
      status: 'running',
    });
  }

  async cancelSession(sessionId: string): Promise<void> {
    const shared = this.sharedSessions.get(sessionId);
    if (!shared) return;
    await shared.cancel();
    this.sharedSessions.delete(sessionId);

    await shapeDB.updateBatchSession(sessionId, {
      status: 'cancelled',
      completedAt: Date.now(),
    });

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
    const currentTasks = tasks.filter((t: any) => t.status === 'running');
    const queuedTasks = tasks.filter((t: any) => t.status === 'waiting').length;
    const errors = tasks
      .filter((t: any) => t.status === 'failed')
      .map((t: any) => ({
        taskId: t.taskId,
        sessionId: t.sessionId,
        error: t.errorMessage || 'Unknown error',
        timestamp: t.completedAt || Date.now(),
        stage: t.type,
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
  onProgress(sessionId: string, callback: (progress: ProgressInfo) => void): void {
    this.progressCallbacks.set(sessionId, callback);
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
    const completedTasks = tasks.filter((t: any) => t.status === 'completed');
    if (completedTasks.length === 0) return undefined;

    const avgTaskTime =
      completedTasks.reduce((sum: number, task: any) => {
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
      (t: any) => t.status === 'completed' && t.completedAt && t.completedAt > Date.now() - 60000, // Last minute
    );

    if (recentTasks.length === 0) {
      return undefined;
    }

    const tasksPerSecond = recentTasks.length / 60;
    const bytesPerSecond = 0; // Would need to track bytes processed

    return { tasksPerSecond, bytesPerSecond };
  }
}
