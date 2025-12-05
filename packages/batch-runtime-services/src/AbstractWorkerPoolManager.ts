/**
 * Abstract Base Class for Worker Pool Management
 * Provides common worker pool functionality for batch processing
 */

/**
 * Worker pool configuration
 */
export interface WorkerPoolConfig {
  maxWorkers: number;
  workerScriptPath?: string;
  workerOptions?: WorkerOptions;
}

/**
 * Individual worker options
 */
export interface WorkerOptions {
  timeout?: number;
  retries?: number;
  maxMemoryPerWorker?: number;
  restartThreshold?: number;
}

/**
 * Worker task interface
 */
export interface WorkerTask<T = any> {
  id: string;
  type: string;
  data: T;
  priority?: number;
  timeout?: number;
  retries?: number;
}

/**
 * Worker task result
 */
export interface WorkerTaskResult<T = any> {
  taskId: string;
  success: boolean;
  data?: T;
  error?: string;
  duration?: number;
  retryCount?: number;
}

/**
 * Worker state
 */
export interface WorkerState {
  id: string;
  status: 'idle' | 'busy' | 'error' | 'terminated';
  currentTask?: string;
  tasksCompleted: number;
  tasksFailed: number;
  lastActivity: number;
  errorCount: number;
}

/**
 * Worker pool statistics
 */
export interface WorkerPoolStats {
  totalWorkers: number;
  idleWorkers: number;
  busyWorkers: number;
  errorWorkers: number;
  queueLength: number;
  tasksCompleted: number;
  tasksFailed: number;
  averageTaskDuration: number;
}

/**
 * Abstract base class for worker pool management
 */
export abstract class AbstractWorkerPoolManager<
  TTask extends WorkerTask = WorkerTask,
  TResult extends WorkerTaskResult = WorkerTaskResult
> {
  protected config: WorkerPoolConfig;
  protected workers: Map<string, Worker>;
  protected workerStates: Map<string, WorkerState>;
  protected taskQueue: TTask[];
  protected pendingTasks: Map<string, {
    task: TTask;
    resolve: (result: TResult) => void;
    reject: (error: Error) => void;
    timeout?: ReturnType<typeof setTimeout>;
  }>;
  protected isInitialized = false;
  protected isShuttingDown = false;

  constructor(config: WorkerPoolConfig) {
    this.config = config;
    this.workers = new Map();
    this.workerStates = new Map();
    this.taskQueue = [];
    this.pendingTasks = new Map();
  }

  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Create initial workers
    for (let i = 0; i < this.config.maxWorkers; i++) {
      await this.createWorker(`worker-${i}`);
    }

    this.isInitialized = true;
    await this.onInitialize();
  }

  /**
   * Shutdown the pool gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized || this.isShuttingDown) return;
    this.isShuttingDown = true;

    await this.onShutdown();

    // Terminate workers
    for (const id of this.workers.keys()) {
      await this.terminateWorker(id);
    }

    this.workers.clear();
    this.workerStates.clear();
    this.taskQueue = [];
    this.pendingTasks.clear();

    this.isInitialized = false;
    this.isShuttingDown = false;
  }

  /**
   * Enqueue a task for processing
   */
  async enqueueTask(task: TTask): Promise<TResult> {
    if (!this.isInitialized) throw new Error('Worker pool not initialized');

    return new Promise<TResult>((resolve, reject) => {
      this.pendingTasks.set(task.id, { task, resolve, reject });
      this.taskQueue.push(task);
      this.processQueue();
    });
  }

  /**
   * Process the task queue
   */
  protected async processQueue(): Promise<void> {
    if (!this.isInitialized || this.isShuttingDown) return;

    while (this.taskQueue.length > 0) {
      const workerId = this.findIdleWorker();
      if (!workerId) break;

      const task = this.taskQueue.shift()!;
      await this.assignTask(workerId, task);
    }
  }

  /**
   * Find an idle worker
   */
  protected findIdleWorker(): string | null {
    for (const [id, state] of this.workerStates.entries()) {
      if (state.status === 'idle') return id;
    }
    return null;
  }

  /**
   * Assign a task to a worker
   */
  protected async assignTask(workerId: string, task: TTask): Promise<void> {
    const state = this.workerStates.get(workerId);
    if (!state) throw new Error(`Worker ${workerId} not found`);

    state.status = 'busy';
    state.currentTask = task.id;

    const start = performance.now();

    try {
      const result = await this.onExecuteTask(workerId, task);
      const duration = performance.now() - start;
      this.onTaskSuccess(workerId, task, { taskId: task.id, success: true, data: result as any, duration } as TResult);
    } catch (error: any) {
      const duration = performance.now() - start;
      this.onTaskFailure(workerId, task, {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      } as TResult);
    } finally {
      state.status = 'idle';
      state.currentTask = undefined;
      await this.processQueue();
    }
  }

  protected onTaskSuccess(workerId: string, task: TTask, result: TResult) {
    const state = this.workerStates.get(workerId)!;
    state.tasksCompleted += 1;

    const pending = this.pendingTasks.get(task.id);
    if (pending) {
      pending.resolve(result);
      this.pendingTasks.delete(task.id);
    }
  }

  protected onTaskFailure(workerId: string, task: TTask, result: TResult) {
    const state = this.workerStates.get(workerId)!;
    state.tasksFailed += 1;
    state.errorCount += 1;

    const pending = this.pendingTasks.get(task.id);
    if (pending) {
      const message =
        (result as Partial<WorkerTaskResult>).error ?? 'Task failed';
      pending.reject(new Error(message));
      this.pendingTasks.delete(task.id);
    }
  }

  /** Hooks to be implemented by concrete subclasses */
  protected abstract createWorker(id: string): Promise<void>;
  protected abstract terminateWorker(id: string): Promise<void>;
  protected abstract onExecuteTask(workerId: string, task: TTask): Promise<TResult>;
  protected async onInitialize(): Promise<void> {}
  protected async onShutdown(): Promise<void> {}
}
