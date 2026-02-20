import { useEffect } from 'react';
import { isTaskPhaseDisplay } from '~/common/utils/taskMessages';
import type { BuildProgress } from '~/ui/components/build-progress/shapeBuildProgressMapping';
import type { BuildSessionTransitionState } from '@hierarchidb/components/build-session';
import type { BuildSessionTransitionPhase } from '../useShapeBuildStepHelpers/startupTrace';
import type { BuildProgressStatus } from '~/ui/components/build-progress/shapeBuildProgressMapping';

type UseShapeBuildSessionStartupProgressTerminalLogArgs = {
  buildStatus: BuildProgressStatus['status'];
  effectiveProgress: BuildProgress | null;
  runtimeStatus: BuildProgressStatus['status'];
  resolvedTaskType: string | undefined;
  completedTaskSequenceById: Map<string, number>;
  progressTerminalLogKeyRef: { current: string | null };
  emitBuildSessionTransitionLog: (
    level: 'info' | 'warn' | 'error',
    message: string,
    payload?: Record<string, unknown>,
  ) => void;
  buildSessionTransition: BuildSessionTransitionState<BuildSessionTransitionPhase>;
};

const shouldSkipStaleUpdate = (
  progressTaskId: string | undefined,
  progressTaskSequence: number | undefined,
  progressTaskStatus: string | null | undefined,
  completedTaskSequenceById: Map<string, number>,
): boolean => {
  if (!(
    typeof progressTaskId === 'string'
    && typeof progressTaskSequence === 'number'
    && Number.isFinite(progressTaskSequence)
    && (progressTaskStatus === 'running' || progressTaskStatus === 'queued')
  )) {
    return false;
  }
  const completedSequence = completedTaskSequenceById.get(progressTaskId);
  return typeof completedSequence === 'number' && completedSequence >= progressTaskSequence;
};

export const useShapeBuildSessionStartupProgressTerminalLog = ({
  buildStatus,
  effectiveProgress,
  runtimeStatus,
  resolvedTaskType,
  completedTaskSequenceById,
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
      && buildStatus !== 'processing'
      && runtimeStatus !== 'processing'
    ) return;

    const progressTaskId = effectiveProgress?.progressTaskId;
    const progressTaskSequence = effectiveProgress?.progressTaskSequence;
    const progressTaskStatus = effectiveProgress?.progressTaskStatus;
    const progressTaskTitle = typeof effectiveProgress?.progressTaskTitle === 'string'
      ? effectiveProgress.progressTaskTitle.trim()
      : '';

    const isTerminalUpdate = (
      progressTaskStatus === 'completed'
      || ((effectiveProgress?.percentage ?? 0) >= 100 && !isTaskPhaseDisplay(progressDisplay))
    );
    if (!isTerminalUpdate) return;

    const isStale = shouldSkipStaleUpdate(
      progressTaskId,
      progressTaskSequence,
      progressTaskStatus,
      completedTaskSequenceById,
    );
    if (isStale) return;

    const key = `${progressTaskId ?? ''}:${progressTaskSequence ?? ''}:${progressTaskStatus ?? ''}:${progressDisplay?.kind ?? ''}:${progressDisplay?.key ?? ''}:${progressMessage}`;
    if (progressTerminalLogKeyRef.current === key) return;
    progressTerminalLogKeyRef.current = key;
    emitBuildSessionTransitionLog('info', 'worker progress terminal update', {
      stage: resolvedTaskType ?? null,
      message: progressMessage || null,
      displayKind: progressDisplay?.kind ?? null,
      displayKey: progressDisplay?.key ?? null,
      percentage: effectiveProgress?.percentage ?? null,
      taskId: progressTaskId ?? null,
      taskTitle: progressTaskTitle || null,
      taskSequence: progressTaskSequence ?? null,
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
    effectiveProgress?.progressTaskSequence,
    effectiveProgress?.progressTaskStatus,
    effectiveProgress?.progressTaskTitle,
    completedTaskSequenceById,
    emitBuildSessionTransitionLog,
    progressTerminalLogKeyRef,
    resolvedTaskType,
    buildSessionTransition,
  ]);
};
