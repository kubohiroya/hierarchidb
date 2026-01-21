import type { KeyboardEvent, MouseEvent } from 'react';
import { Box, useTheme } from '@mui/material';
import { useSetAtom } from 'jotai';

import type {
  TaskWithMetadata,
} from './TaskListVirtualized.tsx';
import { isSkippedMessage, sortVectorTileTasks } from './TaskListVirtualized.tsx';
import type { TaskProgressSummary } from '../../atoms/shapeBuildProgressAtoms.ts';
import { taskScrollTargetAtom } from '../../atoms/shapeBuildProgressAtoms.ts';
import type { BuildStage } from '@hierarchidb/components';

type TaskProgressBarProps = {
  stages: BuildStage[];
  tasksByStage: Record<string, TaskWithMetadata[]>;
  buildStatus: TaskProgressSummary['buildStatus'];
  resolveTaskTitle: (task: TaskWithMetadata) => string;
};
export const TaskProgressBar = ({
  stages,
  tasksByStage,
  buildStatus,
  resolveTaskTitle,
}: TaskProgressBarProps) => {
  const theme = useTheme();
  const setScrollTarget = useSetAtom(taskScrollTargetAtom);
  const waitingColor = theme.palette.grey[300];
  const emptyStageColor = buildStatus === 'failed' ? theme.palette.error.main : theme.palette.grey[500];
  const runningColor = theme.palette.info.main;
  const failedColor = theme.palette.error.main;
  const skippedColor = theme.palette.warning.main;
  const segments: Array<{ fill: string; stageId: string; taskId?: string; title: string; width: number }> = [];
  stages.forEach((stage) => {
    const fallbackStageId = stage.id === 'transform'
      && stages.length === 1
      && (tasksByStage.transform?.length ?? 0) === 0
      && (tasksByStage.fetch?.length ?? 0) > 0
      ? 'fetch'
      : stage.id;
    const sourceStageId = fallbackStageId;
    const stageTasks = tasksByStage[sourceStageId] ?? [];
    if (stageTasks.length === 0) {
      return;
    }
    const orderedTasks = stage.id === 'vt'
      ? sortVectorTileTasks(stageTasks)
      : stageTasks;
    orderedTasks.forEach((task) => {
      const statusValue = (task.status ?? '').toString().toLowerCase();
      let fill = waitingColor;
      const isSkipped = isSkippedMessage(task.message);
      if (isSkipped) {
        fill = skippedColor;
      } else if (statusValue === 'completed') {
        fill = theme.palette.success.main;
      } else if (statusValue === 'failed') {
        fill = failedColor;
      } else if (statusValue === 'running') {
        fill = runningColor;
      } else if (statusValue === 'paused') {
        fill = theme.palette.warning.main;
      }
      const isExternalStage = sourceStageId !== stage.id;
      segments.push({
        fill,
        stageId: stage.id,
        taskId: isExternalStage ? undefined : task.taskId,
        title: resolveTaskTitle(task),
        width: 1,
      });
    });
  });

  const viewWidth = Math.max(1, segments.reduce((total, segment) => total + segment.width, 0));
  const rectHeight = 10;

  return (
    <Box sx={{ width: '100%', height: rectHeight }}>
      <svg width="100%" height={rectHeight} viewBox={`0 0 ${viewWidth} 1`} preserveAspectRatio="none">
        {segments.length > 0 ? (() => {
          let offset = 0;
          return segments.map((segment, index) => {
            const x = offset;
            offset += segment.width;
            const handleActivate = (event?: MouseEvent | KeyboardEvent) => {
              event?.preventDefault();
              if (!segment.taskId) return;
              setScrollTarget({
                stageId: segment.stageId,
                taskId: segment.taskId,
                requestedAt: Date.now(),
              });
            };
            const rect = (
              <rect
                x={x}
                y={0}
                width={Math.ceil(segment.width) + 2}
                height={1}
                fill={segment.fill}
              />
            );
            if (!segment.taskId) {
              return (
                <g key={`task-${index.toString()}`}>
                  {rect}
                  <title>{segment.title}</title>
                </g>
              );
            }
            return (
              <a
                key={`task-${index.toString()}`}
                href="#"
                onClick={handleActivate}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    handleActivate(event);
                  }
                }}
                aria-label={`Scroll to ${segment.stageId} task`}
                style={{ cursor: 'pointer' }}
              >
                {rect}
                <title>{segment.title}</title>
              </a>
            );
          });
        })() : (
          <rect
            key="task-empty"
            x={0}
            y={0}
            width={1}
            height={1}
            fill={emptyStageColor}
          />
        )}
      </svg>
    </Box>
  );
};
