import {
  AbstractBatchSession,
  type BaseBatchConfig,
  type StandardProgressEvent,
} from '@hierarchidb/runtime-shared-batch-processor';
import type { NodeId, ProgressEvent } from '@hierarchidb/common-type';
import type { ProgressInfo } from '../types.js';
import { SessionController } from './SessionController.js';

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

  protected onProgressUpdate(): void {
    const p = this.getProgress();
    const event: StandardProgressEvent = {
      sessionId: this.sessionId,
      stage: p.currentStage || 'processing',
      total: p.total,
      completed: p.completed,
      failed: p.failed,
      percentage: Math.round(p.percentage),
      currentTask: p.currentTask || '',
    };
    this.onStandardProgressUpdate(event);
  }

  protected onStandardProgressUpdate(event: StandardProgressEvent): void {
    // Convert to legacy ProgressEvent for compatibility
    const legacyEvent: ProgressEvent = {
      sessionId: event.sessionId,
      stage: event.stage,
      total: event.total,
      completed: event.completed,
      failed: event.failed,
      percentage: event.percentage,
      currentTask: event.currentTask || '',
    };
    this.sink?.(legacyEvent);
  }
}
