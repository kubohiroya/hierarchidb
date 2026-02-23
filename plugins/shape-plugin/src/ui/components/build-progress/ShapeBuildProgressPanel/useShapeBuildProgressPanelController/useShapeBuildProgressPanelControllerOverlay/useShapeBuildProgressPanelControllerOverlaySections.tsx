import type { ReactNode } from 'react';
import type { BuildStage } from '@hierarchidb/components/build-stage';
import type { ShapeBuildProgressPanelControllerBaseResult } from '~/ui/components/build-progress/ShapeBuildProgressPanel/useShapeBuildProgressPanelController/base/useShapeBuildProgressPanelControllerBaseState';
import { TaskProgressBar } from '~/ui/components/build-progress/ShapeBuildProgressPanel/TaskProgressBar/TaskProgressBar';
import { BuildProgressStageContent } from '~/ui/components/build-progress/ShapeBuildProgressPanel/BuildProgressStageContent/BuildProgressStageContent';

type StageRecord = Record<string, ReactNode>;
type UseShapeBuildProgressPanelControllerOverlaySectionsArgs = ShapeBuildProgressPanelControllerBaseResult;

type UseShapeBuildProgressPanelControllerOverlaySectionsResult = {
  stageProgressContent: StageRecord;
  stageContents: StageRecord;
};

type StageProgressContentArgs = {
  summary: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['summary'];
  resolveTaskTitle: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['resolveTaskTitle'];
  stage: BuildStage;
  stageTasks: UseShapeBuildProgressPanelControllerOverlaySectionsArgs['tasksByStageForDisplay'][string];
};

type StageContentArgs = {
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

export const renderShapeBuildProgressPanelStageProgressContent = ({
  summary,
  resolveTaskTitle,
  stage,
  stageTasks,
}: StageProgressContentArgs): ReactNode => (
  <TaskProgressBar
    stages={[stage]}
    tasksByStage={{ [stage.id]: stageTasks }}
    stageTotals={summary.stageTotals}
    buildStatus={summary.buildStatus}
    activeStageId={summary.timingStageId ?? null}
    resolveTaskTitle={resolveTaskTitle}
  />
);

export const renderShapeBuildProgressPanelStageContent = ({
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
}: StageContentArgs): ReactNode => (
  <BuildProgressStageContent
    stage={stage}
    stageValue={stageValue}
    tasksByStage={tasksByStageForDisplay}
    paneProgress={paneProgress ?? []}
    isTasksLoading={isTasksLoadingForDisplay}
    isTaskSummaryLoading={isTaskSummaryLoadingForDisplay}
    buildStatus={summary.buildStatus}
    resolveStatusLabel={resolveStatusLabel}
    resolveStatusColor={resolveStatusColor}
    resolveTaskTitle={resolveTaskTitle}
    t={t}
    matchesSearchQuery={matchesSearchQuery}
    showHeader={false}
  />
);

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
    acc[stage.id] = renderShapeBuildProgressPanelStageProgressContent({
      summary,
      resolveTaskTitle,
      stage,
      stageTasks,
    });
    return acc;
  }, {} as StageRecord);

  const stageContents = stages.reduce<StageRecord>((acc: StageRecord, stage: BuildStage) => {
    acc[stage.id] = renderShapeBuildProgressPanelStageContent({
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
