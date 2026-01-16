import { Box, useTheme } from '@mui/material';
import { useSetAtom } from 'jotai';

import type {
  TaskWithMetadata,
} from './TaskListVirtualized.tsx';
import { isSkippedMessage, sortVectorTileTasks } from './TaskListVirtualized.tsx';
import { resolveTaskWeight } from './taskProgressWeights.ts';
import type { TaskProgressSummary } from '../../atoms/shapeBuildProgressAtoms.ts';
import { taskScrollTargetAtom } from '../../atoms/shapeBuildProgressAtoms.ts';
import type { BuildStage } from '@hierarchidb/components';

type TaskProgressBarProps = {
  stages: BuildStage[];
  tasksByStage: Record<string, TaskWithMetadata[]>;
  buildStatus: TaskProgressSummary['buildStatus'];
};
export const TaskProgressBar = ({
  stages,
  tasksByStage,
  buildStatus,
}: TaskProgressBarProps) => {
  const theme = useTheme();
  const setScrollTarget = useSetAtom(taskScrollTargetAtom);
  const waitingColor = theme.palette.grey[300];
  const emptyStageColor = buildStatus === 'failed' ? theme.palette.error.main : theme.palette.grey[500];
  const runningColor = theme.palette.info.main;
  const failedColor = theme.palette.error.main;
  const skippedColor = theme.palette.warning.main;
  const segments: Array<{ fill: string; stageId: string; taskId?: string; width: number }> = [];

  stages.forEach((stage) => {
    const stageTasks = tasksByStage[stage.id] ?? [];
    if (stageTasks.length === 0) {
      return;
    }
    const orderedTasks = stage.id === 'vt'
      ? sortVectorTileTasks(stageTasks)
      : stageTasks;
    orderedTasks.forEach((task) => {
      let fill = waitingColor;
      const isSkipped = isSkippedMessage(task.message);
      if (isSkipped) {
        fill = skippedColor;
      } else if (task.status === 'completed') {
        fill = theme.palette.success.main;
      } else if (task.status === 'failed') {
        fill = failedColor;
      } else if (task.status === 'running') {
        fill = runningColor;
      } else if (task.status === 'paused') {
        fill = theme.palette.warning.main;
      }
      segments.push({
        fill,
        stageId: stage.id,
        taskId: task.taskId,
        width: resolveTaskWeight(task),
      });
    });
  });

  const viewWidth = Math.max(1, segments.reduce((total, segment) => total + segment.width, 0));
  const rectHeight = 10;

  return (
    <Box sx={{ width: '100%', height: rectHeight }}>
      <svg width="100%" height={rectHeight} viewBox={`0 0 ${viewWidth} 1`} preserveAspectRatio="none">
        <title>---progress---</title>
        {segments.length > 0 ? (() => {
          let offset = 0;
          return segments.map((segment, index) => {
            const x = offset;
            offset += segment.width;
            const handleActivate = () => {
              if (!segment.taskId) return;
              setScrollTarget({
                stageId: segment.stageId,
                taskId: segment.taskId,
                requestedAt: Date.now(),
              });
            };
            return (
              <rect
                key={`task-${index.toString()}`}
                x={x}
                y={0}
                width={Math.ceil(segment.width) + 2}
                height={1}
                fill={segment.fill}
                onClick={segment.taskId ? handleActivate : undefined}
                onKeyDown={segment.taskId ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleActivate();
                  }
                } : undefined}
                role={segment.taskId ? 'button' : undefined}
                tabIndex={segment.taskId ? 0 : undefined}
                aria-label={segment.taskId ? `Scroll to ${segment.stageId} task` : undefined}
                style={segment.taskId ? { cursor: 'pointer' } : undefined}
              />
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
