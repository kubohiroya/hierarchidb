import { useEffect, useMemo, useRef } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import { useAtomValue } from 'jotai';
import {
  buildSessionRuntimeAtom,
  buildSessionStageCountersAtom,
  buildSessionStageProgressAtom,
  buildSessionTasksByStageAtom,
} from '~/ui/atoms/buildSessionStateAtoms';
import {
  type BuildProgress,
  type BuildProgressStatus,
} from '~/ui/components/build-progress/shapeBuildProgressMapping';

export type { BuildProgress, BuildProgressStatus };

export interface ShapeProgressState {
  progress: BuildProgress | null;
  status: BuildProgressStatus | null;
  error: Error | null;
}

const isDev = import.meta.env.DEV;
type BuildProgressDebugConfig = Partial<Record<'mapping' | 'all', boolean>>;

const readBuildProgressDebugConfig = (): BuildProgressDebugConfig | null => {
  const scope = globalThis as typeof globalThis & {
    __HDB_SHAPE_BUILD_PROGRESS_DEBUG__?: unknown;
  };
  const raw = scope.__HDB_SHAPE_BUILD_PROGRESS_DEBUG__;
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  return raw as BuildProgressDebugConfig;
};

const isBuildProgressDebugEnabled = (): boolean => {
  if (!isDev) return false;
  const config = readBuildProgressDebugConfig();
  if (!config) return false;
  return config.all === true || config.mapping === true;
};

const logProgressMapping = (nodeId: string | null, payload: {
  unifiedExists: boolean;
  mappedExists: boolean;
  progressTaskId?: string | null;
  progressTaskStatus?: string | null;
  stageTotals?: string;
}): void => {
  if (!isDev) return;
  const hasStageTotals = payload.stageTotals !== undefined;
  console.debug('[ShapeBuildProgressMappingTrace]', {
    nodeId,
    unifiedExists: payload.unifiedExists,
    mappedExists: payload.mappedExists,
    progressTaskId: payload.progressTaskId ?? null,
    progressTaskStatus: payload.progressTaskStatus ?? null,
    stageTotals: hasStageTotals ? payload.stageTotals : null,
  });
};

export function useBuildProgress(
  nodeId: NodeId | null,
): ShapeProgressState & { subscribe: () => void; unsubscribe: () => void } {
  const runtime = useAtomValue(buildSessionRuntimeAtom);
  const counters = useAtomValue(buildSessionStageCountersAtom);
  const stageProgress = useAtomValue(buildSessionStageProgressAtom);
  const tasksByStage = useAtomValue(buildSessionTasksByStageAtom);

  const progress = useMemo<BuildProgress | null>(() => {
    if (!nodeId) return null;
    const activeStageId = runtime.activeStageId;
    const aggregate = (['source', 'geometry', 'tileEmit'] as const).reduce(
      (acc, stageId) => {
        const stageCounter = counters[stageId];
        acc.total += stageCounter.total;
        acc.completed += stageCounter.terminal - stageCounter.failed;
        acc.failed += stageCounter.failed;
        return acc;
      },
      { total: 0, completed: 0, failed: 0 },
    );
    const stageTotals = (['source', 'geometry', 'tileEmit'] as const).reduce<BuildProgress['stageTotals']>((acc, stageId) => {
      const stageCounter = counters[stageId];
      acc ??= {};
      acc[stageId] = {
        total: stageCounter.total,
        completed: stageCounter.terminal - stageCounter.failed,
        failed: stageCounter.failed,
        skipped: 0,
      };
      return acc;
    }, undefined);
    const progressTask = (tasksByStage[activeStageId] ?? [])
      .find((task) => task && (task.status === 'running' || task.status === 'queued'));
    return {
      total: aggregate.total,
      completed: aggregate.completed,
      failed: aggregate.failed,
      skipped: 0,
      percentage: stageProgress[activeStageId],
      stage: activeStageId,
      timestamp: Date.now(),
      message: undefined,
      progressTaskId: progressTask?.taskId,
      progressTaskStatus: progressTask?.status,
      progressTaskStage: progressTask?.stage,
      progressTaskProgress: progressTask?.progress,
      progressTaskDisplay: progressTask?.display,
      stageTotals,
    };
  }, [counters, nodeId, runtime.activeStageId, stageProgress, tasksByStage]);

  const derivedStatus = useMemo<BuildProgressStatus | null>(() => {
    if (!nodeId) return null;
    const phase = runtime.phase;
    const status: BuildProgressStatus['status'] = (() => {
      if (phase === 'idle') return 'idle';
      if (phase === 'completed') return 'completed';
      if (phase === 'failed') return 'failed';
      if (phase === 'paused') return 'paused';
      if (phase === 'starting') return 'queued';
      return 'processing';
    })();
    return {
      status,
      stage: runtime.activeStageId,
      progress: progress?.percentage,
      hasErrors: status === 'failed',
      error: null,
      lastUpdated: Date.now(),
    };
  }, [nodeId, progress?.percentage, runtime.activeStageId, runtime.phase]);

  const error: Error | null = null;
  const subscribe = () => { };
  const unsubscribe = () => { };

  const previousSignature = useRef<string | null>(null);
  useEffect(() => {
    if (!isBuildProgressDebugEnabled()) return;
    const mappedExists = progress !== null;
    const unifiedExists = progress !== null;
    const stageTotals = mappedExists
      ? JSON.stringify(progress?.stageTotals)
      : undefined;
    const signature = JSON.stringify({
      progress,
      derivedStatus,
      error: null,
    });
    if (signature === previousSignature.current) return;
    previousSignature.current = signature;
    logProgressMapping(nodeId ? String(nodeId) : null, {
      unifiedExists,
      mappedExists,
      progressTaskId: progress?.progressTaskId ?? null,
      progressTaskStatus: progress?.progressTaskStatus ?? null,
      stageTotals,
    });
  }, [derivedStatus, error, nodeId, progress]);

  return {
    progress,
    status: derivedStatus,
    error,
    subscribe,
    unsubscribe,
  };
}
