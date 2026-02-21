import { Skeleton } from '@mui/material';
import {
  useTaskProgressBarState,
  type TaskProgressBarProps,
} from './useTaskProgressBarState.js';
import { TaskProgressBarView } from './TaskProgressBarView.tsx';

export type { TaskProgressBarProps, TaskProgressData, TaskProgressSegment } from './useTaskProgressBarState';

export const TaskProgressBar = (props: TaskProgressBarProps) => {
  const state = useTaskProgressBarState(props);
  return <TaskProgressBarView {...state} />;
};

export const skeletonTaskProgressBar = <Skeleton variant="rounded" height={20} />;
