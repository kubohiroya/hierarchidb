import { Skeleton } from '@mui/material';
import { BuildSessionStageProgressBarView } from './BuildSessionStageProgressBarView.tsx';
import {
  type BuildSessionStageProgressBarProps,
  useBuildSessionStageProgressBarState,
} from './useBuildSessionStageProgressBarState.js';

export type {
  BuildSessionStageProgressBarData,
  BuildSessionStageProgressBarProps,
  BuildSessionStageProgressBarSegment,
} from './useBuildSessionStageProgressBarState.js';

export const BuildSessionStageProgressBar = (props: BuildSessionStageProgressBarProps) => {
  const state = useBuildSessionStageProgressBarState(props);
  return <BuildSessionStageProgressBarView {...state} />;
};

export const skeletonBuildSessionStageProgressBar = <Skeleton variant="rounded" height={20} />;
