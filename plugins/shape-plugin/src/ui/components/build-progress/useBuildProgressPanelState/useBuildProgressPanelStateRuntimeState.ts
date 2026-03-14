import { useEffect, useMemo, useRef } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { useBuildCrashInsight } from '~/ui/components/build-progress/useBuildCrashInsight/useBuildCrashInsight';
import type { BuildStage } from '@hierarchidb/ui-build-progress/build-stage';
import type { PaneProgress } from '@hierarchidb/ui-lru-splitview';
import type { ShapeEntity } from '~/common/types/ShapeEntity';
import type {
  TaskListViewPhase,
  TaskProgressControls,
  TaskProgressSummary,
} from '~/ui/atoms/shapeBuildProgressTypes';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressTypes';
import { useBuildProgressPanelStateComputed } from './useBuildProgressPanelStateComputed.js';
import type { BuildProgressPanelStateComputed } from './useBuildProgressPanelStateComputed.js';
import { resolveCompletionFailedStageLabel, resolveActiveRunningStageId } from './useBuildProgressPanelState.utils.js';
import { useBuildProgressPanelStateSideEffects } from './useBuildProgressPanelStateSideEffects.js';
import { useShapeBuildSession } from '~/ui/components/build-progress/internal/useShapeBuildSessionLogic.js';
import { useShapeBuildSessionStateAtomBridge } from '~/ui/components/build-progress/useShapeBuildSessionStateAtomBridge.js';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  pendingUserActionAtom,
  elapsedTickMsAtom,
  totalElapsedSnapshotAtom,
  completionSnapshotAtom,
  completionDialogOpenAtom,
} from '~/ui/atoms/buildSessionStateAtoms';
import type { PendingUserAction, CompletionSnapshotData } from '~/ui/atoms/buildSessionStateAtoms';

type RuntimeStateParams = {
  data?: Partial<ShapeEntity>;
  nodeId?: NodeId;
};

export type UseBuildProgressPanelStateRuntimeState = {
  summary: TaskProgressSummary;
  stages: BuildStage[];
  stageProgress: Record<string, number>;
  paneProgress: PaneProgress[];
  isTasksLoading: boolean;
  isTaskSummaryLoading: boolean;
  taskListViewPhase: TaskListViewPhase;
  tasksByStage: Record<string, ShapeBuildTaskSummary[]>;
  controls: TaskProgressControls;
  warningMessage: string | null;
  crashSuspectMessage: string | null;
  crashSuspectOpen: boolean;
  crashSuspectControls: { close: () => void };
  suspendSuspectMessage: string | null;
  suspendSuspectOpen: boolean;
  suspendSuspectControls: { close: () => void };
  completionDialogOpen: boolean;
  setCompletionDialogOpen: (next: boolean) => void;
  completionSnapshot: CompletionSnapshotData;
  setCompletionSnapshot: (snapshot: CompletionSnapshotData) => void;
  elapsedTickMs: number;
  setElapsedTickMs: (next: number) => void;
  localStartPending: boolean;
  setPendingUserAction: (next: PendingUserAction) => void;
  nodeIdForLog: string | undefined;
  completionSnapshotData: BuildProgressPanelStateComputed['completionSnapshotData'];
  completionFailedStageLabel: string;
  completionKeyRef: { current: string | null };
  totalElapsedSnapshot: { durationMs: number; capturedAt: number } | null;
  setTotalElapsedSnapshot: (value: { durationMs: number; capturedAt: number } | null) => void;
  mismatchSignatureRef: { current: Map<string, string> };
  liveTotalElapsedMs: number;
  computed: BuildProgressPanelStateComputed;
  resolvedActiveStageId: string | null;
  completion: ReturnType<typeof useBuildCrashInsight>;
};

export const useBuildProgressPanelStateRuntimeState = (
  params: RuntimeStateParams,
): UseBuildProgressPanelStateRuntimeState => {
  const resolvedNodeId = params.nodeId;
  const nodeIdForLog = resolvedNodeId ? String(resolvedNodeId) : undefined;
  const { t, i18n } = useTranslation('shape-plugin');
  useShapeBuildSessionStateAtomBridge(resolvedNodeId);

  const stepState = useShapeBuildSession({
    data: params.data,
    nodeId: resolvedNodeId,
  });

  const stages = stepState.stages;
  const stageProgress = stepState.stageProgress;
  const paneProgress = stepState.paneProgress;
  const isTaskSummaryLoading = stepState.isTaskSummaryLoading;
  const taskListViewPhase = stepState.taskListViewPhase;
  const isTasksLoading = stepState.isTasksLoading;
  const tasksByStage = stepState.tasksByStage;
  const summary: TaskProgressSummary = {
    stageLabel: stepState.stageLabel ?? '',
    taskLabel: stepState.taskLabel ?? '',
    taskUnitLabel: stepState.taskUnitLabel ?? '',
    overallProgress: stepState.overallProgress,
    completed: stepState.completed,
    total: stepState.total,
    failed: stepState.failed,
    skipped: stepState.skipped,
    buildStatus: stepState.buildStatus,
    hasProgressData: stepState.hasProgressData,
    timingStageId: stepState.timingStageId ?? null,
    completedStageElapsedMs: stepState.completedStageElapsedMs,
    totalElapsedMs: stepState.totalElapsedMs,
    stageElapsedMs: stepState.stageElapsedMs,
    stageRemainingMs: stepState.stageRemainingMs,
    stageTotals: stepState.stageTotals,
  };
  const controls: TaskProgressControls = {
    canStart: stepState.canStart,
    statusLabel: stepState.statusLabel,
    showResumeLabel: stepState.showResumeLabel,
    startPending: stepState.isStartPending,
    requestedControlAction: stepState.requestedControlAction,
    handleStart: stepState.handleStart,
    handlePause: stepState.handlePause,
    handleCancelQueued: stepState.handleCancelQueued,
    stopRequested: stepState.stopRequested,
  };
  const warningMessage = stepState.warningMessage;
  const crashSuspectMessage = stepState.crashSuspectMessage;
  const crashSuspectOpen = stepState.crashSuspectOpen;
  const crashSuspectControls = {
    close: () => {
      stepState.setCrashSuspectOpen();
    },
  };
  const suspendSuspectMessage = stepState.suspendSuspectMessage;
  const suspendSuspectOpen = stepState.suspendSuspectOpen;
  const suspendSuspectControls = {
    close: () => {
      stepState.setSuspendSuspectOpen();
    },
  };

  const completionDialogOpen = useAtomValue(completionDialogOpenAtom);
  const setCompletionDialogOpen = useSetAtom(completionDialogOpenAtom);
  const completionSnapshot = useAtomValue(completionSnapshotAtom);
  const setCompletionSnapshot = useSetAtom(completionSnapshotAtom);
  const localStartPending = useAtomValue(pendingUserActionAtom) === 'starting';
  const elapsedTickMs = useAtomValue(elapsedTickMsAtom);
  const setElapsedTickMs = useSetAtom(elapsedTickMsAtom);
  const totalElapsedSnapshot = useAtomValue(totalElapsedSnapshotAtom);
  const setTotalElapsedSnapshot = useSetAtom(totalElapsedSnapshotAtom);
  const completionKeyRef = useRef<string | null>(null);
  const mismatchSignatureRef = useRef<Map<string, string>>(new Map());
  const prevNodeIdRef = useRef<string | undefined>(undefined);

  const completion = useBuildCrashInsight({
    draft: params.data,
    nodeId: nodeIdForLog,
    status: summary.buildStatus,
  });

  const computed = useBuildProgressPanelStateComputed({
    data: params.data,
    summary,
    t,
    locale: i18n.resolvedLanguage ?? i18n.language ?? 'en',
    stages,
    stageProgress,
    tasksByStage,
  });

  const { stageTaskScan, completionSnapshotData: computedCompletionSnapshotData } = computed;

  const resolvedActiveStageId = useMemo(() => {
    if (summary.buildStatus !== 'running') return null;
    return resolveActiveRunningStageId({
      stages,
      stageTaskScan,
    });
  }, [summary.buildStatus, stages, stageTaskScan]);

  const completionFailedStageLabel = useMemo(() => {
    if (computedCompletionSnapshotData.completionFailedStageLabel.trim().length > 0) {
      return computedCompletionSnapshotData.completionFailedStageLabel;
    }
    return resolveCompletionFailedStageLabel({
      stages,
      failedStageId: undefined,
      fallbackStageLabel: computedCompletionSnapshotData.completionStageLabel,
    });
  }, [
    stages,
    computedCompletionSnapshotData.completionFailedStageLabel,
    computedCompletionSnapshotData.completionStageLabel,
  ]);

  const completionSnapshotData = useMemo(
    () => ({
      ...computedCompletionSnapshotData,
      completionFailedStageLabel,
    }),
    [computedCompletionSnapshotData, completionFailedStageLabel],
  );

  useBuildProgressPanelStateSideEffects({
    nodeId: nodeIdForLog,
    summary,
    stages,
    stageTaskScan,
    tasksByStage,
    stageConcurrencyIndicators: computed.stageConcurrencyIndicators,
    completionSnapshotData,
    activeStageId: resolvedActiveStageId,
    setCompletionDialogOpen,
    setCompletionSnapshot,
    completionKeyRef,
    setElapsedTickMs,
    elapsedTickMs,
    totalElapsedSnapshot,
    setTotalElapsedSnapshot,
    mismatchSignatureRef,
  });

  // Reset totalElapsedSnapshot when nodeId changes.
  // Must be in useEffect to avoid setState during render (which causes infinite loops).
  useEffect(() => {
    if (nodeIdForLog !== prevNodeIdRef.current) {
      prevNodeIdRef.current = nodeIdForLog;
      setTotalElapsedSnapshot(null);
    }
  }, [nodeIdForLog, setTotalElapsedSnapshot]);

  const liveTotalElapsedMs = useMemo(() => {
    // When idle, ignore any stale snapshot and return the raw value (0 after reset).
    if (summary.buildStatus === 'idle') {
      return summary.totalElapsedMs;
    }
    if (!totalElapsedSnapshot) {
      return summary.totalElapsedMs;
    }
    if (summary.buildStatus === 'running' || summary.buildStatus === 'paused') {
      const drift = Math.max(0, elapsedTickMs - totalElapsedSnapshot.capturedAt);
      return totalElapsedSnapshot.durationMs + drift;
    }
    if (summary.totalElapsedMs > totalElapsedSnapshot.durationMs) {
      return summary.totalElapsedMs;
    }
    return totalElapsedSnapshot.durationMs;
  }, [elapsedTickMs, summary.buildStatus, summary.totalElapsedMs, totalElapsedSnapshot]);

  const setPendingUserAction = useSetAtom(pendingUserActionAtom);

  return {
    summary: {
      ...summary,
      totalElapsedMs: liveTotalElapsedMs,
    },
    stages,
    stageProgress,
    paneProgress,
    isTasksLoading,
    isTaskSummaryLoading,
    taskListViewPhase,
    tasksByStage,
    controls,
    warningMessage,
    crashSuspectMessage,
    crashSuspectOpen,
    crashSuspectControls,
    suspendSuspectMessage,
    suspendSuspectOpen,
    suspendSuspectControls,
    completionDialogOpen,
    setCompletionDialogOpen,
    completionSnapshot,
    setCompletionSnapshot,
    elapsedTickMs,
    setElapsedTickMs,
    localStartPending,
    setPendingUserAction,
    nodeIdForLog,
    completionSnapshotData,
    completionFailedStageLabel,
    completionKeyRef,
    totalElapsedSnapshot,
    setTotalElapsedSnapshot,
    mismatchSignatureRef,
    liveTotalElapsedMs,
    computed,
    resolvedActiveStageId,
    completion,
  };
};
