/**
 * Abstract Base Class for Batch Processing Sessions
 * Provides common functionality for all batch processing plugins
 */

import type { NodeId } from '@hierarchidb/common-type';
import type { IBatchControlCommands, StandardProgressEvent } from './BatchControlAPI.js';

/**
 * Base configuration for all batch sessions
 */
export interface BaseBatchConfig {
  // Common settings
  corsProxyBaseURL?: string;
  maxRetries?: number;
  retryDelay?: number;

  // Worker settings
  workerTimeout?: number;
  maxMemoryPerWorker?: number;

  // Session settings
  enableProgressTracking?: boolean;
  enableResourceMonitoring?: boolean;
}

/**
 * Base batch session state
 */
export interface BatchSessionState {
  sessionId: string;
  nodeId: NodeId;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  startedAt?: number;
  completedAt?: number;
  lastActivity?: number;
  error?: string;
}

/**
 * Progress information for batch processing
 */
export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  skipped?: number;
  percentage: number;
  currentStage?: string;
  currentTask?: string;
  estimatedTimeRemaining?: number;
}

/**
 * Resource usage tracking
 */
export interface ResourceUsage {
  memoryUsed: number;
  memoryPeak: number;
  cpuPercent: number;
  storageUsed: number;
  networkBytesReceived?: number;
  networkBytesSent?: number;
}

/**
 * Abstract base class for batch processing sessions
 */
export abstract class AbstractBatchSession<
  TConfig extends BaseBatchConfig = BaseBatchConfig,
  _TTask = any,
  _TResult = any
> implements IBatchControlCommands {
  protected sessionId: string;
  protected nodeId: NodeId;
  protected config: TConfig;
  protected state: BatchSessionState;
  protected progress: BatchProgress;
  protected resourceUsage?: ResourceUsage;
  protected abortController?: AbortController;
  private standardProgressListeners = new Set<(event: StandardProgressEvent) => void>();

  constructor(sessionId: string, nodeId: NodeId, config: TConfig) {
    this.sessionId = sessionId;
    this.nodeId = nodeId;
    this.config = config;

    this.state = {
      sessionId,
      nodeId,
      status: 'idle',
    };

    this.progress = {
      total: 0,
      completed: 0,
      failed: 0,
      percentage: 0,
    };
  }

  /**
   * Initialize the session
   */
  async initialize(): Promise<void> {
    this.state.status = 'idle';
    this.state.startedAt = undefined;
    this.state.completedAt = undefined;
    this.state.error = undefined;

    await this.onInitialize();
  }

  /**
   * Start the batch processing
   */
  async start(): Promise<void> {
    if (this.state.status !== 'idle' && this.state.status !== 'paused') {
      throw new Error(`Cannot start session in ${this.state.status} state`);
    }

    this.state.status = 'running';
    this.state.startedAt = Date.now();
    this.state.lastActivity = Date.now();
    this.abortController = new AbortController();

    try {
      await this.onStart();
      await this.processBatch();

      if (this.state.status === 'running') {
        this.state.status = 'completed';
        this.state.completedAt = Date.now();
      }
    } catch (error) {
      if (this.state.status === 'running') {
        this.state.status = 'failed';
        this.state.error = error instanceof Error ? error.message : String(error);
        this.state.completedAt = Date.now();
      }
      throw error;
    } finally {
      await this.onComplete();
    }
  }

  /**
   * Pause the batch processing
   */
  async pause(): Promise<void> {
    if (this.state.status !== 'running') {
      throw new Error(`Cannot pause session in ${this.state.status} state`);
    }

    this.state.status = 'paused';
    this.state.lastActivity = Date.now();
    this.abortController?.abort();

    await this.onPause();
  }

  /**
   * Resume the batch processing
   */
  async resume(): Promise<void> {
    if (this.state.status !== 'paused') {
      throw new Error(`Cannot resume session in ${this.state.status} state`);
    }

    this.state.status = 'running';
    this.state.lastActivity = Date.now();
    this.abortController = new AbortController();

    await this.onResume();
    await this.processBatch();
  }

  /**
   * Cancel the batch processing
   */
  async cancel(): Promise<void> {
    if (this.state.status === 'completed' || this.state.status === 'cancelled') {
      return;
    }

    this.state.status = 'cancelled';
    this.state.completedAt = Date.now();
    this.abortController?.abort();

    await this.onCancel();
  }

  /**
   * Get current session state
   */
  getState(): BatchSessionState {
    return { ...this.state };
  }

  /**
   * Get current progress
   */
  getProgress(): BatchProgress {
    return { ...this.progress };
  }

  /**
   * Get resource usage
   */
  getResourceUsage(): ResourceUsage | undefined {
    return this.resourceUsage ? { ...this.resourceUsage } : undefined;
  }

  /**
   * Update progress
   */
  protected updateProgress(update: Partial<BatchProgress>): void {
    this.progress = { ...this.progress, ...update };

    // Calculate percentage
    if (this.progress.total > 0) {
      this.progress.percentage =
        (this.progress.completed / this.progress.total) * 100;
    }

    // Update last activity
    this.state.lastActivity = Date.now();

    // Notify progress listeners
    this.onProgressUpdate(this.progress);
  }

  /**
   * Update resource usage
   */
  protected updateResourceUsage(usage: Partial<ResourceUsage>): void {
    this.resourceUsage = {
      memoryUsed: 0,
      memoryPeak: 0,
      cpuPercent: 0,
      storageUsed: 0,
      ...this.resourceUsage,
      ...usage,
    };

    // Track peak memory
    if (usage.memoryUsed && usage.memoryUsed > (this.resourceUsage.memoryPeak || 0)) {
      this.resourceUsage.memoryPeak = usage.memoryUsed;
    }
  }

  /**
   * Check if abort was requested
   */
  protected isAborted(): boolean {
    return this.abortController?.signal.aborted || false;
  }

  /**
   * Wait for a specified duration or until abort
   */
  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms);

      if (this.abortController) {
        this.abortController.signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('Operation aborted'));
        });
      }
    });
  }

  // Abstract methods to be implemented by subclasses

  /**
   * Called during initialization
   */
  protected abstract onInitialize(): Promise<void>;

  /**
   * Called when starting the batch processing
   */
  protected abstract onStart(): Promise<void>;

  /**
   * Main batch processing logic
   */
  protected abstract processBatch(): Promise<void>;

  /**
   * Called when pausing
   */
  protected abstract onPause(): Promise<void>;

  /**
   * Called when resuming
   */
  protected abstract onResume(): Promise<void>;

  /**
   * Called when cancelling
   */
  protected abstract onCancel(): Promise<void>;

  /**
   * Called when processing completes (success or failure)
   */
  protected abstract onComplete(): Promise<void>;

  /**
   * Called when progress is updated
   */
  protected onProgressUpdate(progress: BatchProgress): void {
    // Default implementation: emit standardized progress event
    const event: StandardProgressEvent = {
      sessionId: this.sessionId,
      stage: progress.currentStage || 'processing',
      total: progress.total,
      completed: progress.completed,
      failed: progress.failed,
      percentage: progress.percentage,
      currentTask: progress.currentTask,
      estimatedTimeRemaining: progress.estimatedTimeRemaining,
    };

    this.emitStandardProgressEvent(event);
  }

  /**
   * Called when standardized progress event is emitted
   * Can be overridden by subclasses for custom handling
   */
  protected onStandardProgressUpdate(_event: StandardProgressEvent): void {
    // Default implementation: no-op
    // Subclasses should override this to emit progress to their specific systems
  }

  /**
   * Add a listener for standardized progress events emitted by this session.
   * Returns an unsubscribe function for cleanup.
   */
  addStandardProgressListener(listener: (event: StandardProgressEvent) => void): () => void {
    this.standardProgressListeners.add(listener);
    return () => {
      this.standardProgressListeners.delete(listener);
    };
  }

  private emitStandardProgressEvent(event: StandardProgressEvent): void {
    try {
      this.onStandardProgressUpdate(event);
    } catch (error) {
      console.error('Standard progress handler threw an error:', error);
    }
    for (const listener of this.standardProgressListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Progress listener threw an error:', error);
      }
    }
  }
}
