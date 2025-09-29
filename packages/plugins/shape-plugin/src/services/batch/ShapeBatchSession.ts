import {
  AbstractBatchSession,
  type BaseBatchConfig,
  type BatchProgressEvent,
} from '@hierarchidb/runtime-shared-batch-processor';
import type { NodeId, ProgressEvent } from '@hierarchidb/common-type';
import type { ProgressInfo } from '../types.js';
import type { ProcessingStage } from '../../shared/types.js';
import type { SessionController } from './SessionController.js';

export interface ShapeBatchConfig extends BaseBatchConfig {
  concurrency?: number;
}

export interface ShapeBatchTask {
  taskId: string;
  stage: string;
}

export class ShapeBatchSession extends AbstractBatchSession<ShapeBatchConfig, ShapeBatchTask, void> {
  constructor(sessionId: string, nodeId: NodeId, config: ShapeBatchConfig, private controller: SessionController, private sink?: (e: ProgressEvent) => void) {
    super(sessionId, nodeId, config);
  }

  protected async onInitialize(): Promise<void> {
  }

  protected async onStart(): Promise<void> {
  }

  protected async processBatch(): Promise<void> {
    // Bridge controller progress into shared session progress
    this.controller.setProgressCallback((p: ProgressInfo) => {
      this.updateProgress({
        total: p.total,
        completed: p.completed,
        failed: p.failed,
        currentStage: p.currentStage ?? 'processing',
        currentTask: p.currentTask,
      });
    });
    await this.controller.initialize();
    await this.controller.start();
  }

  protected async onPause(): Promise<void> {
  }

  protected async onResume(): Promise<void> {
  }

  protected async onCancel(): Promise<void> {
  }

  protected async onComplete(): Promise<void> {
  }

  protected onBatchProgressEvent(event: BatchProgressEvent): void {
    const payload = event.payload ?? {};
    const total = payload.total ?? 0;
    const completed = payload.completed ?? 0;
    const failed = payload.failed ?? 0;
    const progress = total > 0 ? (completed / total) * 100 : 0;

    const legacyEvent: ProgressEvent = {
      sessionId: event.sessionId,
      stage: event.stage,
      total,
      completed,
      failed,
      percentage: progress,
      currentTask: payload.currentTask ?? '',
    };

    this.sink?.(legacyEvent);
  }

  pauseStage(stage: ProcessingStage): void {
    this.controller.pauseStage(stage);
  }

  resumeStage(stage: ProcessingStage): void {
    this.controller.resumeStage(stage);
  }

  resumeAllStages(): void {
    this.controller.resumeAllStages();
  }
}
