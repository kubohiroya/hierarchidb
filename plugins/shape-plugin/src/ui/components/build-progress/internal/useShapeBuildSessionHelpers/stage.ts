import type { TaskStage } from '@hierarchidb/build-api';
import { resolveMostAdvancedStageId } from '~/ui/components/build-progress/stagePriorityConstants';

export type StageLikeTask = {
  stage: TaskStage;
};

export type StageLikeRunningTask = StageLikeTask & {
  status?: string;
};

export const resolveMostAdvancedStageIdByStatus = (params: {
  stages: Array<{ id: string }>;
  tasks: StageLikeRunningTask[];
  statuses: Set<string>;
}): string | null => {
  const stageIds = new Set<string>();
  params.tasks.forEach((task) => {
    if (!task.status || !params.statuses.has(task.status)) return;
    stageIds.add(task.stage);
  });
  return resolveMostAdvancedRunningStage(stageIds, params.stages);
};

export const resolveMostAdvancedRunningStageId = (params: {
  stages: Array<{ id: string }>;
  tasks: StageLikeRunningTask[];
}): string | null =>
  resolveMostAdvancedStageIdByStatus({
    stages: params.stages,
    tasks: params.tasks,
    statuses: new Set(['running']),
  });

export const resolveMostAdvancedInFlightStageId = (params: {
  stages: Array<{ id: string }>;
  tasks: StageLikeRunningTask[];
}): string | null =>
  resolveMostAdvancedStageIdByStatus({
    stages: params.stages,
    tasks: params.tasks,
    statuses: new Set(['running', 'queued']),
  });

const resolveMostAdvancedRunningStage = (
  stageIds: Set<string>,
  stages: Array<{ id: string }>
): string | null => {
  return resolveMostAdvancedStageId(stageIds, stages);
};
