import { useMemo } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import { useTranslation } from '~/ui/useTranslation';
import type { ShapeEntity } from '~/common/types/ShapeEntity';
import { useBuildProgressPanelStateActions } from './useBuildProgressPanelStateActions.js';
import { useBuildProgressPanelStateRuntimeState } from './useBuildProgressPanelStateRuntimeState.js';
import { useShapeBuildProgressWarnings } from './useShapeBuildProgressWarnings.js';
import { isDev, logStartResumeTrace } from './useBuildProgressPanelState.utils.js';

export const useBuildProgressPanelState = (params: {
  data?: Partial<ShapeEntity>;
  nodeId?: NodeId;
}) => {
  const runtimeState = useBuildProgressPanelStateRuntimeState(params);
  const { t } = useTranslation();

  const {
    nodeIdForLog,
    stages,
    summary,
    controls,
    warningMessage,
    computed,
    resolvedActiveStageId,
    localStartPending,
    setLocalStartPending,
    localStartPendingRef,
    completionSnapshot,
    setCompletionSnapshot,
    completionDialogOpen,
    setCompletionDialogOpen,
    completionSnapshotData,
    completion,
  } = runtimeState;

  const {
    startWarning,
    crashHint,
    warningDialogOpen,
    setWarningDialogOpen,
    crashHintOpen,
    setCrashHintOpen,
    sizeWarningOpen,
    setSizeWarningOpen,
  } = useShapeBuildProgressWarnings({
    crashInsight: completion,
    data: params.data,
    stages,
    warningMessage,
    isDev,
    t,
  });

  const { mergedControls, handleStartClick, handleConfirmStart } = useBuildProgressPanelStateActions({
    resolvedNodeId: runtimeState.nodeIdForLog ? runtimeState.nodeIdForLog as NodeId : undefined,
    buildStatus: summary.buildStatus,
    startWarning: Boolean(startWarning),
    warningMessage,
    controls,
    localStartPending,
    setWarningDialogOpen,
    setLocalStartPending,
    localStartPendingRef,
  });

  useMemo(() => {
    if (nodeIdForLog) {
      logStartResumeTrace('useBuildProgressPanelState render', {
        nodeId: nodeIdForLog ?? null,
        buildStatus: summary.buildStatus,
        activeStageId: resolvedActiveStageId,
        localStartPending,
      });
    }
    return null;
  }, [nodeIdForLog, summary.buildStatus, resolvedActiveStageId, localStartPending]);

  return {
    t,
    stages,
    stageProgress: runtimeState.stageProgress,
    paneProgress: runtimeState.paneProgress,
    isTasksLoading: runtimeState.isTasksLoading,
    isTaskSummaryLoading: runtimeState.isTaskSummaryLoading,
    taskListViewPhase: runtimeState.taskListViewPhase,
    tasksByStage: runtimeState.tasksByStage,
    summary: {
      ...runtimeState.summary,
      totalElapsedMs: runtimeState.summary.totalElapsedMs,
    },
    controls: mergedControls,
    warningMessage,
    activeStageId: resolvedActiveStageId,
    startWarning,
    crashHint,
    warningDialogOpen,
    setWarningDialogOpen,
    crashHintOpen,
    setCrashHintOpen,
    sizeWarningOpen,
    setSizeWarningOpen,
    crashSuspectMessage: runtimeState.crashSuspectMessage,
    crashSuspectOpen: runtimeState.crashSuspectOpen,
    crashSuspectControls: runtimeState.crashSuspectControls,
    suspendSuspectMessage: runtimeState.suspendSuspectMessage,
    suspendSuspectOpen: runtimeState.suspendSuspectOpen,
    suspendSuspectControls: runtimeState.suspendSuspectControls,
    completionDialogOpen,
    setCompletionDialogOpen,
    completionSnapshot,
    completionStageLabel: completionSnapshotData.completionStageLabel,
    completionTaskTitle: completionSnapshotData.completionTaskTitle,
    completionTaskMessage: completionSnapshotData.completionTaskMessage,
    completionReason: completionSnapshotData.completionReason,
    finalStageLabel: completionSnapshotData.finalStageLabel,
    resolveTaskTitle: computed.resolveTaskTitle,
    resolveStatusLabel: computed.resolveStatusLabel,
    resolveStatusColor: computed.resolveStatusColor,
    controlDetails: computed.controlDetails,
    resolveStageValue: computed.resolveStageValue,
    stageConcurrencyIndicators: computed.stageConcurrencyIndicators,
    handleStartClick,
    handleConfirmStart,
    setCompletionSnapshot,
    completionKeyRef: runtimeState.completionKeyRef,
    totalElapsedSnapshotRef: runtimeState.totalElapsedSnapshotRef,
    mismatchSignatureRef: runtimeState.mismatchSignatureRef,
    completion,
  };
};

export {
  shouldUpdateElapsedSnapshot,
  resolveCompletionFailedStageLabel,
  resolveActiveRunningStageId,
  isDev,
  logStartResumeTrace,
} from './useBuildProgressPanelState.utils.js';
