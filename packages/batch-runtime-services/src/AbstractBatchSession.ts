/**
 * Abstract Base Class for Batch Processing Sessions
 * Provides _obsolate_common functionality for all batch processing plugin-loader
 */

import type { NodeId } from '@hierarchidb/common-types';
import { BaseBatchConfig, BatchProgress, BatchProgressEvent,
  BatchProgressPayload, BatchSessionState, ProgressPhase, ResourceUsage } from '@hierarchidb/common-api';

/**
 * Abstract base class for batch processing sessions
 */
export abstract class AbstractBatchSession<
  TConfig extends BaseBatchConfig = BaseBatchConfig,
  _TTask = any,
  _TResult = any
> {
  protected sessionId: string;
  protected nodeId: NodeId;
  protected config: TConfig;
  protected state: BatchSessionState;
  protected progress: BatchProgress;
  protected resourceUsage?: ResourceUsage;
  protected abortController?: AbortController;
  private progressListeners = new Set<(event: BatchProgressEvent) => void>();

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
   * Start the session
   */
  async start(): Promise<void> {
    if (this.state.status !== 'idle' && this.state.status !== 'paused') {
      throw new Error(`Cannot start session in state: ${this.state.status}`);
    }

    this.abortController = new AbortController();
    this.state.status = 'running';
    this.state.startedAt = this.state.startedAt ?? Date.now();
    this.state.lastActivity = Date.now();

    await this.onStart();
  }

  /**
   * Pause the session
   */
  async pause(): Promise<void> {
    if (this.state.status !== 'running') {
      throw new Error(`Cannot pause session in state: ${this.state.status}`);
    }

    this.state.status = 'paused';
    this.state.lastActivity = Date.now();

    await this.onPause();
  }

  /**
   * Resume the session
   */
  async resume(): Promise<void> {
    if (this.state.status !== 'paused') {
      throw new Error(`Cannot resume session in state: ${this.state.status}`);
    }

    this.state.status = 'running';
    this.state.lastActivity = Date.now();

    await this.onResume();
  }

  /**
   * Cancel the session
   */
  async cancel(): Promise<void> {
    if (this.state.status === 'completed' || this.state.status === 'failed' || this.state.status === 'cancelled') {
      return;
    }

    this.state.status = 'cancelled';
    this.state.lastActivity = Date.now();

    try {
      await this.onCancel();
    } finally {
      this.abortController?.abort();
    }
  }

  /**
   * Get current state
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
   * Update progress
   */
  protected updateProgress(partial: Partial<BatchProgress>, stage?: string): void {
    const prev = this.progress;
    this.progress = { ...prev, ...partial } as BatchProgress;
    this.emitProgress({
      stage: stage ?? prev.currentStage ?? 'unknown',
      phase: this.state.status === 'running' ? 'running' : (this.state.status as ProgressPhase),
      payload: this.toProgressPayload(),
    });
  }

  protected toProgressPayload(): BatchProgressPayload {
    const { total, completed, failed, skipped, currentTask, estimatedTimeRemaining } = this.progress;
    return { total, completed, failed, skipped, currentTask, estimatedTimeRemaining };
  }

  protected emitProgress(e: Partial<BatchProgressEvent>): void {
    const full: BatchProgressEvent = {
      sessionId: this.state.sessionId,
      nodeId: this.state.nodeId,
      stage: e.stage ?? 'unknown',
      phase: e.phase ?? 'running',
      timestamp: Date.now(),
      payload: e.payload,
      message: e.message,
      error: e.error,
    };
    for (const fn of this.progressListeners) fn(full);
  }

  addBatchProgressListener(fn: (event: BatchProgressEvent) => void): () => void {
    this.progressListeners.add(fn);
    return () => this.progressListeners.delete(fn);
  }

  /** Overridables */
  protected async onInitialize(): Promise<void> {}
  protected async onStart(): Promise<void> {}
  protected async onPause(): Promise<void> {}
  protected async onResume(): Promise<void> {}
  protected async onCancel(): Promise<void> {}
}
