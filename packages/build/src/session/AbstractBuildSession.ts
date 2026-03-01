import type { NodeId } from '@hierarchidb/core-types';
import type {
  BaseBuildConfig,
  BuildProgress,
  BuildProgressEvent,
  BuildProgressPayload,
  StageKey,
  BuildSessionState,
  ProgressPhase,
  ResourceUsage,
} from '@hierarchidb/build-api';

/**
 * Shared lifecycle base for build-oriented workflows.
 */
export abstract class AbstractBuildSession<TConfig extends BaseBuildConfig = BaseBuildConfig> {
  protected readonly config: TConfig;
  protected readonly nodeId: NodeId;

  protected resourceUsage?: ResourceUsage;
  protected abortController: AbortController | null = null;

  private readonly progressListeners = new Set<(event: BuildProgressEvent) => void>();
  private readonly state: BuildSessionState;
  private progress: BuildProgress;

  constructor(nodeId: NodeId, config: TConfig) {
    this.nodeId = nodeId;
    this.config = config;

    this.state = {
      nodeId,
      status: 'idle',
    };

    this.progress = {
      total: 0,
      completed: 0,
      failed: 0,
      stage: 'source',
      percentage: 0,
    };
  }

  getState(): BuildSessionState {
    return { ...this.state };
  }

  getProgress(): BuildProgress {
    return { ...this.progress };
  }

  protected getAbortSignal(): AbortSignal {
    if (!this.abortController) {
      this.abortController = new AbortController();
    }
    return this.abortController.signal;
  }

  async initialize(): Promise<void> {
    this.state.status = 'idle';
    this.state.startedAt = undefined;
    this.state.completedAt = undefined;
    this.state.error = undefined;
    this.state.lastActivity = Date.now();
    await this.onInitialize();
  }

  async start(): Promise<void> {
    if (this.state.status !== 'idle' && this.state.status !== 'paused') {
      throw new Error(`Cannot start session from state ${this.state.status}`);
    }
    const controller = this.ensureAbortController();
    if (controller.signal.aborted) {
      throw abortError('Session aborted before start');
    }

    this.state.status = 'running';
    this.state.startedAt = this.state.startedAt ?? Date.now();
    this.state.lastActivity = Date.now();

    try {
      await this.onStart();
      await this.processBatch(controller.signal);
      this.state.status = 'completed';
      this.state.completedAt = Date.now();
      this.state.lastActivity = this.state.completedAt;
      this.emitProgress({
        phase: 'completed',
        stage: this.progress.stage,
        payload: this.toProgressPayload(),
      });
      await this.onComplete();
    } catch (error) {
      if (controller.signal.aborted) {
        this.state.status = 'failed';
        this.state.error = 'Session aborted';
        this.emitProgress({
          phase: 'failed',
          stage: this.progress.stage,
          payload: this.toProgressPayload(),
        });
        throw abortError('Session aborted');
      }
      this.state.status = 'failed';
      this.state.error = error instanceof Error ? error.message : String(error);
      this.state.completedAt = Date.now();
      this.emitProgress({
        phase: 'failed',
        stage: this.progress.stage,
        error: formatProgressError(error),
        payload: this.toProgressPayload(),
      });
      throw error;
    }
  }

  async pause(): Promise<void> {
    if (this.state.status === 'paused') {
      return;
    }
    if (this.state.status !== 'running') {
      throw new Error(`Cannot pause session from state ${this.state.status}`);
    }
    this.state.status = 'paused';
    this.state.lastActivity = Date.now();
    await this.onPause();
    this.emitProgress({ phase: 'paused', stage: this.progress.stage, payload: this.toProgressPayload() });
  }

  async resume(): Promise<void> {
    if (this.state.status !== 'paused') {
      throw new Error(`Cannot resume session from state ${this.state.status}`);
    }
    this.state.status = 'running';
    this.state.lastActivity = Date.now();
    await this.onResume();
    this.emitProgress({ phase: 'running', stage: this.progress.stage, payload: this.toProgressPayload() });
  }

  addBuildProgressListener(listener: (event: BuildProgressEvent) => void): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  protected updateProgress(partial: Partial<BuildProgress>, stage?: StageKey): void {
    const merged: BuildProgress = {
      ...this.progress,
      ...partial,
    };
    const total = merged.total && merged.total > 0 ? merged.total : this.progress.total;
    merged.total = total;
    if (typeof merged.completed === 'number' && typeof total === 'number' && total > 0) {
      merged.percentage = Math.min(100, Math.round((merged.completed / total) * 100));
    }
    if (stage) {
      merged.stage = stage;
    }
    this.progress = merged;
    this.state.lastActivity = Date.now();
    this.emitProgress({
      stage: merged.stage ?? this.progress.stage,
      phase: this.state.status === 'running' ? 'running' : (this.state.status as ProgressPhase),
      payload: this.toProgressPayload(),
    });
  }

  protected toProgressPayload(): BuildProgressPayload {
    const { total, completed, failed, skipped, estimatedTimeRemaining } = this.progress;
    return { total, completed, failed, skipped, estimatedTimeRemaining };
  }

  protected emitProgress(event: Partial<BuildProgressEvent>): void {
    const errorPayload = event.error;
    const formattedError =
      errorPayload && typeof errorPayload === 'object' && 'code' in (errorPayload as object)
        ? formatProgressError(errorPayload)
        : event.error;
    const full: BuildProgressEvent = {
      nodeId: this.nodeId,
      stage: event.stage ?? this.progress.stage,
      phase: event.phase ?? (this.state.status as ProgressPhase),
      timestamp: Date.now(),
      payload: event.payload,
      message: event.message,
      error: formattedError,
    };
    for (const listener of this.progressListeners) {
      listener(full);
    }
    this.onBuildProgressEvent(full);
  }

  protected setResourceUsage(usage: ResourceUsage | undefined): void {
    this.resourceUsage = usage;
  }

  protected ensureAbortController(): AbortController {
    if (!this.abortController) {
      this.abortController = new AbortController();
    }
    return this.abortController;
  }

  protected abstract processBatch(signal: AbortSignal): Promise<void>;

  // Hooks for subclasses to extend behaviour.
  protected async onInitialize(): Promise<void> {}
  protected async onStart(): Promise<void> {}
  protected async onPause(): Promise<void> {}
  protected async onResume(): Promise<void> {}
  protected async onComplete(): Promise<void> {}
  protected onBuildProgressEvent(_event: BuildProgressEvent): void {}
}

function abortError(message: string): Error {
  if (typeof DOMException === 'function') {
    return new DOMException(message, 'AbortError');
  }
  const error = new Error(message);
  (error as Error & { name: string }).name = 'AbortError';
  return error;
}

function formatProgressError(error: unknown): { code?: string; detail?: unknown } | undefined {
  if (!error) return undefined;
  if (typeof error === 'object' && error !== null) {
    if ('code' in (error) || 'detail' in (error)) {
      const existing = error as { code?: string; detail?: unknown };
      return { code: existing.code, detail: existing.detail ?? error };
    }
    return { detail: error };
  }
  return { detail: error };
}
