import type { ProcessingStage } from '../../../../common/types/index.js';

export type PauseHandler = (stage: ProcessingStage, message: string) => void | Promise<void>;

export class StageControl {
  private readonly pausedStages = new Set<ProcessingStage>();
  private readonly stageWaiters = new Map<ProcessingStage, Array<() => void>>();
  private readonly stageAbortControllers = new Map<ProcessingStage, AbortController>();
  private readonly pauseRequestedStages = new Set<ProcessingStage>();

  private isGloballyPaused = false;
  private pauseHandler?: PauseHandler;

  setPauseHandler(handler?: PauseHandler): void {
    this.pauseHandler = handler;
  }

  setGloballyPaused(paused: boolean): void {
    this.isGloballyPaused = paused;
  }

  getGloballyPaused(): boolean {
    return this.isGloballyPaused;
  }

  pauseStage(stage: ProcessingStage): void {
    this.isGloballyPaused = true;
    this.pausedStages.add(stage);
  }

  resumeStage(stage: ProcessingStage): void {
    this.pausedStages.delete(stage);

    const waiters = this.stageWaiters.get(stage);
    if (waiters) {
      this.stageWaiters.delete(stage);
      for (const resolve of waiters) resolve();
    }

    if (this.pausedStages.size === 0) {
      this.isGloballyPaused = false;
    }
  }

  resumeAllStages(): void {
    for (const stage of Array.from(this.pausedStages)) {
      this.resumeStage(stage);
    }
    this.isGloballyPaused = false;
  }

  async waitForStageResume(stage: ProcessingStage): Promise<void> {
    if (!this.pausedStages.has(stage) && !this.isGloballyPaused) return;
    await new Promise<void>((resolve) => {
      const list = this.stageWaiters.get(stage) ?? [];
      list.push(resolve);
      this.stageWaiters.set(stage, list);
    });
  }

  getStageAbortSignal(stage: ProcessingStage): AbortSignal {
    let controller = this.stageAbortControllers.get(stage);
    if (!controller) {
      controller = new AbortController();
      this.stageAbortControllers.set(stage, controller);
    }
    return controller.signal;
  }

  async requestPauseOnce(stage: ProcessingStage, message: string): Promise<void> {
    if (this.pauseRequestedStages.has(stage)) return;
    this.pauseRequestedStages.add(stage);
    this.pauseStage(stage);
    await this.pauseHandler?.(stage, message);
  }
}

