import { AbstractBatchSession } from '@hierarchidb/batch-runtime-services';
import type { BaseBatchConfig, BatchProgressEvent, BatchProgressPayload } from '@hierarchidb/common-api';
import type { NodeId, ProgressEvent, ProgressEvent as LocationProgress } from '@hierarchidb/common-types';
import type { LocationSessionController } from './LocationSessionController.js';

export interface LocationBatchConfig extends BaseBatchConfig {
  concurrency?: number;
}

export class LocationBatchSession extends AbstractBatchSession<LocationBatchConfig, any, void> {
  constructor(sessionId: string, nodeId: NodeId, config: LocationBatchConfig, private controller: LocationSessionController, private sink?: (e: ProgressEvent) => void) {
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
        currentStage: ev.stage,
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

  protected async onComplete(): Promise<void> {}

  protected onBatchProgressEvent(event: BatchProgressEvent): void {
    const payload: BatchProgressPayload = event.payload ?? {};
    const total = payload.total ?? 0;
    const completed = payload.completed ?? 0;
    const failed = payload.failed ?? 0;
    const percentage = total > 0 ? (completed / total) * 100 : 0;

    const legacyEvent: ProgressEvent = {
      sessionId: event.sessionId,
      stage: event.stage,
      total,
      completed,
      failed,
      percentage,
      currentTask: payload.currentTask ?? '',
    };
    this.sink?.(legacyEvent);
  }
}
