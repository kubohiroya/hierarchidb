import { useMemo, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import { useAtomValue } from 'jotai';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { useBuildCrashInsight } from '~/ui/components/build-progress/useBuildCrashInsight/useBuildCrashInsight';
import type { BuildStatus } from '@hierarchidb/components/build-status';
import type { BuildStage } from '@hierarchidb/components/build-stage';
import type { PaneProgress } from '@hierarchidb/ui-lru-splitview';
import type { ShapeEntity } from '~/common/types/ShapeEntity';
import {
  taskProgressControlsAtom,
  buildStageProgressAtom,
  buildStagesAtom,
  taskPaneProgressAtom,
  crashSuspectMessageAtom,
  crashSuspectOpenAtom,
  crashSuspectControlsAtom,
  suspendSuspectMessageAtom,
  suspendSuspectOpenAtom,
  suspendSuspectControlsAtom,
  taskWarningMessageAtom,
  tasksLoadingAtom,
  taskSummaryLoadingAtom,
  tasksByStageAtom,
  taskProgressSummaryAtom,
} from '~/ui/atoms/shapeBuildProgressAtoms';
import type {
  ShapeBuildTaskSummary,
  TaskProgressControls,
  TaskProgressSummary,
} from '~/ui/atoms/shapeBuildProgressAtoms';
import { useBuildProgressPanelStateComputed } from './useBuildProgressPanelStateComputed.js';
import type { BuildProgressPanelStateComputed } from './useBuildProgressPanelStateComputed.js';
import { resolveCompletionFailedStageLabel, resolveActiveRunningStageId } from './useBuildProgressPanelState.utils.js';
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
  completionSnapshot: {
    status: BuildStatus;
    stageLabel: string;
    taskTitle?: string;
    taskMessage?: string;
    reason?: string;
  } | null;
  setCompletionSnapshot: (snapshot: {
    status: BuildStatus;
    stageLabel: string;
    taskTitle?: string;
    taskMessage?: string;
    reason?: string;
  } | null) => void;
  elapsedTickMs: number;
  setElapsedTickMs: (next: number) => void;
  localStartPending: boolean;
  localStartPendingRef: { current: boolean };
  setLocalStartPending: (next: boolean) => void;
  nodeIdForLog: string | undefined;
  completionSnapshotData: BuildProgressPanelStateComputed['completionSnapshotData'];
  completionFailedStageLabel: string;
  completionKeyRef: { current: string | null };
  totalElapsedSnapshotRef: { current: { elapsedMs: number; capturedAt: number } | null };
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
  const { t } = useTranslation();

  const stages = useAtomValue(buildStagesAtom);
  const stageProgress = useAtomValue(buildStageProgressAtom);
  const paneProgress = useAtomValue(taskPaneProgressAtom);
  const isTasksLoading = useAtomValue(tasksLoadingAtom);
  const isTaskSummaryLoading = useAtomValue(taskSummaryLoadingAtom);
  const tasksByStage = useAtomValue(tasksByStageAtom);
  const summary = useAtomValue(taskProgressSummaryAtom);
  const controls = useAtomValue(taskProgressControlsAtom);
  const warningMessage = useAtomValue(taskWarningMessageAtom);
  const crashSuspectMessage = useAtomValue(crashSuspectMessageAtom);
  const crashSuspectOpen = useAtomValue(crashSuspectOpenAtom);
  const crashSuspectControls = useAtomValue(crashSuspectControlsAtom);
  const suspendSuspectMessage = useAtomValue(suspendSuspectMessageAtom);
  const suspendSuspectOpen = useAtomValue(suspendSuspectOpenAtom);
  const suspendSuspectControls = useAtomValue(suspendSuspectControlsAtom);

  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [completionSnapshot, setCompletionSnapshot] = useState<{
    status: BuildStatus;
    stageLabel: string;
    taskTitle?: string;
    taskMessage?: string;
    reason?: string;
  } | null>(null);
  const [localStartPending, setLocalStartPending] = useState(false);
  const localStartPendingRef = useRef(false);
  const [elapsedTickMs, setElapsedTickMs] = useState(() => Date.now());
  const completionKeyRef = useRef<string | null>(null);
  const totalElapsedSnapshotRef = useRef<{ elapsedMs: number; capturedAt: number } | null>(null);
  const mismatchSignatureRef = useRef<Map<string, string>>(new Map());
  const snapshotNodeIdRef = useRef<string | undefined>(undefined);

  const completion = useBuildCrashInsight({
    draft: params.data,
    nodeId: nodeIdForLog,
    status: summary.buildStatus,
  });

  const hasInFlightOrQueuedTasks = useMemo(() => {
    return Object.values(tasksByStage).some((tasks) =>
      tasks.some((task) => task.status === 'running' || task.status === 'queued'),
    );
  }, [tasksByStage]);

  const computed = useBuildProgressPanelStateComputed({
    data: params.data,
    summary,
    t,
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
    totalElapsedSnapshotRef,
    mismatchSignatureRef,
  });

  if (nodeIdForLog !== snapshotNodeIdRef.current) {
    snapshotNodeIdRef.current = nodeIdForLog;
    totalElapsedSnapshotRef.current = null;
  }

  const liveTotalElapsedMs = useMemo(() => {
    const snapshot = totalElapsedSnapshotRef.current;
    if (!snapshot) {
      return summary.totalElapsedMs;
    }
    if ((summary.buildStatus === 'running' && hasInFlightOrQueuedTasks) || summary.buildStatus === 'paused') {
      const drift = Math.max(0, elapsedTickMs - snapshot.capturedAt);
      return snapshot.elapsedMs + drift;
    }
    if (summary.totalElapsedMs > snapshot.elapsedMs) {
      return summary.totalElapsedMs;
    }
    return snapshot.elapsedMs;
  }, [elapsedTickMs, hasInFlightOrQueuedTasks, summary.buildStatus, summary.totalElapsedMs]);

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
    localStartPendingRef,
    setLocalStartPending,
    nodeIdForLog,
    completionSnapshotData,
    completionFailedStageLabel,
    completionKeyRef,
    totalElapsedSnapshotRef,
    mismatchSignatureRef,
    liveTotalElapsedMs,
    computed,
    resolvedActiveStageId,
    completion,
  };
};
