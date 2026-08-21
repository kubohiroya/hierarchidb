import { Box } from '@mui/material';
import { type CSSProperties, forwardRef } from 'react';
import type { ShapeBuildConfig } from '~/common/types/BuildTaskResult';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressTypes';
import { TaskItemCardView } from '~/ui/components/build-progress/TaskItemCard/TaskItemCardView';
import { TaskItemDetailWindow } from '~/ui/components/build-progress/TaskItemCard/TaskItemDetailWindow';
import type { TaskOutcomeSummaryBuilder } from '~/ui/components/build-progress/TaskItemCard/taskOutcomeSummaryBuilderUtils';
import type { TaskItemWithMetadata } from '~/ui/components/build-progress/taskItemCardList/types';
import {
  sortGeometryTasks,
  sortVectorTileTasks,
  useTaskItemCardList,
} from '~/ui/components/build-progress/taskItemCardList/useTaskItemCardList';
import { useTaskItemCardListCardView } from './useTaskItemCardListCardView.js';

type TaskStageSummaryBuilderMap = Partial<
  Record<'source' | 'geometry' | 'tileEmit', TaskOutcomeSummaryBuilder>
>;

type TaskItemCardListCardProps = {
  stageId: string;
  tasks: ShapeBuildTaskSummary[];
  stageValue: number;
  resolveStatusLabel: (statusValue?: string, skipped?: boolean) => string;
  resolveStatusColor: (
    statusValue?: string,
    skipped?: boolean
  ) => 'default' | 'success' | 'error' | 'warning' | 'info';
  resolveTaskTitle: (task: TaskItemWithMetadata) => string;
  scrollToTaskId?: string;
  scrollRequestId?: number;
  virtualize?: boolean;
  summaryBuilders?: TaskStageSummaryBuilderMap;
  isDetailFloatingWindowOpen?: boolean;
  isOpeningPending?: boolean;
  buildConfig?: ShapeBuildConfig;
  onOpenDetailFloatingWindow?: () => void;
  onCloseDetailFloatingWindow?: () => void;
  floatingWindowZIndex?: number;
  onRequestBringFloatingWindowToFront?: () => void;
};

export const TaskItemCardListCard = forwardRef<HTMLDivElement | null, TaskItemCardListCardProps>(
  (
    {
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
      buildConfig,
      onOpenDetailFloatingWindow,
      onCloseDetailFloatingWindow,
      floatingWindowZIndex = 1,
      onRequestBringFloatingWindowToFront,
    }: TaskItemCardListCardProps,
    ref
  ) => {
    const { detail, handleCloseDetail, resolveTaskCardView, createTaskCardStyle } =
      useTaskItemCardListCardView({
        tasks,
        isDetailFloatingWindowOpen,
        onOpenDetailFloatingWindow,
        onCloseDetailFloatingWindow,
        resolveTaskTitle,
        resolveStatusLabel,
        resolveStatusColor,
        stageValue,
        summaryBuilders,
      });
    const { orderedTasks, shouldVirtualize, setRefs, virtualizer } = useTaskItemCardList({
      stageId,
      tasks,
      scrollToTaskId,
      scrollRequestId,
      virtualize,
      ref,
    });
    const renderTaskItemCard = (
      task: ShapeBuildTaskSummary,
      key: string,
      style?: CSSProperties
    ) => {
      const cardView = resolveTaskCardView(task);
      return (
        <Box key={key} sx={style} data-task-id={task.taskId ?? undefined}>
          <TaskItemCardView
            task={task}
            stageId={cardView.taskStageId}
            stageValue={cardView.stageValue}
            resolveStatusLabel={cardView.resolveStatusLabel}
            resolveStatusColor={cardView.resolveStatusColor}
            resolveTaskTitle={resolveTaskTitle}
            stageIcon={cardView.stageIcon}
            translate={cardView.t}
            summaryBuilder={cardView.summaryBuilder}
            isDetailSelected={cardView.isDetailSelected}
            isDetailHoverPreviewActive={cardView.isDetailHoverPreviewActive}
            onDetailHoverChange={cardView.handleDetailHoverChange}
            onDetailClick={cardView.handleDetailClick}
          />
        </Box>
      );
    };

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
                ...createTaskCardStyle(virtualRow.start, virtualRow.size),
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
          detail={detail}
          onClose={handleCloseDetail}
          zIndex={floatingWindowZIndex}
          onRequestBringToFront={onRequestBringFloatingWindowToFront}
          stageId={stageId}
          buildConfig={buildConfig}
        />
      </Box>
    );
  }
);

export { sortGeometryTasks, sortVectorTileTasks };
export type { TaskItemWithMetadata };
