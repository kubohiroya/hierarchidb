import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import type { NodeId } from '@hierarchidb/common-types';
import type { ShapeDialogStepProps } from './ShapeDialogStepProps.ts';
import { useShapeBuildProgressStep } from '../../hooks/useShapeBuildProgressStep.js';
import {
  shapeBuildBuildStatusAtom,
  shapeBuildPaneProgressAtom,
  shapeBuildProgressAuthAtom,
  shapeBuildProgressControlsAtom,
  shapeBuildProgressSummaryAtom,
  shapeBuildTaskSummaryLoadingAtom,
  shapeBuildTasksByStageAtom,
  shapeBuildWarningMessageAtom,
  shapeBuildStageProgressAtom,
  shapeBuildStagesAtom,
} from '../../state/shapeBuildProgressAtoms.js';

export const ShapeBuildProgressAtomSync = ({
  data,
  onChange,
  nodeId,
}: ShapeDialogStepProps) => {
  const resolvedNodeId = nodeId as NodeId | undefined;
  const {
    stages,
    stageProgress,
    paneProgress,
    tasksByStage,
    buildStatus,
    overallProgress,
    stageLabel,
    taskLabel,
    statusLabel,
    completed,
    total,
    failed,
    skipped,
    hasProgressData,
    isTaskSummaryLoading,
    warningMessage,
    canStartOrResume,
    handleStartOrResume,
    handlePause,
    authDialogOpen,
    closeAuthDialog,
    handleProviderSelect,
  } = useShapeBuildProgressStep({ data, onChange, nodeId: resolvedNodeId });

  const setStages = useSetAtom(shapeBuildStagesAtom);
  const setStageProgress = useSetAtom(shapeBuildStageProgressAtom);
  const setPaneProgress = useSetAtom(shapeBuildPaneProgressAtom);
  const setTasksByStage = useSetAtom(shapeBuildTasksByStageAtom);
  const setBuildStatus = useSetAtom(shapeBuildBuildStatusAtom);
  const setSummary = useSetAtom(shapeBuildProgressSummaryAtom);
  const setTaskSummaryLoading = useSetAtom(shapeBuildTaskSummaryLoadingAtom);
  const setWarningMessage = useSetAtom(shapeBuildWarningMessageAtom);
  const setControls = useSetAtom(shapeBuildProgressControlsAtom);
  const setAuth = useSetAtom(shapeBuildProgressAuthAtom);

  useEffect(() => {
    setStages(stages);
  }, [setStages, stages]);

  useEffect(() => {
    setStageProgress(stageProgress);
  }, [setStageProgress, stageProgress]);

  useEffect(() => {
    setPaneProgress(paneProgress ?? []);
  }, [setPaneProgress, paneProgress]);

  useEffect(() => {
    setTasksByStage(tasksByStage);
  }, [setTasksByStage, tasksByStage]);

  useEffect(() => {
    setBuildStatus(buildStatus);
  }, [buildStatus, setBuildStatus]);

  useEffect(() => {
    setSummary({
      stageLabel,
      taskLabel,
      overallProgress,
      completed,
      total,
      failed,
      skipped,
      buildStatus,
      hasProgressData,
    });
  }, [
    buildStatus,
    completed,
    failed,
    hasProgressData,
    overallProgress,
    skipped,
    stageLabel,
    taskLabel,
    total,
    setSummary,
  ]);

  useEffect(() => {
    setTaskSummaryLoading(isTaskSummaryLoading);
  }, [isTaskSummaryLoading, setTaskSummaryLoading]);

  useEffect(() => {
    setWarningMessage(warningMessage ?? null);
  }, [setWarningMessage, warningMessage]);

  useEffect(() => {
    setControls({
      canStartOrResume,
      statusLabel: statusLabel ?? '',
      handleStartOrResume,
      handlePause,
    });
  }, [
    canStartOrResume,
    handlePause,
    handleStartOrResume,
    setControls,
    statusLabel,
  ]);

  useEffect(() => {
    setAuth({
      authDialogOpen: Boolean(authDialogOpen),
      closeAuthDialog: closeAuthDialog ?? (() => {}),
      handleProviderSelect: handleProviderSelect ?? (() => {}),
    });
  }, [authDialogOpen, closeAuthDialog, handleProviderSelect, setAuth]);

  return null;
};
