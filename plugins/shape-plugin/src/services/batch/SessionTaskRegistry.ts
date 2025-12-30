import type { NodeId } from '@hierarchidb/common-types';
import type {
  ShapeBatchTaskInputData,
  ShapeBatchTaskOutputData,
  ShapeBatchTaskRecord,
  ShapeMutationAPI,
  ShapeQueryAPI,
} from '@hierarchidb/plugin-service-api';
import type { DownloadTask, ProcessingStage } from '../../common/types/index.js';

export class SessionTaskRegistry {
  constructor(
    private readonly nodeId: NodeId,
    private readonly queryApi: ShapeQueryAPI,
    private readonly mutationApi: ShapeMutationAPI,
  ) {}

  listStageRecords(stage: ProcessingStage): Promise<ShapeBatchTaskRecord[]> {
    return this.queryApi.listBatchTaskRecordsByStage(this.nodeId, stage);
  }

  async registerTasks<
    TInput extends ShapeBatchTaskInputData = ShapeBatchTaskInputData,
    TOutput extends ShapeBatchTaskOutputData = ShapeBatchTaskOutputData,
  >(
    stage: ProcessingStage,
    tasks: Array<{ taskId: string; index?: number }>,
    existingTaskIds?: Set<string>,
    inputsByTaskId?: Map<string, TInput>,
    outputsByTaskId?: Map<string, TOutput>,
  ): Promise<void> {
    const now = Date.now();
    if (stage === 'vectortile') {
      const existing = await this.queryApi.listBatchTaskRecordsByStage(this.nodeId, 'vectortile');
      const existingById = new Map(existing.map((task) => [task.taskId, task]));
      const newTasks: ShapeBatchTaskRecord[] = [];
      for (const [index, task] of tasks.entries()) {
        const existingTask = existingById.get(task.taskId);
        const inputData = inputsByTaskId?.get(task.taskId);
        const outputData = outputsByTaskId?.get(task.taskId);
        if (!existingTask) {
          newTasks.push({
            taskId: task.taskId,
            nodeId: this.nodeId,
            taskType: stage,
            status: 'waiting',
            index: task.index ?? index,
            progress: 0,
            inputData,
            outputData,
            createdAt: now,
            updatedAt: now,
          });
          continue;
        }
        if (existingTask.status !== 'regression') {
          continue;
        }
        const currentRetry = this.getRetryValue(existingTask);
        const nextRetry = currentRetry + 1;
        const nextOutputData = {
          ...(existingTask.outputData ?? {}),
          ...(outputData ?? {}),
          retry: nextRetry,
        } as ShapeBatchTaskOutputData;
        await this.mutationApi.updateBatchTask(task.taskId, { outputData: nextOutputData });
      }
      if (newTasks.length > 0) {
        const chunkSize = 50;
        for (let offset = 0; offset < newTasks.length; offset += chunkSize) {
          await this.mutationApi.upsertBatchTasks(newTasks.slice(offset, offset + chunkSize));
        }
      }
      return;
    }
    const existingIds = existingTaskIds ?? new Set(
      (await this.queryApi.listBatchTaskRecordsByStage(this.nodeId, stage)).map((task) => task.taskId),
    );
    const newTasks = tasks
      .filter((task) => !existingIds.has(task.taskId))
      .map((task, index) => ({
        taskId: task.taskId,
        nodeId: this.nodeId,
        taskType: stage,
        status: 'waiting' as const,
        index: task.index ?? index,
        progress: 0,
        inputData: inputsByTaskId?.get(task.taskId),
        outputData: outputsByTaskId?.get(task.taskId),
        createdAt: now,
        updatedAt: now,
      }));
    if (newTasks.length > 0) {
      const chunkSize = 50;
      for (let offset = 0; offset < newTasks.length; offset += chunkSize) {
        await this.mutationApi.upsertBatchTasks(newTasks.slice(offset, offset + chunkSize));
      }
    }
  }

  async loadStageInputs<TInput>(stage: ProcessingStage): Promise<Map<string, TInput>> {
    const rows = await this.queryApi.listBatchTaskRecordsByStage(this.nodeId, stage);
    const inputs = new Map<string, TInput>();
    rows.forEach((row) => {
      if (row.inputData) {
        inputs.set(row.taskId, row.inputData as TInput);
      }
    });
    return inputs;
  }

  async resolveStageTasks<T extends { taskId: string }>(
    stage: ProcessingStage,
    tasks: T[],
  ): Promise<{ runnableTasks: T[]; completedCount: number; failedCount: number; total: number }> {
    const existing = await this.queryApi.listBatchTaskRecordsByStage(this.nodeId, stage);
    const statusById = new Map(existing.map((task) => [task.taskId, task.status]));
    const runnableTasks = tasks.filter((task) => {
      const status = statusById.get(task.taskId);
      return status === 'waiting' || status === 'regression';
    });
    const completedCount = existing.filter((task) => task.status === 'completed').length;
    const failedCount = existing.filter((task) => task.status === 'failed').length;
    return { runnableTasks, completedCount, failedCount, total: tasks.length };
  }

  async markDownloadTasksCompletedWhenBuffersExist(tasks: DownloadTask[]): Promise<void> {
    if (tasks.length === 0) return;
    const existing = await this.queryApi.listBatchTaskRecordsByStage(this.nodeId, 'download');
    const statusById = new Map(existing.map((task) => [task.taskId, task.status]));
    for (const task of tasks) {
      const status = statusById.get(task.taskId);
      if (status !== 'waiting' && status !== 'regression') continue;
      const index = task.index ?? 0;
      const bufferId = `${this.nodeId}-download-${index}`;
      const raw = await this.queryApi.getRawBuffer(bufferId);
      if (!raw) continue;
      await this.mutationApi.updateBatchTask(task.taskId, {
        status: 'completed',
        progress: 100,
        completedAt: Date.now(),
        message: 'Skipped: already downloaded (buffer exists).',
        errorMessage: undefined,
      });
    }
  }

  getRetryValue(task: ShapeBatchTaskRecord): number {
    const output = task.outputData ?? {};
    const retry = (output as { retry?: number }).retry;
    return typeof retry === 'number' && Number.isFinite(retry) ? retry : 0;
  }

  async getVectorTileRegressionRetry(): Promise<number | null> {
    const tasks = await this.queryApi.listBatchTaskRecordsByStage(this.nodeId, 'vectortile');
    const regressions = tasks.filter((task) => task.status === 'regression');
    if (regressions.length === 0) return null;
    const retryable = regressions
      .map((task) => this.getRetryValue(task))
      .filter((retry) => retry < 2);
    if (retryable.length === 0) return null;
    return Math.max(...retryable);
  }

  async prepareExtract2Retry(retry: number): Promise<void> {
    const extract2Tasks = await this.queryApi.listBatchTaskRecordsByStage(this.nodeId, 'extract2');
    for (const task of extract2Tasks) {
      const outputData = { ...(task.outputData ?? {}), retry };
      await this.mutationApi.updateBatchTask(task.taskId, {
        status: 'waiting',
        progress: 0,
        startedAt: undefined,
        completedAt: undefined,
        errorMessage: undefined,
        outputData,
      });
    }
  }

  async resetVectorTileTasksForRetry(): Promise<void> {
    const vectorTasks = await this.queryApi.listBatchTaskRecordsByStage(this.nodeId, 'vectortile');
    for (const task of vectorTasks) {
      const needsReset = task.status === 'completed' || task.status === 'failed';
      if (!needsReset) {
        await this.mutationApi.updateBatchTask(task.taskId, {
          progress: 0,
          startedAt: undefined,
          completedAt: undefined,
          errorMessage: undefined,
        });
        continue;
      }
      await this.mutationApi.updateBatchTask(task.taskId, {
        status: 'waiting',
        progress: 0,
        startedAt: undefined,
        completedAt: undefined,
        errorMessage: undefined,
      });
    }
  }

  async assignDownloadTaskIndices(tasks: DownloadTask[]): Promise<Set<string>> {
    const existing = await this.queryApi.listBatchTaskRecordsByStage(this.nodeId, 'download');
    const existingIds = new Set(existing.map((task) => task.taskId));
    const existingIndexById = new Map(existing.map((task) => [task.taskId, task.index]));
    let nextIndex = existing.reduce((max, task) => Math.max(max, task.index ?? 0), -1) + 1;
    tasks.forEach((task) => {
      const existingIndex = existingIndexById.get(task.taskId);
      if (existingIndex != null) {
        task.index = existingIndex;
        return;
      }
      task.index = nextIndex;
      nextIndex += 1;
    });
    return existingIds;
  }
}
