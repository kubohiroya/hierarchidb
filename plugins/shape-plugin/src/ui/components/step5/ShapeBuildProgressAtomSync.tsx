import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import type { NodeId } from '@hierarchidb/common-types';
import type { ShapeDialogStepProps } from '../ShapeDialogStepProps.ts';
import { useShapeBuildStep } from './useShapeBuildStep.js';
import {
  taskStatusAtom,
  taskPaneProgressAtom,
  taskProgressAuthAtom,
  taskProgressControlsAtom,
  taskProgressSummaryAtom,
  taskSummaryLoadingAtom,
  tasksByStageAtom,
  taskWarningMessageAtom,
  buildStageProgressAtom,
  buildStagesAtom,
} from '../../atoms/shapeBuildProgressAtoms.js';

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
    taskUnitLabel,
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
  } = useShapeBuildStep({ data, onChange, nodeId: resolvedNodeId });

  const setStages = useSetAtom(buildStagesAtom);
  const setStageProgress = useSetAtom(buildStageProgressAtom);
  const setPaneProgress = useSetAtom(taskPaneProgressAtom);
  const setTasksByStage = useSetAtom(tasksByStageAtom);
  const setBuildStatus = useSetAtom(taskStatusAtom);
  const setSummary = useSetAtom(taskProgressSummaryAtom);
  const setTaskSummaryLoading = useSetAtom(taskSummaryLoadingAtom);
  const setWarningMessage = useSetAtom(taskWarningMessageAtom);
  const setControls = useSetAtom(taskProgressControlsAtom);
  const setAuth = useSetAtom(taskProgressAuthAtom);

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
      taskUnitLabel,
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
