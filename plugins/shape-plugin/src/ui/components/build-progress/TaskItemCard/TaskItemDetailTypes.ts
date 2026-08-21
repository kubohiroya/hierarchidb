import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressTypes';
import type { TaskOutcomeSummary } from '~/ui/components/build-progress/TaskItem/TaskItemView';

export type TaskDetailPayload = {
  title: string;
  summary: TaskOutcomeSummary;
  task: ShapeBuildTaskSummary;
};

export type TaskDetailSelection = TaskDetailPayload;
