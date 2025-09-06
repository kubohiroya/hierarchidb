import { AbstractBatchSession } from '@hierarchidb/runtime-shared/batch-processor/src/AbstractBatchSession';
import type { NodeId, ProgressEvent } from '@hierarchidb/common-type';

export interface ShapeBatchConfig { concurrency?: number }
export interface ShapeBatchTask { taskId: string; stage: string; }

export class ShapeBatchSession extends AbstractBatchSession<ShapeBatchConfig, ShapeBatchTask, void> {
  constructor(sessionId: string, nodeId: NodeId, config: ShapeBatchConfig, private tasks: ShapeBatchTask[], private sink?: (e: ProgressEvent) => void) { super(sessionId, nodeId, config); }
  protected async onInitialize(): Promise<void> {}
  protected async onStart(): Promise<void> {}
  protected async processBatch(): Promise<void> {
    const total = this.tasks.length; let completed = 0;
    for (const t of this.tasks) { if (this.isAborted()) break; completed++; this.updateProgress({ total, completed, currentStage: t.stage, currentTask: t.taskId }); await this.delay(1); }
  }
  protected async onPause(): Promise<void> {}
  protected async onResume(): Promise<void> {}
  protected async onCancel(): Promise<void> {}
  protected async onComplete(): Promise<void> {}
  protected onProgressUpdate(): void {
    const p = this.getProgress();
    this.sink?.({ sessionId: this['sessionId'] as any, stage: p.currentStage || 'processing', total: p.total, completed: p.completed, failed: p.failed, percentage: Math.round(p.percentage), currentTask: p.currentTask || '' });
  }
}

