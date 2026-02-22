import type { TaskStage } from '@hierarchidb/batch-api';

export type StageLikeTask = {
  type?: string;
  stage?: string;
};

export type StageLikeRunningTask = StageLikeTask & {
  status?: string;
};

export const normalizeStageKey = (task: StageLikeTask): TaskStage => (
  (task.stage ?? task.type ?? 'fetch') as TaskStage
);

export const resolveMostAdvancedStageIdByStatus = (params: {
  stages: Array<{ id: string }>;
  tasks: StageLikeRunningTask[];
  statuses: Set<string>;
}): string | null => {
  const stageIds = new Set<string>();
  params.tasks.forEach((task) => {
    if (!task.status || !params.statuses.has(task.status)) return;
    stageIds.add(normalizeStageKey(task));
  });
  return resolveMostAdvancedRunningStage(stageIds, params.stages);
};

export const resolveMostAdvancedRunningStageId = (params: {
  stages: Array<{ id: string }>;
  tasks: StageLikeRunningTask[];
}): string | null => (
  resolveMostAdvancedStageIdByStatus({
    stages: params.stages,
    tasks: params.tasks,
    statuses: new Set(['running']),
  })
);

export const resolveMostAdvancedInFlightStageId = (params: {
  stages: Array<{ id: string }>;
  tasks: StageLikeRunningTask[];
}): string | null => (
  resolveMostAdvancedStageIdByStatus({
    stages: params.stages,
    tasks: params.tasks,
    statuses: new Set(['running', 'queued']),
  })
);

const resolveMostAdvancedRunningStage = (
  stageIds: Set<string>,
  stages: Array<{ id: string }>,
): string | null => {
  const stageOrder = stages.map((stage) => stage.id);
  const preferredStageOrder = ['fetch', 'transform', 'vt'];
  for (let index = preferredStageOrder.length - 1; index >= 0; index -= 1) {
    const stage = preferredStageOrder[index];
    if (typeof stage !== 'string') {
      continue;
    }
    if (!stageIds.has(stage)) continue;
    return stage;
  }
  for (let index = stageOrder.length - 1; index >= 0; index -= 1) {
    const stage = stageOrder[index];
    if (typeof stage !== 'string') {
      continue;
    }
    if (!stageIds.has(stage)) continue;
    return stage;
  }
  return null;
};
