import type { BuildStage } from '@hierarchidb/ui-build-progress/build-stage';
import { type ReactNode } from 'react';
import type { ShapeBuildProgressPanelControllerBaseResult } from '~/ui/components/build-progress/ShapeBuildProgressPanel/useShapeBuildProgressPanelController/base/useShapeBuildProgressPanelControllerBase';
import {
  resolveStageAliasArray,
  resolveStageAliasValue,
} from '~/ui/components/build-progress/stageIdAliases';
import {
  ShapeBuildProgressPanelOverlaySectionContent,
  ShapeBuildProgressPanelOverlaySectionProgressContent,
} from './ShapeBuildProgressPanelControllerOverlaySectionsView.js';

type StageRecord = Record<string, ReactNode>;

export type UseShapeBuildProgressPanelControllerOverlaySectionsArgs =
  ShapeBuildProgressPanelControllerBaseResult;

type UseShapeBuildProgressPanelControllerOverlaySectionsResult = {
  stageProgressContent: StageRecord;
  stageContents: StageRecord;
};

export type StageProgressContentArgs = {
  summary: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['summary'];
  resolveTaskTitle: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['resolveTaskTitle'];
  stage: BuildStage;
  stageTasks: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['tasksByStageForDisplay'][string];
};

export type StageContentArgs = {
  stage: BuildStage;
  stageValue: number;
  paneProgress: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['paneProgressForDisplay'];
  tasksByStageForDisplay: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['tasksByStageForDisplay'];
  isTasksLoadingForDisplay: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['isTasksLoadingForDisplay'];
  isTaskSummaryLoadingForDisplay: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['isTaskSummaryLoadingForDisplay'];
  isStartupPendingForDisplay: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['isStartupPendingForDisplay'];
  summary: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['summary'];
  resolveStatusLabel: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['resolveStatusLabel'];
  resolveStatusColor: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['resolveStatusColor'];
  resolveTaskTitle: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['resolveTaskTitle'];
  t: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['t'];
  matchesSearchQuery: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['matchesSearchQuery'];
  isDetailFloatingWindowOpen: boolean;
  isOpeningPending?: boolean;
  buildConfig: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['buildConfigForDisplay'];
  onOpenDetailFloatingWindow: () => void;
  onCloseDetailFloatingWindow: () => void;
  floatingWindowZIndex: number;
  onRequestBringFloatingWindowToFront: () => void;
};

const ShapeBuildProgressPanelStageProgressContent = ({
  summary,
  resolveTaskTitle,
  stage,
  stageTasks,
}: StageProgressContentArgs): ReactNode =>
  ShapeBuildProgressPanelOverlaySectionProgressContent({
    summary,
    resolveTaskTitle,
    stage,
    stageTasks,
  });

const ShapeBuildProgressPanelStageContent = ({
  paneProgress,
  stage,
  stageValue,
  tasksByStageForDisplay,
  isTasksLoadingForDisplay,
  isTaskSummaryLoadingForDisplay,
  isStartupPendingForDisplay,
  summary,
  resolveStatusLabel,
  resolveStatusColor,
  resolveTaskTitle,
  t,
  matchesSearchQuery,
  isDetailFloatingWindowOpen,
  buildConfig,
  onOpenDetailFloatingWindow,
  onCloseDetailFloatingWindow,
  floatingWindowZIndex,
  onRequestBringFloatingWindowToFront,
  isOpeningPending = false,
}: StageContentArgs): ReactNode =>
  ShapeBuildProgressPanelOverlaySectionContent({
    paneProgress,
    stage,
    stageValue,
    tasksByStageForDisplay,
    isTasksLoadingForDisplay,
    isTaskSummaryLoadingForDisplay,
    isStartupPendingForDisplay,
    summary,
    resolveStatusLabel,
    resolveStatusColor,
    resolveTaskTitle,
    t,
    matchesSearchQuery,
    isDetailFloatingWindowOpen,
    isOpeningPending,
    buildConfig,
    onOpenDetailFloatingWindow,
    onCloseDetailFloatingWindow,
    floatingWindowZIndex,
    onRequestBringFloatingWindowToFront,
  });

export const useShapeBuildProgressPanelControllerOverlaySections = ({
  stages,
  stageProgressForDisplay,
  tasksByStageForDisplay,
  summary,
  paneProgressForDisplay,
  isTasksLoadingForDisplay,
  isTaskSummaryLoadingForDisplay,
  isStartupPendingForDisplay,
  resolveStatusLabel,
  resolveStatusColor,
  resolveTaskTitle,
  t,
  matchesSearchQuery,
  stagePreviewWindowOpenMap,
  stagePreviewWindowPendingMap,
  stagePreviewWindowZIndexMap,
  openStagePreviewWindow,
  bringStagePreviewWindowToFront,
  closeStagePreviewWindow,
  buildConfigForDisplay,
}: UseShapeBuildProgressPanelControllerOverlaySectionsArgs): UseShapeBuildProgressPanelControllerOverlaySectionsResult => {
  const stageProgressContent = stages.reduce<StageRecord>((acc: StageRecord, stage: BuildStage) => {
    const stageTasks = resolveStageAliasArray(tasksByStageForDisplay, stage.id);
    acc[stage.id] = ShapeBuildProgressPanelStageProgressContent({
      summary,
      resolveTaskTitle,
      stage,
      stageTasks,
    });
    return acc;
  }, {} as StageRecord);

  const stageContents = stages.reduce<StageRecord>((acc: StageRecord, stage: BuildStage) => {
    acc[stage.id] = ShapeBuildProgressPanelStageContent({
      stage,
      stageValue: resolveStageAliasValue(stageProgressForDisplay, stage.id) ?? 0,
      paneProgress: paneProgressForDisplay,
      tasksByStageForDisplay,
      isTasksLoadingForDisplay,
      isTaskSummaryLoadingForDisplay,
      isStartupPendingForDisplay,
      summary,
      resolveStatusLabel,
      resolveStatusColor,
      resolveTaskTitle,
      t,
      matchesSearchQuery,
      isDetailFloatingWindowOpen: (stagePreviewWindowOpenMap[stage.id] ?? true) === false,
      onOpenDetailFloatingWindow: () => openStagePreviewWindow(stage.id),
      onCloseDetailFloatingWindow: () => closeStagePreviewWindow(stage.id),
      floatingWindowZIndex: stagePreviewWindowZIndexMap[stage.id] ?? 1,
      onRequestBringFloatingWindowToFront: () => bringStagePreviewWindowToFront(stage.id),
      isOpeningPending: Boolean(stagePreviewWindowPendingMap[stage.id]),
      buildConfig: buildConfigForDisplay,
    });
    return acc;
  }, {} as StageRecord);

  return {
    stageProgressContent,
    stageContents,
  };
};
