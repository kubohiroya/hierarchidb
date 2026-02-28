import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import type { TaskOutcomeSummary } from '~/ui/components/build-progress/TaskItem/TaskItem';

export type TaskDetailPayload = {
  title: string;
  summary: TaskOutcomeSummary;
  task: ShapeBuildTaskSummary;
};

export type TaskDetailSelection = TaskDetailPayload;
