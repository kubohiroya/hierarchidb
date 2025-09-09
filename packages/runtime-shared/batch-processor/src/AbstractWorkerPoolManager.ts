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
   * Shutdown the worker pool
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    // Cancel pending tasks
    for (const [_taskId, pending] of this.pendingTasks) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.reject(new Error('Worker pool shutting down'));
    }
    this.pendingTasks.clear();

    // Clear task queue
    this.taskQueue = [];

    // Terminate all workers
    for (const [workerId, _worker] of this.workers) {
      await this.terminateWorker(workerId);
    }

    this.workers.clear();
    this.workerStates.clear();
    this.isInitialized = false;

    await this.onShutdown();
  }

  /**
   * Process a task
   */
  async processTask(task: TTask): Promise<TResult> {
    if (!this.isInitialized) {
      throw new Error('Worker pool not initialized');
    }

    if (this.isShuttingDown) {
      throw new Error('Worker pool is shutting down');
    }

    return new Promise((resolve, reject) => {
      // Add to pending tasks
      this.pendingTasks.set(task.id, {
        task,
        resolve,
        reject,
      });

      // Add to queue
      this.enqueueTask(task);

      // Process queue
      this.processQueue();

      // Set timeout if specified
      if (task.timeout || this.config.workerOptions?.timeout) {
        const timeout = task.timeout || this.config.workerOptions?.timeout || 60000;
        const timeoutHandle = setTimeout(() => {
          const pending = this.pendingTasks.get(task.id);
          if (pending) {
            this.pendingTasks.delete(task.id);
            pending.reject(new Error(`Task ${task.id} timed out after ${timeout}ms`));
          }
        }, timeout);

        const pending = this.pendingTasks.get(task.id);
        if (pending) {
          pending.timeout = timeoutHandle;
        }
      }
    });
  }

  /**
   * Get worker pool statistics
   */
  getStatistics(): WorkerPoolStats {
    let idleWorkers = 0;
    let busyWorkers = 0;
    let errorWorkers = 0;
    let tasksCompleted = 0;
    let tasksFailed = 0;

    for (const state of this.workerStates.values()) {
      switch (state.status) {
        case 'idle':
          idleWorkers++;
          break;
        case 'busy':
          busyWorkers++;
          break;
        case 'error':
          errorWorkers++;
          break;
      }
      tasksCompleted += state.tasksCompleted;
      tasksFailed += state.tasksFailed;
    }

    return {
      totalWorkers: this.workers.size,
      idleWorkers,
      busyWorkers,
      errorWorkers,
      queueLength: this.taskQueue.length,
      tasksCompleted,
      tasksFailed,
      averageTaskDuration: 0, // To be calculated based on task history
    };
  }

  /**
   * Create a new worker
   */
  protected async createWorker(workerId: string): Promise<void> {
    const worker = await this.createWorkerInstance(workerId);

    // Set up message handler
    worker.onmessage = (event) => {
      this.handleWorkerMessage(workerId, event);
    };

    // Set up error handler
    worker.onerror = (error) => {
      this.handleWorkerError(workerId, error);
    };

    // Store worker and initial state
    this.workers.set(workerId, worker);
    this.workerStates.set(workerId, {
      id: workerId,
      status: 'idle',
      tasksCompleted: 0,
      tasksFailed: 0,
      lastActivity: Date.now(),
      errorCount: 0,
    });

    // Initialize worker
    await this.initializeWorker(workerId, worker);
  }

  /**
   * Terminate a worker
   */
  protected async terminateWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (worker) {
      await this.onWorkerTerminate(workerId);
      worker.terminate();
      this.workers.delete(workerId);
      this.workerStates.delete(workerId);
    }
  }

  /**
   * Enqueue a task
   */
  protected enqueueTask(task: TTask): void {
    // Priority queue insertion
    if (task.priority !== undefined) {
      const index = this.taskQueue.findIndex(t =>
        (t.priority || 0) < (task.priority || 0),
      );
      if (index === -1) {
        this.taskQueue.push(task);
      } else {
        this.taskQueue.splice(index, 0, task);
      }
    } else {
      this.taskQueue.push(task);
    }
  }

  /**
   * Process the task queue
   */
  protected processQueue(): void {
    // Find idle workers
    const idleWorkers = Array.from(this.workerStates.entries())
      .filter(([_, state]) => state.status === 'idle')
      .map(([id, _]) => id);

    // Assign tasks to idle workers
    while (this.taskQueue.length > 0 && idleWorkers.length > 0) {
      const task = this.taskQueue.shift();
      const workerId = idleWorkers.shift();

      if (task && workerId) {
        this.assignTaskToWorker(workerId, task);
      }
    }
  }

  /**
   * Assign a task to a worker
   */
  protected assignTaskToWorker(workerId: string, task: TTask): void {
    const worker = this.workers.get(workerId);
    const state = this.workerStates.get(workerId);

    if (!worker || !state) {
      // Re-queue task if worker not found
      this.enqueueTask(task);
      return;
    }

    // Update worker state
    state.status = 'busy';
    state.currentTask = task.id;
    state.lastActivity = Date.now();

    // Send task to worker
    this.sendTaskToWorker(worker, task);
  }

  /**
   * Handle worker message
   */
  protected handleWorkerMessage(workerId: string, event: MessageEvent): void {
    const result = event.data as TResult;
    const state = this.workerStates.get(workerId);

    if (state) {
      // Update worker state
      state.status = 'idle';
      state.currentTask = undefined;
      state.lastActivity = Date.now();

      if (result.success) {
        state.tasksCompleted++;
      } else {
        state.tasksFailed++;
      }
    }

    // Resolve pending task
    const pending = this.pendingTasks.get(result.taskId);
    if (pending) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      this.pendingTasks.delete(result.taskId);

      if (result.success) {
        pending.resolve(result);
      } else {
        pending.reject(new Error(result.error || 'Task failed'));
      }
    }

    // Process next task in queue
    this.processQueue();
  }

  /**
   * Handle worker error
   */
  protected handleWorkerError(workerId: string, error: ErrorEvent): void {
    const state = this.workerStates.get(workerId);

    if (state) {
      state.status = 'error';
      state.errorCount++;
      state.lastActivity = Date.now();

      // Fail current task if any
      if (state.currentTask) {
        const pending = this.pendingTasks.get(state.currentTask);
        if (pending) {
          if (pending.timeout) {
            clearTimeout(pending.timeout);
          }
          this.pendingTasks.delete(state.currentTask);
          pending.reject(new Error(`Worker error: ${error.message}`));
        }
      }

      // Restart worker if threshold not exceeded
      const restartThreshold = this.config.workerOptions?.restartThreshold || 5;
      if (state.errorCount <= restartThreshold) {
        this.restartWorker(workerId);
      } else {
        console.error(`Worker ${workerId} exceeded error threshold, not restarting`);
      }
    }
  }

  /**
   * Restart a worker
   */
  protected async restartWorker(workerId: string): Promise<void> {
    await this.terminateWorker(workerId);
    await this.createWorker(workerId);
    this.processQueue();
  }

  // Abstract methods to be implemented by subclasses

  /**
   * Create a worker instance
   */
  protected abstract createWorkerInstance(workerId: string): Promise<Worker>;

  /**
   * Initialize a worker
   */
  protected abstract initializeWorker(workerId: string, worker: Worker): Promise<void>;

  /**
   * Send a task to a worker
   */
  protected abstract sendTaskToWorker(worker: Worker, task: TTask): void;

  /**
   * Called when pool is initialized
   */
  protected abstract onInitialize(): Promise<void>;

  /**
   * Called when pool is shutting down
   */
  protected abstract onShutdown(): Promise<void>;

  /**
   * Called before terminating a worker
   */
  protected abstract onWorkerTerminate(workerId: string): Promise<void>;
}