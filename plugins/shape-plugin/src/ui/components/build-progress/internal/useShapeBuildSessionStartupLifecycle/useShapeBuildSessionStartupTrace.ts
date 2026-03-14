import { useEffect } from 'react';
import { emitShapeProgressStepTrace, isShapeProgressStepDebugEnabled } from '../useShapeBuildSessionHelpers/debug';
import type { ShapeProgressStepTracePayload } from '../useShapeBuildSessionHelpers/startupTrace';
import type { BuildProgress } from '~/ui/components/build-progress/shapeBuildProgressMapping';
import type { BuildStatusSource } from '~/ui/components/build-progress/resolveBuildStatusSource';

type UseShapeBuildSessionStartupTraceArgs = {
  activeNodeId: string | null;
  buildStatus: BuildStatusSource;
  effectiveProgress: BuildProgress | null;
  resolveStage: string | null;
};

export const useShapeBuildSessionStartupTrace = ({
  activeNodeId,
  buildStatus,
  effectiveProgress,
  resolveStage,
}: UseShapeBuildSessionStartupTraceArgs): void => {
  useEffect(() => {
    if (!isShapeProgressStepDebugEnabled()) return;
    const nextTrace: ShapeProgressStepTracePayload = {
      nodeId: activeNodeId,
      phase: buildStatus,
      progressTaskId: effectiveProgress?.progressTaskId ?? null,
      progressTaskStatus: effectiveProgress?.progressTaskStatus ?? null,
      progressTaskStage: resolveStage,
      progressTaskProgress: effectiveProgress?.progressTaskProgress ?? null,
      percentage: effectiveProgress?.percentage ?? null,
      total: effectiveProgress?.total ?? 0,
      completed: effectiveProgress?.completed ?? 0,
      failed: effectiveProgress?.failed ?? 0,
      skipped: effectiveProgress?.skipped ?? 0,
      message: effectiveProgress?.message ?? null,
    };
    emitShapeProgressStepTrace(nextTrace);
  }, [activeNodeId, buildStatus, effectiveProgress, resolveStage]);
};
