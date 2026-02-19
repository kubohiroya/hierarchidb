import { Skeleton } from '@mui/material';
import { useTaskProgressBarState, type TaskProgressBarProps } from './useTaskProgressBarState.js';
import { TaskProgressBarView } from './TaskProgressBarView.js';

export { type TaskProgressBarProps, type TaskProgressData, type TaskProgressSegment } from './useTaskProgressBarState.js';

export const TaskProgressBar = (props: TaskProgressBarProps) => {
  const state = useTaskProgressBarState(props);
  return <TaskProgressBarView {...state} />;
};

export const skeletonTaskProgressBar = <Skeleton variant="rounded" height={20} />;
