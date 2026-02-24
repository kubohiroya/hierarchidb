import { type ReactElement } from 'react';
import type { BuildStage } from '@hierarchidb/components/build-stage';
import type { UseShapeBuildProgressPanelControllerOverlaySectionsArgs } from './useShapeBuildProgressPanelControllerOverlaySections.js';
import { TaskProgressBar } from '~/ui/components/build-progress/ShapeBuildProgressPanel/TaskProgressBar/TaskProgressBar.js';
import { BuildProgressStageContent } from '~/ui/components/build-progress/ShapeBuildProgressPanel/BuildProgressStageContent/BuildProgressStageContent.js';

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

export const ShapeBuildProgressPanelOverlaySectionProgressContent = ({
  summary,
  resolveTaskTitle,
  stage,
  stageTasks,
}: StageProgressContentArgs): ReactElement => (
  <TaskProgressBar
    stages={[stage]}
    tasksByStage={{ [stage.id]: stageTasks }}
    stageTotals={summary.stageTotals}
    buildStatus={summary.buildStatus}
    activeStageId={summary.timingStageId ?? null}
    resolveTaskTitle={resolveTaskTitle}
  />
);

export const ShapeBuildProgressPanelOverlaySectionContent = ({
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
}: StageContentArgs): ReactElement => (
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
