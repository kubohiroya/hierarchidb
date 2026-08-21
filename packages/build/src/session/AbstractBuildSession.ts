import type { NodeId } from '@hierarchidb/core-types';
import type {
  BaseBuildConfig,
  BuildProgress,
  BuildSessionState,
  ResourceUsage,
  StageKey,
} from '@hierarchidb/build-api';

/**
 * Shared lifecycle base for build-oriented workflows.
 */
export abstract class AbstractBuildSession<TConfig extends BaseBuildConfig = BaseBuildConfig> {
  protected readonly config: TConfig;
  protected readonly nodeId: NodeId;

  protected resourceUsage?: ResourceUsage;
  protected abortController: AbortController | null = null;

  private readonly sessionUpdateListeners = new Set<() => void>();
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
      skipped: 0,
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
    this.emitSessionUpdate();

    try {
      await this.onStart();
      await this.processBatch(controller.signal);
      this.state.status = 'completed';
      this.state.completedAt = Date.now();
      this.state.lastActivity = this.state.completedAt;
      this.emitSessionUpdate();
      await this.onComplete();
    } catch (error) {
      if (controller.signal.aborted) {
        this.state.status = 'failed';
        this.state.error = 'Session aborted';
        this.state.completedAt = Date.now();
        this.state.lastActivity = this.state.completedAt;
        this.emitSessionUpdate();
        throw abortError('Session aborted');
      }
      this.state.status = 'failed';
      this.state.error = error instanceof Error ? error.message : String(error);
      this.state.completedAt = Date.now();
      this.state.lastActivity = this.state.completedAt;
      this.emitSessionUpdate();
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
    this.emitSessionUpdate();
  }

  async resume(): Promise<void> {
    if (this.state.status !== 'paused') {
      throw new Error(`Cannot resume session from state ${this.state.status}`);
    }
    this.state.status = 'running';
    this.state.lastActivity = Date.now();
    await this.onResume();
    this.emitSessionUpdate();
  }

  addSessionUpdateListener(listener: () => void): () => void {
    this.sessionUpdateListeners.add(listener);
    return () => {
      this.sessionUpdateListeners.delete(listener);
    };
  }

  protected updateProgress(partial: Partial<BuildProgress>, stage?: StageKey): void {
    const merged: BuildProgress = {
      ...this.progress,
      ...partial,
    };
    const total = requireTaskCount(merged.total, 'total');
    const completed = requireTaskCount(merged.completed, 'completed');
    const failed = requireTaskCount(merged.failed, 'failed');
    const skipped = requireTaskCount(merged.skipped, 'skipped');
    const terminal = completed + failed + skipped;
    if (terminal > total) {
      throw new Error(
        `[AbstractBuildSession] terminal task count must not exceed total: terminal=${terminal}, total=${total}`
      );
    }
    merged.total = total;
    merged.completed = completed;
    merged.failed = failed;
    merged.skipped = skipped;
    merged.percentage = total === 0 ? 0 : (terminal / total) * 100;
    if (stage) {
      merged.stage = stage;
    }
    this.progress = merged;
    this.state.lastActivity = Date.now();
    this.emitSessionUpdate();
  }

  protected emitSessionUpdate(): void {
    for (const listener of this.sessionUpdateListeners) {
      listener();
    }
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
}

function abortError(message: string): Error {
  if (typeof DOMException === 'function') {
    return new DOMException(message, 'AbortError');
  }
  const error = new Error(message);
  (error as Error & { name: string }).name = 'AbortError';
  return error;
}

function requireTaskCount(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(
      `[AbstractBuildSession] ${label} must be a non-negative integer, received ${String(value)}`
    );
  }
  return value as number;
}
