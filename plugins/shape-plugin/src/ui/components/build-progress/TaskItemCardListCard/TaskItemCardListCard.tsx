import { type CSSProperties, type ReactNode, forwardRef, useCallback, useMemo } from 'react';
import { Box } from '@mui/material';
import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressAtoms.js';

import {
  useTaskItemCardList,
  sortTransformTasks,
  sortVectorTileTasks,
} from '../taskItemCardList/useTaskItemCardList.ts';
import { TaskItemCard } from '../TaskItemCard/TaskItemCard.tsx';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { useShapeBuildStages } from '../useShapeBuildStages/useShapeBuildStages.ts';
import type { TaskItemWithMetadata } from '../taskItemCardList/types.ts';

type TaskItemCardListCardProps = {
  stageId: string;
  tasks: ShapeBuildTaskSummary[];
  stageValue: number;
  resolveStatusLabel: (statusValue?: string, skipped?: boolean) => string;
  resolveStatusColor: (statusValue?: string, skipped?: boolean) => 'default' | 'success' | 'error' | 'warning' | 'info';
  resolveTaskTitle: (task: TaskItemWithMetadata) => string;
  scrollToTaskId?: string;
  scrollRequestId?: number;
  virtualize?: boolean;
};

export const TaskItemCardListCard = forwardRef<HTMLDivElement|null, TaskItemCardListCardProps>(({
  stageId,
  tasks,
  stageValue,
  resolveStatusLabel,
  resolveStatusColor,
  resolveTaskTitle,
  scrollToTaskId,
  scrollRequestId,
  virtualize = true,
}: TaskItemCardListCardProps, ref) => {
  const { t } = useTranslation();
  const stages = useShapeBuildStages(t);
  const stageIconById = useMemo(() => {
    return new Map(stages.map((stage) => [stage.id, stage.icon]));
  }, [stages]);
  const resolveStageIcon = useCallback((taskStageId: string): ReactNode | null => (
    stageIconById.get(taskStageId) ?? null
  ), [stageIconById]);
  const {
    orderedTasks,
    shouldVirtualize,
    setRefs,
    virtualizer,
  } = useTaskItemCardList({
    stageId,
    tasks,
    scrollToTaskId,
    scrollRequestId,
    virtualize,
    ref,
  });
  const renderTaskItemCard = useCallback((task: ShapeBuildTaskSummary, key: string, style?: CSSProperties) => {
    const taskStageId = task.stage ?? stageId;
    const stageIcon = resolveStageIcon(taskStageId);
    return (
      <Box key={key} sx={style} data-task-id={task.taskId ?? undefined}>
        <TaskItemCard
          task={task}
          stageId={taskStageId}
          stageValue={stageValue}
          resolveStatusLabel={resolveStatusLabel}
          resolveStatusColor={resolveStatusColor}
          resolveTaskTitle={resolveTaskTitle}
          stageIcon={stageIcon}
          translate={t}
        />
      </Box>
    );
  }, [resolveStageIcon, resolveStatusColor, resolveStatusLabel, resolveTaskTitle, stageId, stageValue, t]);

  return (
    <Box
      ref={setRefs}
      onWheel={(event) => event.stopPropagation()}
      sx={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto' }}
    >
      {shouldVirtualize ? (
        <Box sx={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const task = orderedTasks[virtualRow.index];
            if (!task) return null;
            const taskTitle = resolveTaskTitle(task as TaskItemWithMetadata);
            const key = task.taskId ?? `${virtualRow.index}-${taskTitle}`;
            return renderTaskItemCard(task, key, {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
              paddingRight: 2,
              height: `${virtualRow.size}px`,
            });
          })}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pr: 1 }}>
          {orderedTasks.map((task, index) => {
            const taskTitle = resolveTaskTitle(task as TaskItemWithMetadata);
            const key = task.taskId ?? `${index}-${taskTitle}`;
            return renderTaskItemCard(task, key);
          })}
        </Box>
      )}
    </Box>
  );
});

export { sortTransformTasks, sortVectorTileTasks };
export type { TaskItemWithMetadata };
