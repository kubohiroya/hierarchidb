import { useState } from 'react';
import { useShapeBuildSessionStartupTrace } from './useShapeBuildStepStartupLifecycle/useShapeBuildSessionStartupTrace';
import { useShapeBuildSessionStartupProgressTerminalLog } from './useShapeBuildStepStartupLifecycle/useShapeBuildSessionStartupProgressTerminalLog';
import type {
  BuildSessionTransitionState,
} from '@hierarchidb/components/build-session';
import type { BuildProgress } from '~/ui/components/build-progress/shapeBuildProgressMapping';
import type { BuildStatusSource } from '~/ui/components/build-progress/resolveBuildStatusSource';
import type {
  BuildSessionTransitionPhase,
} from './useShapeBuildStepHelpers/startupTrace';

const POLL_INTERVAL_MS = 1000;

type UseShapeBuildSessionStartupLifecycleArgs = {
  activeNodeId: string | null;
  buildSessionTransition: BuildSessionTransitionState<BuildSessionTransitionPhase>;
  buildStatus: BuildStatusSource;
  resolveStage: string | null;
  effectiveProgress: BuildProgress | null;
  progressTerminalLogKeyRef: { current: string | null };
  emitBuildSessionTransitionLog: (
    level: 'info' | 'warn' | 'error',
    message: string,
    payload?: Record<string, unknown>,
  ) => void;
};

export const useShapeBuildSessionStartupLifecycle = ({
  activeNodeId,
  buildSessionTransition,
  buildStatus,
  resolveStage,
  effectiveProgress,
  progressTerminalLogKeyRef,
  emitBuildSessionTransitionLog,
}: UseShapeBuildSessionStartupLifecycleArgs) => {
  const [buildSessionTransitionElapsedMs] = useState(0);

  useShapeBuildSessionStartupTrace({
    activeNodeId,
    buildStatus,
    effectiveProgress,
    resolveStage,
  });

  useShapeBuildSessionStartupProgressTerminalLog({
    buildStatus,
    effectiveProgress,
    runtimeStatus: 'idle', // Simplified - no longer needed with SSOT
    resolvedStage: undefined, // Simplified - no longer needed with SSOT
    progressTerminalLogKeyRef,
    emitBuildSessionTransitionLog,
    buildSessionTransition,
  });

  // receiving-task-snapshot decision logic removed - direct transition to running phase

  return {
    buildSessionTransitionElapsedMs,
    pollIntervalMs: POLL_INTERVAL_MS,
  };
};
