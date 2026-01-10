import { Box, useTheme } from '@mui/material';

import type {
  TaskWithMetadata,
} from './ShapeBuildProgressTaskList.js';
import type { ShapeBuildProgressSummary } from '../../state/shapeBuildProgressAtoms.ts';
import type { BuildStage } from '@hierarchidb/components';

type TaskProgressBarProps = {
  stages: BuildStage[];
  tasksByStage: Record<string, TaskWithMetadata[]>;
  buildStatus: ShapeBuildProgressSummary['buildStatus'];
};
export const TaskProgressBar = ({
                           stages,
                           tasksByStage,
                           buildStatus,
                         }: TaskProgressBarProps) => {
  const theme = useTheme();
  const isBuildFailed = buildStatus === 'failed';
  const waitingColor = theme.palette.grey[300];
  const emptyStageColor = isBuildFailed ? theme.palette.error.main : theme.palette.grey[500];
  const runningColor = theme.palette.info.main;
  const failedColor = theme.palette.error.main;
  const segments: Array<{ fill: string }> = [];

  stages.forEach((stage) => {
    const stageTasks = tasksByStage[stage.id] ?? [];
    if (stageTasks.length === 0) {
      segments.push({ fill: emptyStageColor });
      return;
    }
    stageTasks.forEach((task) => {
      let fill = waitingColor;
      if (isBuildFailed) {
        fill = failedColor;
      } else if (task.status === 'completed') {
        fill = theme.palette.success.main;
      } else if (task.status === 'failed') {
        fill = failedColor;
      } else if (task.status === 'running') {
        fill = runningColor;
      } else if (task.status === 'paused') {
        fill = theme.palette.warning.main;
      }
      segments.push({ fill });
    });
  });

  const viewWidth = segments.length || 1;
  const rectHeight = 10;

  return (
    <Box sx={{ width: '100%', height: rectHeight }}>
      <svg width="100%" height={rectHeight} viewBox={`0 0 ${viewWidth} 1`} preserveAspectRatio="none">
        <title>---progress---</title>
        {segments.length > 0 ? segments.map((segment, index) => (
          <rect
            key={`task-${index.toString()}`}
            x={index}
            y={0}
            width={1}
            height={1}
            fill={segment.fill}
          />
        )) : (
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
