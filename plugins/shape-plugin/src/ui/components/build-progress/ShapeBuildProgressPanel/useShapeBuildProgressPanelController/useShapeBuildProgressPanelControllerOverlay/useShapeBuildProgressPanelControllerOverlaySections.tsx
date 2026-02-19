import { type ReactNode, useMemo } from 'react';
import type { BuildStage } from '@hierarchidb/components/build-stage';
import type { ShapeBuildProgressPanelControllerBaseResult } from '../useShapeBuildProgressPanelControllerBase.js';
import { BuildProgressStageContent } from '../../BuildProgressStageContent.js';
import { TaskProgressBar } from '../../TaskProgressBar.js';

type StageRecord = Record<string, ReactNode>;

type UseShapeBuildProgressPanelControllerOverlaySectionsResult = {
  stageProgressContent: Record<string, ReactNode>;
  stageContents: Record<string, ReactNode>;
};

export const useShapeBuildProgressPanelControllerOverlaySections = (
  args: ShapeBuildProgressPanelControllerBaseResult,
): UseShapeBuildProgressPanelControllerOverlaySectionsResult => {
  const {
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
  } = args;

  const stageProgressContent = useMemo(() => stages.reduce<StageRecord>((acc: StageRecord, stage: BuildStage) => {
    const stageTasks = tasksByStageForDisplay[stage.id] ?? [];
    acc[stage.id] = (
      <TaskProgressBar
        stages={[stage]}
        tasksByStage={{ [stage.id]: stageTasks }}
        stageTotals={summary.stageTotals}
        buildStatus={summary.buildStatus}
        activeStageId={summary.timingStageId ?? null}
        resolveTaskTitle={resolveTaskTitle}
      />
    );
    return acc;
  }, {} as StageRecord), [resolveTaskTitle, stages, summary.buildStatus, summary.stageTotals, summary.timingStageId, tasksByStageForDisplay]);

  const stageContents = useMemo(() => stages.reduce<StageRecord>((acc: StageRecord, stage: BuildStage) => {
    acc[stage.id] = (
      <BuildProgressStageContent
        stage={stage}
        stageValue={stageProgressForDisplay[stage.id] ?? 0}
        tasksByStage={tasksByStageForDisplay}
        paneProgress={paneProgressForDisplay ?? []}
        isTasksLoading={isTasksLoadingForDisplay}
        isTaskSummaryLoading={isTaskSummaryLoadingForDisplay}
        resolveStatusLabel={resolveStatusLabel}
        resolveStatusColor={resolveStatusColor}
        resolveTaskTitle={resolveTaskTitle}
        t={t}
        matchesSearchQuery={matchesSearchQuery}
        showHeader={false}
      />
    );
    return acc;
  }, {} as StageRecord), [
    isTaskSummaryLoadingForDisplay,
    isTasksLoadingForDisplay,
    paneProgressForDisplay,
    resolveStatusColor,
    resolveStatusLabel,
    matchesSearchQuery,
    resolveTaskTitle,
    stageProgressForDisplay,
    stages,
    t,
    tasksByStageForDisplay,
  ]);

  return {
    stageProgressContent,
    stageContents,
  };
};
