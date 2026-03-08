import { Skeleton } from '@mui/material';
import {
  useBuildSessionStageProgressBarState,
  type BuildSessionStageProgressBarProps,
} from './useBuildSessionStageProgressBarState.js';
import { BuildSessionStageProgressBarView } from './BuildSessionStageProgressBarView.tsx';

export type { BuildSessionStageProgressBarProps, BuildSessionStageProgressBarData, BuildSessionStageProgressBarSegment } from './useBuildSessionStageProgressBarState.js';

export const BuildSessionStageProgressBar = (props: BuildSessionStageProgressBarProps) => {
  const state = useBuildSessionStageProgressBarState(props);
  return <BuildSessionStageProgressBarView {...state} />;
};

export const skeletonBuildSessionStageProgressBar = <Skeleton variant="rounded" height={20} />;
