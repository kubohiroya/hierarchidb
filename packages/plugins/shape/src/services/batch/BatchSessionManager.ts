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

import type { NodeId } from "@hierarchidb/00-core";
import {
  shapeDB,
  type BatchSessionRecord,
  type BatchTaskRecord,
} from "../database/ShapeDB";
import { WorkerPoolManager } from "../workers/WorkerPoolManager";
import type {
  BatchProcessConfig,
  BatchSession,
  BatchStatus,
  TaskStatus,
  ProcessingStage,
  ProgressInfo,
  StageStatus,
  ErrorInfo,
  ResourceUsage,
} from "../types";
import type { UrlMetadata } from "../../types";

export interface BatchSessionOptions {
  maxConcurrentTasks?: number;
  retryAttempts?: number;
  timeoutMs?: number;
  enableResourceTracking?: boolean;
}

export class BatchSessionManager {
  private workerPoolManager: WorkerPoolManager;
  private activeSessions = new Map<string, SessionController>();
  private progressCallbacks = new Map<
    string,
    (progress: ProgressInfo) => void
  >();

  constructor() {
    this.workerPoolManager = new WorkerPoolManager({
      downloadWorkers: 2,
      simplify1Workers: 2,
      simplify2Workers: 1,
      vectorTileWorkers: 1,
      workerOptions: {
        timeout: 300000,
        retries: 3,
        maxMemoryPerWorker: 512 * 1024 * 1024,
        restartThreshold: 5,
      },
    });
  }

  async initialize(): Promise<void> {
    await this.workerPoolManager.initialize();

    // Resume any incomplete sessions from previous runs
    await this.resumeIncompleteSessions();
  }

  async shutdown(): Promise<void> {
    // Cancel all active sessions
    for (const [sessionId] of this.activeSessions) {
      await this.cancelSession(sessionId);
    }

    await this.workerPoolManager.shutdown();
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
      status: "running",
      config,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      progress: {
        total: urlMetadata.length,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
        currentStage: "download",
        currentTask: "Initializing...",
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

    // Create session controller
    const controller = new SessionController(
      session,
      urlMetadata,
      this.workerPoolManager,
      options,
    );

    this.activeSessions.set(session.sessionId, controller);

    // Start processing
    this.startSessionProcessing(controller);

    return session;
  }

  async pauseSession(sessionId: string): Promise<void> {
    const controller = this.activeSessions.get(sessionId);
    if (!controller) {
      throw new Error(`Session ${sessionId} not found`);
    }

    await controller.pause();
    await shapeDB.updateBatchSession(sessionId, {
      status: "paused",
    });
  }

  async resumeSession(sessionId: string): Promise<void> {
    const controller = this.activeSessions.get(sessionId);
    if (!controller) {
      // Try to resume from database
      const session = await shapeDB.getBatchSession(sessionId);
      if (!session || session.status !== "paused") {
        throw new Error(`Cannot resume session ${sessionId}`);
      }

      // Create new controller and resume
      const urlMetadata = await this.reconstructUrlMetadata(session);
      const newController = new SessionController(
        session,
        urlMetadata,
        this.workerPoolManager,
      );

      this.activeSessions.set(sessionId, newController);
      await newController.resume();
    } else {
      await controller.resume();
    }

    await shapeDB.updateBatchSession(sessionId, {
      status: "running",
    });
  }

  async cancelSession(sessionId: string): Promise<void> {
    const controller = this.activeSessions.get(sessionId);
    if (controller) {
      await controller.cancel();
      this.activeSessions.delete(sessionId);
    }

    await shapeDB.updateBatchSession(sessionId, {
      status: "cancelled",
      completedAt: Date.now(),
    });

    // Cancel all pending tasks
    const tasks = await shapeDB.getBatchTasks(sessionId);
    for (const task of tasks) {
      if (task.status === "waiting" || task.status === "running") {
        await shapeDB.updateBatchTask(task.taskId, {
          status: "cancelled",
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
    const currentTasks = tasks.filter((t: any) => t.status === "running");
    const queuedTasks = tasks.filter((t: any) => t.status === "waiting").length;
    const errors = tasks
      .filter((t: any) => t.status === "failed")
      .map((t: any) => ({
        taskId: t.taskId,
        sessionId: t.sessionId,
        error: t.errorMessage || "Unknown error",
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
  onProgress(
    sessionId: string,
    callback: (progress: ProgressInfo) => void,
  ): void {
    this.progressCallbacks.set(sessionId, callback);
  }

  private async updateProgress(
    sessionId: string,
    progress: Partial<ProgressInfo>,
  ): Promise<void> {
    const session = await shapeDB.getBatchSession(sessionId);
    if (!session) return;

    const updatedProgress = { ...session.progress, ...progress };
    updatedProgress.percentage =
      updatedProgress.total > 0
        ? (updatedProgress.completed / updatedProgress.total) * 100
        : 0;

    await shapeDB.updateBatchSession(sessionId, {
      progress: updatedProgress,
    });

    // Notify callback
    const callback = this.progressCallbacks.get(sessionId);
    if (callback) {
      callback(updatedProgress);
    }
  }

  // Private Methods
  private initializeStages(
    config: BatchProcessConfig,
  ): Record<ProcessingStage, StageStatus> {
    const stages: ProcessingStage[] = [
      "download",
      "simplify1",
      "simplify2",
      "vectortile",
    ];
    const stageStatus: Record<ProcessingStage, StageStatus> = {} as any;

    for (const stage of stages) {
      stageStatus[stage] = {
        status: "waiting",
        progress: 0,
        tasksTotal: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
      };
    }

    return stageStatus;
  }

  private async startSessionProcessing(
    controller: SessionController,
  ): Promise<void> {
    try {
      await controller.start();
    } catch (error) {
      console.error(`Session ${controller.sessionId} failed:`, error);
      await shapeDB.updateBatchSession(controller.sessionId, {
        status: "failed",
        completedAt: Date.now(),
      });
      this.activeSessions.delete(controller.sessionId);
    }
  }

  private async resumeIncompleteSessions(): Promise<void> {
    const incompleteSessions = await shapeDB.batchSessions
      .where("status")
      .anyOf(["running", "paused"])
      .toArray();

    for (const session of incompleteSessions) {
      if (session.status === "running") {
        // Mark as failed since we're restarting
        await shapeDB.updateBatchSession(session.sessionId, {
          status: "failed",
          completedAt: Date.now(),
        });
      }
    }
  }

  private async reconstructUrlMetadata(
    session: BatchSessionRecord,
  ): Promise<UrlMetadata[]> {
    // This would reconstruct URL metadata from session config
    // For now, return empty array
    return [];
  }

  private calculateTimeRemaining(
    session: BatchSessionRecord,
    tasks: BatchTaskRecord[],
  ): number | undefined {
    const completedTasks = tasks.filter((t: any) => t.status === "completed");
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
      (t: any) =>
        t.status === "completed" &&
        t.completedAt &&
        t.completedAt > Date.now() - 60000, // Last minute
    );

    if (recentTasks.length === 0) {
      return undefined;
    }

    const tasksPerSecond = recentTasks.length / 60;
    const bytesPerSecond = 0; // Would need to track bytes processed

    return { tasksPerSecond, bytesPerSecond };
  }
}

/**
 * SessionController - Controls individual batch session execution
 */
class SessionController {
  public readonly sessionId: string;
  private isPaused = false;
  private isCancelled = false;
  private taskQueue: BatchTaskRecord[] = [];
  private runningTasks = new Set<string>();

  constructor(
    private session: BatchSessionRecord,
    private urlMetadata: UrlMetadata[],
    private workerPoolManager: WorkerPoolManager,
    private options: BatchSessionOptions = {},
  ) {
    this.sessionId = session.sessionId;
  }

  async start(): Promise<void> {
    // Create initial download tasks
    await this.createDownloadTasks();

    // Start processing queue
    this.processTaskQueue();
  }

  async pause(): Promise<void> {
    this.isPaused = true;
  }

  async resume(): Promise<void> {
    this.isPaused = false;
    this.processTaskQueue();
  }

  async cancel(): Promise<void> {
    this.isCancelled = true;
    this.isPaused = true;

    // Cancel running tasks
    for (const taskId of this.runningTasks) {
      // Would cancel actual worker tasks
    }
    this.runningTasks.clear();
  }

  private async createDownloadTasks(): Promise<void> {
    for (let i = 0; i < this.urlMetadata.length; i++) {
      const metadata = this.urlMetadata[i];
      const task = await shapeDB.createBatchTask({
        sessionId: this.sessionId,
        type: "download",
        status: "waiting",
        index: i,
        progress: 0,
        inputData: metadata,
      });
      this.taskQueue.push(task);
    }
  }

  private async processTaskQueue(): Promise<void> {
    while (!this.isPaused && !this.isCancelled && this.taskQueue.length > 0) {
      const maxConcurrent = this.options.maxConcurrentTasks || 3;

      if (this.runningTasks.size >= maxConcurrent) {
        await this.waitForTaskCompletion();
        continue;
      }

      const task = this.taskQueue.shift();
      if (!task) continue;

      this.executeTask(task);
    }
  }

  private async executeTask(task: BatchTaskRecord): Promise<void> {
    this.runningTasks.add(task.taskId);

    try {
      await shapeDB.updateBatchTask(task.taskId, {
        status: "running",
        startedAt: Date.now(),
      });

      // Execute based on task type
      switch (task.type) {
        case "download":
          await this.executeDownloadTask(task);
          break;
        case "simplify1":
          await this.executeSimplify1Task(task);
          break;
        case "simplify2":
          await this.executeSimplify2Task(task);
          break;
        case "vectortile":
          await this.executeVectorTileTask(task);
          break;
      }

      await shapeDB.updateBatchTask(task.taskId, {
        status: "completed",
        completedAt: Date.now(),
        progress: 100,
      });
    } catch (error) {
      await shapeDB.updateBatchTask(task.taskId, {
        status: "failed",
        completedAt: Date.now(),
        errorMessage: error instanceof Error ? error.message : String(error),
        retryCount: (task.retryCount || 0) + 1,
      });

      // Retry if attempts remaining
      if ((task.retryCount || 0) < (this.options.retryAttempts || 3)) {
        this.taskQueue.push(task);
      }
    } finally {
      this.runningTasks.delete(task.taskId);
    }
  }

  private async executeDownloadTask(task: BatchTaskRecord): Promise<void> {
    // Would use download worker
    console.log(`Executing download task ${task.taskId}`);
  }

  private async executeSimplify1Task(task: BatchTaskRecord): Promise<void> {
    // Would use simplify worker 1
    console.log(`Executing simplify1 task ${task.taskId}`);
  }

  private async executeSimplify2Task(task: BatchTaskRecord): Promise<void> {
    // Would use simplify worker 2
    console.log(`Executing simplify2 task ${task.taskId}`);
  }

  private async executeVectorTileTask(task: BatchTaskRecord): Promise<void> {
    // Would use vector tile worker
    console.log(`Executing vector tile task ${task.taskId}`);
  }

  private async waitForTaskCompletion(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const maxConcurrent = this.options.maxConcurrentTasks || 3;
        if (this.runningTasks.size < maxConcurrent) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }
}
