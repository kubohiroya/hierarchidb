import { type CSSProperties, type ReactNode, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';

import {
  useTaskItemCardList,
  sortTransformTasks,
  sortVectorTileTasks,
} from '~/ui/components/build-progress/taskItemCardList/useTaskItemCardList';
import { TaskItemCard } from '~/ui/components/build-progress/TaskItemCard/TaskItemCard';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { useShapeBuildStages } from '~/ui/components/build-progress/useShapeBuildStages/useShapeBuildStages';
import type { TaskItemWithMetadata } from '~/ui/components/build-progress/taskItemCardList/types';
import {
  buildFetchTaskOutcomeSummary,
  type TaskOutcomeSummaryBuilder,
  buildSimpleTaskOutcomeSummary,
  buildTransformTaskOutcomeSummary,
} from '~/ui/components/build-progress/TaskItemCard/taskOutcomeSummaryBuilders';
import {
  TaskItemDetailWindow,
  type TaskDetailSelection,
} from '~/ui/components/build-progress/TaskItemCard/TaskItemDetailWindow';

type TaskStageSummaryBuilderMap = Partial<Record<'fetch' | 'transform' | 'vt', TaskOutcomeSummaryBuilder>>;

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
  summaryBuilders?: TaskStageSummaryBuilderMap;
  isDetailFloatingWindowOpen?: boolean;
  isOpeningPending?: boolean;
  onOpenDetailFloatingWindow?: () => void;
  onCloseDetailFloatingWindow?: () => void;
  floatingWindowZIndex?: number;
  onRequestBringFloatingWindowToFront?: () => void;
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
  summaryBuilders,
  isDetailFloatingWindowOpen = false,
  isOpeningPending = false,
  onOpenDetailFloatingWindow,
  onCloseDetailFloatingWindow,
  floatingWindowZIndex = 1,
  onRequestBringFloatingWindowToFront,
}: TaskItemCardListCardProps, ref) => {
  const [hoveredDetail, setHoveredDetail] = useState<TaskDetailSelection | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<TaskDetailSelection | null>(null);
  const wasDetailFloatingWindowOpenRef = useRef(isDetailFloatingWindowOpen);
  const { t } = useTranslation();
  const stages = useShapeBuildStages({ t: (key, fallback): string => String(t(key, fallback ?? key)) });
  const stageIconById = useMemo(() => {
    return new Map(stages.map((stage) => [stage.id, stage.icon]));
  }, [stages]);
  const resolveStageIcon = useCallback((taskStageId: string): ReactNode | null => (
    stageIconById.get(taskStageId) ?? null
  ), [stageIconById]);
  useEffect(() => {
    const wasOpen = wasDetailFloatingWindowOpenRef.current;
    if (wasOpen && !isDetailFloatingWindowOpen) {
      setSelectedDetail(null);
      setHoveredDetail(null);
    }
    wasDetailFloatingWindowOpenRef.current = isDetailFloatingWindowOpen;
  }, [isDetailFloatingWindowOpen]);
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
    const taskStageId = task.stage;
    const stageIcon = resolveStageIcon(taskStageId);
    const injectedBuilder = (taskStageId === 'transform'
      ? summaryBuilders?.transform
      : (taskStageId === 'fetch' ? summaryBuilders?.fetch : summaryBuilders?.vt));
    const summaryBuilder = injectedBuilder
      ?? (
        taskStageId === 'transform'
          ? buildTransformTaskOutcomeSummary
          : (taskStageId === 'fetch' ? buildFetchTaskOutcomeSummary : buildSimpleTaskOutcomeSummary)
      );
    const currentTaskDetailId = task.taskId ?? resolveTaskTitle(task as TaskItemWithMetadata);
    const selectedTaskDetailId = selectedDetail?.task.taskId ?? selectedDetail?.title;
    const hoveredTaskDetailId = hoveredDetail?.task.taskId ?? hoveredDetail?.title;
    const isDetailSelected = selectedTaskDetailId === currentTaskDetailId;
    const isDetailHoverPreviewActive = !selectedDetail && hoveredTaskDetailId === currentTaskDetailId;
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
          summaryBuilder={summaryBuilder}
          isDetailSelected={isDetailSelected}
          isDetailHoverPreviewActive={isDetailHoverPreviewActive}
          onDetailHoverChange={(value) => {
            if (selectedDetail) return;
            setHoveredDetail(value);
          }}
          onDetailClick={(value) => {
            setHoveredDetail(null);
            setSelectedDetail((previous) => {
              const previousId = previous?.task.taskId ?? previous?.title;
              const clickedId = value.task.taskId ?? value.title;
              if (previousId === clickedId) return null;
              if (!previous && !isDetailFloatingWindowOpen) {
                onOpenDetailFloatingWindow?.();
              }
              return value;
            });
          }}
        />
      </Box>
    );
  }, [hoveredDetail, isDetailFloatingWindowOpen, onOpenDetailFloatingWindow, resolveStageIcon, resolveStatusColor, resolveStatusLabel, resolveTaskTitle, selectedDetail, stageId, stageValue, summaryBuilders, t]);

  return (
    <Box
      ref={setRefs}
      onWheel={(event) => event.stopPropagation()}
      sx={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        height: '100%',
        overflow: 'auto',
        cursor: isOpeningPending ? 'wait' : 'default',
      }}
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
      <TaskItemDetailWindow
        open={isDetailFloatingWindowOpen}
        detail={selectedDetail ?? hoveredDetail}
        onClose={onCloseDetailFloatingWindow ?? (() => {})}
        zIndex={floatingWindowZIndex}
        onRequestBringToFront={onRequestBringFloatingWindowToFront}
        stageId={stageId}
      />
    </Box>
  );
});

export { sortTransformTasks, sortVectorTileTasks };
export type { TaskItemWithMetadata };
