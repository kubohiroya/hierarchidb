import type { NodeId } from '@hierarchidb/core-types';

/**
 * 共通 Task 定義（最小）。
 *
 * shape/location/route の各 plugin は、これを拡張した task 型を使う。
 */
export interface StageTaskBase {
  taskId: string;
  nodeId?: NodeId;
  status?: string;
  stage?: string;
}

export type ResolveStageTasksResult<TTask> = {
  runnableTasks: TTask[];
  completedCount: number;
  failedCount: number;
  total: number;
};

/**
 * 永続化層（DB/API）の抽象。
 *
 * 共通 orchestrator はこの port のみを介してタスク状態を読み書きする。
 */
export interface TaskRegistryPort<TStage extends string, TTask extends StageTaskBase, TInput> {
  registerTasks(
    stage: TStage,
    tasks: TTask[],
    existingTaskIds: Set<string> | undefined,
    inputsByTaskId: Map<string, TInput>
  ): Promise<void>;

  resolveStageTasks(stage: TStage, tasks: TTask[]): Promise<ResolveStageTasksResult<TTask>>;

  loadStageInputs?<T extends TInput>(stage: TStage): Promise<Map<string, T>>;
}
