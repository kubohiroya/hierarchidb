import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';
import {
  isShapeBuildPanelDebugEnabled,
  logRunningResiduePanel,
  shouldUpdateElapsedSnapshot,
} from './useBuildProgressPanelState.utils.js';
import { resolveStageAliasArray } from '~/ui/components/build-progress/stageIdAliases';

type StageTask = {
  taskId: string;
  status: string;
};

type StageScan = Record<string, {
  runningCount: number;
  hasRunning: boolean;
}>;

type CompletionData = {
  completionStageLabel: string;
  completionFailedStageLabel: string;
  completionReason: string;
  completionTaskTitle: string;
  completionTaskMessage: string;
  finalStageLabel: string;
  isFinalStageLabel: boolean;
};

type Summary = {
  buildStatus: BuildStatus;
  stageLabel?: string;
  totalElapsedMs: number;
};

type StageDescriptor = {
  id: string;
  title?: string;
};

export const useBuildProgressPanelStateSideEffects = (args: {
  nodeId?: string;
  summary: Summary;
  stages: StageDescriptor[];
  stageTaskScan: StageScan;
  tasksByStage: Record<string, StageTask[]>;
  stageConcurrencyIndicators: Record<string, { isRunning: boolean }>;
  completionSnapshotData: CompletionData;
  activeStageId: string | null;
  setCompletionDialogOpen: (open: boolean) => void;
  setCompletionSnapshot: (snapshot: {
    status: Summary['buildStatus'];
    stageLabel: string;
    taskTitle?: string;
    taskMessage?: string;
    reason?: string;
  } | null) => void;
  completionKeyRef: MutableRefObject<string | null>;
  setElapsedTickMs: (value: number) => void;
  elapsedTickMs: number;
  totalElapsedSnapshot: { durationMs: number; capturedAt: number } | null;
  setTotalElapsedSnapshot: (value: { durationMs: number; capturedAt: number } | null) => void;
  mismatchSignatureRef: MutableRefObject<Map<string, string>>;
}) => {
  const {
    nodeId,
    summary,
    stages,
    stageTaskScan,
    tasksByStage,
    stageConcurrencyIndicators,
    completionSnapshotData,
    activeStageId,
    setCompletionDialogOpen,
    setCompletionSnapshot,
    completionKeyRef,
    setElapsedTickMs,
    elapsedTickMs,
    totalElapsedSnapshot,
    setTotalElapsedSnapshot,
    mismatchSignatureRef,
  } = args;

  const shouldRunElapsedTicker = summary.buildStatus === 'running';
  const previousBuildStatusRef = useRef<Summary['buildStatus'] | null>(null);
  const lastNodeIdRef = useRef<string | undefined>(undefined);
  const hasProgressRef = useRef(false);
  const totalElapsedSnapshotRef = useRef(totalElapsedSnapshot);
  useEffect(() => {
    totalElapsedSnapshotRef.current = totalElapsedSnapshot;
  }, [totalElapsedSnapshot]);
  const isTerminalStatus = (status: Summary['buildStatus'] | null) => status === 'completed' || status === 'failed';

  useEffect(() => {
    if (lastNodeIdRef.current === nodeId) return;
    lastNodeIdRef.current = nodeId;
    hasProgressRef.current = false;
    previousBuildStatusRef.current = null;
    completionKeyRef.current = null;
    setCompletionDialogOpen(false);
    setCompletionSnapshot(null);
  }, [nodeId, completionKeyRef, setCompletionDialogOpen, setCompletionSnapshot]);

  useEffect(() => {
    const previousBuildStatus = previousBuildStatusRef.current;
    const wasTerminal = isTerminalStatus(previousBuildStatus);

    if (previousBuildStatus === null) {
      hasProgressRef.current = summary.buildStatus === 'running' || summary.buildStatus === 'paused';
      setCompletionDialogOpen(false);
      setCompletionSnapshot(null);
      completionKeyRef.current = null;
      previousBuildStatusRef.current = summary.buildStatus;
      return;
    }

    if (summary.buildStatus === 'running' || summary.buildStatus === 'paused') {
      hasProgressRef.current = true;
      completionKeyRef.current = null;
      // Clear stale snapshot when transitioning from idle/terminal to running/paused.
      // Without this, the drift calculation in liveTotalElapsedMs uses a capturedAt
      // from a previous build run, producing absurdly large elapsed values.
      if (previousBuildStatus === 'idle' || isTerminalStatus(previousBuildStatus)) {
        setTotalElapsedSnapshot(null);
      }
      previousBuildStatusRef.current = summary.buildStatus;
      return;
    }

    if (summary.buildStatus !== 'completed' && summary.buildStatus !== 'failed') {
      completionKeyRef.current = null;
      previousBuildStatusRef.current = summary.buildStatus;
      return;
    }

    const canAutoOpen = hasProgressRef.current;
    if (wasTerminal) {
      previousBuildStatusRef.current = summary.buildStatus;
      return;
    }

    if (!canAutoOpen) {
      previousBuildStatusRef.current = summary.buildStatus;
      completionKeyRef.current = null;
      return;
    }

    if (summary.buildStatus === 'completed') {
      if (!completionSnapshotData.isFinalStageLabel) {
        previousBuildStatusRef.current = summary.buildStatus;
        return;
      }
      const key = `${summary.buildStatus}:${completionSnapshotData.completionStageLabel}`;
      if (completionKeyRef.current === key) {
        previousBuildStatusRef.current = summary.buildStatus;
        return;
      }
      completionKeyRef.current = key;
      setCompletionSnapshot({
        status: summary.buildStatus,
        stageLabel: completionSnapshotData.finalStageLabel,
        reason: completionSnapshotData.completionReason,
      });
      setCompletionDialogOpen(true);
      previousBuildStatusRef.current = summary.buildStatus;
      return;
    }

    if (summary.buildStatus === 'failed' && completionSnapshotData.completionTaskMessage) {
      const key = `${summary.buildStatus}:${completionSnapshotData.completionFailedStageLabel}:`
        + `${completionSnapshotData.completionTaskTitle}:${completionSnapshotData.completionTaskMessage}`;
      if (completionKeyRef.current === key) {
        previousBuildStatusRef.current = summary.buildStatus;
        return;
      }
      completionKeyRef.current = key;
      setCompletionSnapshot({
        status: summary.buildStatus,
        stageLabel: completionSnapshotData.completionFailedStageLabel,
        taskTitle: completionSnapshotData.completionTaskTitle,
        taskMessage: completionSnapshotData.completionTaskMessage,
      });
      setCompletionDialogOpen(true);
      previousBuildStatusRef.current = summary.buildStatus;
      return;
    }

    previousBuildStatusRef.current = summary.buildStatus;
  }, [
    completionSnapshotData.completionFailedStageLabel,
    completionSnapshotData.completionReason,
    completionSnapshotData.completionStageLabel,
    completionSnapshotData.completionTaskMessage,
    completionSnapshotData.completionTaskTitle,
    completionSnapshotData.finalStageLabel,
    completionSnapshotData.isFinalStageLabel,
    summary.buildStatus,
    setCompletionDialogOpen,
    setCompletionSnapshot,
    setTotalElapsedSnapshot,
    completionKeyRef,
  ]);

  useEffect(() => {
    setElapsedTickMs(Date.now());
    if (!shouldRunElapsedTicker) {
      return;
    }
    const timerId = window.setInterval(() => {
      setElapsedTickMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timerId);
    };
  }, [setElapsedTickMs, shouldRunElapsedTicker]);

  useEffect(() => {
    if (shouldUpdateElapsedSnapshot({
      snapshot: totalElapsedSnapshotRef.current,
      totalElapsedMs: summary.totalElapsedMs,
      buildStatus: summary.buildStatus,
    })) {
      // Use Date.now() directly instead of elapsedTickMs to avoid stale closure:
      // elapsedTickMs is updated by a separate effect in the same render cycle,
      // so it may still hold the previous tick value when this effect runs.
      setTotalElapsedSnapshot({
        durationMs: summary.totalElapsedMs,
        capturedAt: Date.now(),
      });
    }
  }, [elapsedTickMs, summary.buildStatus, summary.totalElapsedMs, setTotalElapsedSnapshot]);

  useEffect(() => {
    if (!isShapeBuildPanelDebugEnabled('runningResiduePanel')) return;
    const nextSignatures = new Map<string, string>();
    const previousSignatures = mismatchSignatureRef.current;
    const nodeIdForLog = nodeId ? String(nodeId) : null;
    stages.forEach((stage) => {
      const scan = stageTaskScan[stage.id];
      const indicator = stageConcurrencyIndicators?.[stage.id];
      const runningCount = scan?.runningCount ?? 0;
      const indicatorIsRunning = Boolean(indicator?.isRunning);
      const reasons: string[] = [];
      if (summary.buildStatus === 'running' && indicatorIsRunning !== (runningCount > 0)) {
        reasons.push('indicator_running_mismatch');
      }
      if (summary.buildStatus !== 'running' && runningCount > 0) {
        reasons.push('running_while_build_not_running');
      }
      if (summary.buildStatus === 'running' && runningCount > 0 && activeStageId !== stage.id) {
        reasons.push('running_stage_not_active');
      }
      if (summary.buildStatus === 'running' && activeStageId === stage.id && runningCount === 0) {
        reasons.push('active_stage_without_running_task');
      }
      if (reasons.length === 0) {
        if (previousSignatures.has(stage.id)) {
          logRunningResiduePanel('UI_MISMATCH_RESOLVED', {
            nodeId: nodeIdForLog,
            stage: stage.id,
            buildStatus: summary.buildStatus,
            activeStageId,
            indicatorIsRunning,
            runningCount,
            runningTaskIds: [],
            reasons: ['resolved'],
          });
        }
        return;
      }
      const runningTaskIds = resolveStageAliasArray(tasksByStage, stage.id)
        .filter((task) => task.status === 'running')
        .slice(0, 8)
        .map((task) => task.taskId);
      const signature = [
        summary.buildStatus,
        activeStageId ?? '-',
        runningCount,
        indicatorIsRunning ? '1' : '0',
        reasons.join('|'),
        runningTaskIds.join('|'),
      ].join('::');
      nextSignatures.set(stage.id, signature);
      if (previousSignatures.get(stage.id) === signature) return;
      logRunningResiduePanel('UI_MISMATCH', {
        nodeId: nodeIdForLog,
        stage: stage.id,
        buildStatus: summary.buildStatus,
        activeStageId,
        indicatorIsRunning,
        runningCount,
        runningTaskIds,
        reasons,
      });
    });
    mismatchSignatureRef.current = nextSignatures;
  }, [
    activeStageId,
    nodeId,
    stageConcurrencyIndicators,
    stageTaskScan,
    stages,
    summary.buildStatus,
    tasksByStage,
    mismatchSignatureRef,
  ]);

  useEffect(() => () => {
    mismatchSignatureRef.current = new Map<string, string>();
  }, [mismatchSignatureRef]);
};
