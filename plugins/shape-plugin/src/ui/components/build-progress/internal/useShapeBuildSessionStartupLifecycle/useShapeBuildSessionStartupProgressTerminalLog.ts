import { useEffect } from 'react';
import { isTaskPhaseDisplay } from '~/common/utils/taskMessageUtils';
import type { BuildProgress } from '~/ui/components/build-progress/shapeBuildProgressMapping';
import type { BuildSessionTransitionState } from '@hierarchidb/ui-build-progress/build-session';
import type { BuildSessionTransitionPhase } from '../useShapeBuildSessionHelpers/startupTrace';
import type { BuildSessionDisplayStatus } from '~/ui/components/build-progress/shapeBuildProgressMapping';

type UseShapeBuildSessionStartupProgressTerminalLogArgs = {
  buildStatus: BuildSessionDisplayStatus['status'];
  effectiveProgress: BuildProgress | null;
  runtimeStatus: BuildSessionDisplayStatus['status'];
  resolvedStage: string | undefined;
  progressTerminalLogKeyRef: { current: string | null };
  emitBuildSessionTransitionLog: (
    level: 'info' | 'warn' | 'error',
    message: string,
    payload?: Record<string, unknown>,
  ) => void;
  buildSessionTransition: BuildSessionTransitionState<BuildSessionTransitionPhase>;
};

export const useShapeBuildSessionStartupProgressTerminalLog = ({
  buildStatus,
  effectiveProgress,
  runtimeStatus,
  resolvedStage,
  progressTerminalLogKeyRef,
  emitBuildSessionTransitionLog,
  buildSessionTransition,
}: UseShapeBuildSessionStartupProgressTerminalLogArgs): void => {
  useEffect(() => {
    const progressMessage = typeof effectiveProgress?.message === 'string'
      ? effectiveProgress.message.trim()
      : '';
    const progressDisplay = effectiveProgress?.progressTaskDisplay;
    if (!progressDisplay && !progressMessage) return;
    if (
      !buildSessionTransition.active
      && buildStatus !== 'running'
      && runtimeStatus !== 'running'
    ) return;

    const progressTaskId = effectiveProgress?.progressTaskId;
    const progressTaskStatus = effectiveProgress?.progressTaskStatus;
    const progressTaskTitle = typeof effectiveProgress?.progressTaskTitle === 'string'
      ? effectiveProgress.progressTaskTitle.trim()
      : '';

    const isTerminalUpdate = (
      progressTaskStatus === 'completed'
      || ((effectiveProgress?.percentage ?? 0) >= 100 && !isTaskPhaseDisplay(progressDisplay))
    );
    if (!isTerminalUpdate) return;

    const key = `${progressTaskId ?? ''}:${progressTaskStatus ?? ''}:${progressDisplay?.kind ?? ''}:${progressDisplay?.key ?? ''}:${progressMessage}`;
    if (progressTerminalLogKeyRef.current === key) return;
    progressTerminalLogKeyRef.current = key;
    emitBuildSessionTransitionLog('info', 'worker progress terminal update', {
      stage: resolvedStage ?? null,
      message: progressMessage || null,
      displayKind: progressDisplay?.kind ?? null,
      displayKey: progressDisplay?.key ?? null,
      percentage: effectiveProgress?.percentage ?? null,
      taskId: progressTaskId ?? null,
      taskTitle: progressTaskTitle || null,
      taskStatus: progressTaskStatus ?? null,
    });
  }, [
    buildStatus,
    runtimeStatus,
    buildSessionTransition.active,
    effectiveProgress?.message,
    effectiveProgress?.percentage,
    effectiveProgress?.progressTaskDisplay,
    effectiveProgress?.progressTaskId,
    effectiveProgress?.progressTaskStatus,
    effectiveProgress?.progressTaskTitle,
    emitBuildSessionTransitionLog,
    progressTerminalLogKeyRef,
    resolvedStage,
    buildSessionTransition,
  ]);
};
