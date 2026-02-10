import type { BuildStatus } from '@hierarchidb/components/build-status';

type Params = {
  forceRestart?: boolean;
  buildStatus: BuildStatus;
  runtimeStatus: string | null;
};

export const shouldResumeBuildSession = ({
  forceRestart,
  buildStatus,
  runtimeStatus,
}: Params): boolean => {
  if (forceRestart) return false;
  return buildStatus === 'paused' || runtimeStatus === 'paused';
};
