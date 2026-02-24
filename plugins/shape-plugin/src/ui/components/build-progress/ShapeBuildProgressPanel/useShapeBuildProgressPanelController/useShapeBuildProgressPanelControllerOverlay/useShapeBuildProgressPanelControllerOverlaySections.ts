import { type ReactNode } from 'react';
import type { BuildStage } from '@hierarchidb/components/build-stage';
import type { ShapeBuildProgressPanelControllerBaseResult } from '~/ui/components/build-progress/ShapeBuildProgressPanel/useShapeBuildProgressPanelController/base/useShapeBuildProgressPanelControllerBaseState';
import {
  ShapeBuildProgressPanelOverlaySectionContent,
  ShapeBuildProgressPanelOverlaySectionProgressContent,
} from './useShapeBuildProgressPanelControllerOverlaySectionsView.js';

type StageRecord = Record<string, ReactNode>;

export type UseShapeBuildProgressPanelControllerOverlaySectionsArgs = ShapeBuildProgressPanelControllerBaseResult;

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
  summary: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['summary'];
  resolveStatusLabel: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['resolveStatusLabel'];
  resolveStatusColor: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['resolveStatusColor'];
  resolveTaskTitle: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['resolveTaskTitle'];
  t: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['t'];
  matchesSearchQuery: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['matchesSearchQuery'];
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
  summary,
  resolveStatusLabel,
  resolveStatusColor,
  resolveTaskTitle,
  t,
  matchesSearchQuery,
}: StageContentArgs): ReactNode =>
  ShapeBuildProgressPanelOverlaySectionContent({
    paneProgress,
    stage,
    stageValue,
    tasksByStageForDisplay,
    isTasksLoadingForDisplay,
    isTaskSummaryLoadingForDisplay,
    summary,
    resolveStatusLabel,
    resolveStatusColor,
    resolveTaskTitle,
    t,
    matchesSearchQuery,
  });

export const useShapeBuildProgressPanelControllerOverlaySections = ({
  stages,
  stageProgressForDisplay,
  tasksByStageForDisplay,
  summary,
  paneProgressForDisplay,
  isTasksLoadingForDisplay,
  isTaskSummaryLoadingForDisplay,
  resolveStatusLabel,
  resolveStatusColor,
  resolveTaskTitle,
  t,
  matchesSearchQuery,
}: UseShapeBuildProgressPanelControllerOverlaySectionsArgs): UseShapeBuildProgressPanelControllerOverlaySectionsResult => {
  const stageProgressContent = stages.reduce<StageRecord>((acc: StageRecord, stage: BuildStage) => {
    const stageTasks = tasksByStageForDisplay[stage.id] ?? [];
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
      stageValue: stageProgressForDisplay[stage.id] ?? 0,
      paneProgress: paneProgressForDisplay,
      tasksByStageForDisplay,
      isTasksLoadingForDisplay,
      isTaskSummaryLoadingForDisplay,
      summary,
      resolveStatusLabel,
      resolveStatusColor,
      resolveTaskTitle,
      t,
      matchesSearchQuery,
    });
    return acc;
  }, {} as StageRecord);

  return {
    stageProgressContent,
    stageContents,
  };
};
