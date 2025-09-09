import {
  AbstractBatchSession,
  type BaseBatchConfig,
  type StandardProgressEvent,
} from '@hierarchidb/runtime-shared-batch-processor';
import type { NodeId, ProgressEvent, ProgressEvent as LocationProgress } from '@hierarchidb/common-type';
import type { SessionController } from './SessionController';

export interface LocationBatchConfig extends BaseBatchConfig {
  concurrency?: number;
}

export class LocationBatchSession extends AbstractBatchSession<LocationBatchConfig, any, void> {
  constructor(sessionId: string, nodeId: NodeId, config: LocationBatchConfig, private controller: SessionController, private sink?: (e: ProgressEvent) => void) {
    super(sessionId, nodeId, config);
  }

  protected async onInitialize(): Promise<void> {
  }

  protected async onStart(): Promise<void> {
  }

  protected async processBatch(): Promise<void> {
    this.controller.setProgressCallback((ev: LocationProgress) => {
      this.updateProgress({
        total: ev.total,
        completed: ev.completed,
        failed: ev.failed,
        currentStage: ev.stage as any,
        currentTask: ev.currentTask,
      });
    });
    await this.controller.start();
  }

  protected async onPause(): Promise<void> {
    await this.controller.pause();
  }

  protected async onResume(): Promise<void> {
    await this.controller.resume();
  }

  protected async onCancel(): Promise<void> {
    await this.controller.cancel?.();
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
      sessionId: event.sessionId as any,
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
