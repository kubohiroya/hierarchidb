import { useEffect, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import type { BuildStatus } from '@hierarchidb/components/build-status';
import { isDev, logRunningResiduePanel, shouldUpdateElapsedSnapshot } from './useBuildProgressPanelState.utils.js';

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
  totalElapsedSnapshotRef: MutableRefObject<{ elapsedMs: number; capturedAt: number } | null>;
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
    totalElapsedSnapshotRef,
    mismatchSignatureRef,
  } = args;

  const hasInFlightOrQueuedTasks = useMemo(() => {
    return Object.values(tasksByStage).some((tasks) =>
      tasks.some((task) => task.status === 'running' || task.status === 'queued'),
    );
  }, [tasksByStage]);

  const shouldRunElapsedTicker = summary.buildStatus === 'running' && hasInFlightOrQueuedTasks;

  useEffect(() => {
    if (summary.buildStatus === 'completed') {
      if (!completionSnapshotData.isFinalStageLabel) return;
      const key = `${summary.buildStatus}:${completionSnapshotData.completionStageLabel}`;
      if (completionKeyRef.current === key) return;
      completionKeyRef.current = key;
      setCompletionSnapshot({
        status: summary.buildStatus,
        stageLabel: completionSnapshotData.finalStageLabel,
        reason: completionSnapshotData.completionReason,
      });
      setCompletionDialogOpen(true);
      return;
    }
    if (summary.buildStatus === 'failed' && completionSnapshotData.completionTaskMessage) {
      const key = `${summary.buildStatus}:${completionSnapshotData.completionFailedStageLabel}:`
        + `${completionSnapshotData.completionTaskTitle}:${completionSnapshotData.completionTaskMessage}`;
      if (completionKeyRef.current === key) return;
      completionKeyRef.current = key;
      setCompletionSnapshot({
        status: summary.buildStatus,
        stageLabel: completionSnapshotData.completionFailedStageLabel,
        taskTitle: completionSnapshotData.completionTaskTitle,
        taskMessage: completionSnapshotData.completionTaskMessage,
      });
      setCompletionDialogOpen(true);
      return;
    }
    completionKeyRef.current = null;
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
      totalElapsedSnapshotRef.current = {
        elapsedMs: summary.totalElapsedMs,
        capturedAt: elapsedTickMs,
      };
    }
  }, [elapsedTickMs, summary.buildStatus, summary.totalElapsedMs, totalElapsedSnapshotRef]);

  useEffect(() => {
    if (!isDev) return;
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
      const runningTaskIds = (tasksByStage[stage.id] ?? [])
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
