import type { NodeId } from '@hierarchidb/core-types';
import type { BuildStage } from '@hierarchidb/ui-build-progress/build-stage';
import { useTranslation } from '@hierarchidb/ui-i18n';
import type { PaneProgress } from '@hierarchidb/ui-lru-splitview';
import { useAtomValue, useSetAtom } from 'jotai';
import { useMemo, useRef } from 'react';
import type { ShapeEntity } from '~/common/types/ShapeEntity';
import type { CompletionSnapshotData, PendingUserAction } from '~/ui/atoms/buildSessionStateAtoms';
import {
  completionDialogOpenAtom,
  completionSnapshotAtom,
  pendingUserActionAtom,
} from '~/ui/atoms/buildSessionStateAtoms';
import type {
  ShapeBuildTaskSummary,
  TaskListViewPhase,
  TaskProgressControls,
  TaskProgressSummary,
} from '~/ui/atoms/shapeBuildProgressTypes';
import { useShapeBuildSession } from '~/ui/components/build-progress/internal/useShapeBuildSessionLogic.js';
import { useBuildCrashInsight } from '~/ui/components/build-progress/useBuildCrashInsight/useBuildCrashInsight';
import { useShapeBuildSessionStateAtomBridge } from '~/ui/hooks/useShapeBuildSessionStateAtomBridge.js';
import {
  resolveActiveRunningStageId,
  resolveCompletionFailedStageLabel,
} from './useBuildProgressPanelState.utils.js';
import type { BuildProgressPanelStateComputed } from './useBuildProgressPanelStateComputed.js';
import { useBuildProgressPanelStateComputed } from './useBuildProgressPanelStateComputed.js';
import { useBuildProgressPanelStateSideEffects } from './useBuildProgressPanelStateSideEffects.js';

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
  localStartPending: boolean;
  setPendingUserAction: (next: PendingUserAction) => void;
  nodeIdForLog: string | undefined;
  completionSnapshotData: BuildProgressPanelStateComputed['completionSnapshotData'];
  completionFailedStageLabel: string;
  completionKeyRef: { current: string | null };
  mismatchSignatureRef: { current: Map<string, string> };
  computed: BuildProgressPanelStateComputed;
  resolvedActiveStageId: string | null;
  completion: ReturnType<typeof useBuildCrashInsight>;
};

export const useBuildProgressPanelStateRuntimeState = (
  params: RuntimeStateParams
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
  const completionKeyRef = useRef<string | null>(null);
  const mismatchSignatureRef = useRef<Map<string, string>>(new Map());

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
    [computedCompletionSnapshotData, completionFailedStageLabel]
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
    mismatchSignatureRef,
  });

  const setPendingUserAction = useSetAtom(pendingUserActionAtom);

  return {
    summary,
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
    localStartPending,
    setPendingUserAction,
    nodeIdForLog,
    completionSnapshotData,
    completionFailedStageLabel,
    completionKeyRef,
    mismatchSignatureRef,
    computed,
    resolvedActiveStageId,
    completion,
  };
};
