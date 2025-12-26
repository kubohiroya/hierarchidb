import { AbstractBatchSession } from '@hierarchidb/batch-runtime-services';
import type { BaseBatchConfig, BatchProgressEvent } from '@hierarchidb/common-api';
import type { NodeId } from '@hierarchidb/common-types';
import type { ProgressInfo } from '../../common/types/index.js';
import type { ProcessingStage } from '../../common/types/index.js';
import type { SessionController } from './SessionController.js';

export interface ShapeBatchConfig extends BaseBatchConfig {
  concurrency?: number;
}

export interface ShapeBatchTask {
  taskId: string;
  stage: string;
}

export class ShapeBatchSession extends AbstractBatchSession<ShapeBatchConfig> {
  constructor(sessionId: string, nodeId: NodeId, config: ShapeBatchConfig, private controller: SessionController, private sink?: (e: ProgressInfo) => void) {
    super(sessionId, nodeId, config);
  }

  protected async onInitialize(): Promise<void> {
  }

  protected async onStart(): Promise<void> {
  }

  protected async processBatch(signal: AbortSignal): Promise<void> {
    if (signal.aborted) throw abortError();
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
    const payload = event.payload ?? { total: 0, completed: 0, failed: 0, currentTask: '' };
    const total = payload.total ?? 0;
    const completed = payload.completed ?? 0;
    const failed = payload.failed ?? 0;
    const skipped = payload.skipped ?? 0;
    const progress = total > 0 ? (completed / total) * 100 : 0;

    const legacyEvent: ProgressInfo = {
      total,
      completed,
      failed,
      skipped,
      percentage: progress,
      currentStage: (event.stage as ProcessingStage) ?? 'processing',
      currentTask: payload.currentTask,
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

function abortError(): Error {
  if (typeof DOMException === 'function') {
    return new DOMException('Shape batch aborted', 'AbortError');
  }
  const error = new Error('Shape batch aborted');
  (error as Error & { name: string }).name = 'AbortError';
  return error;
}
