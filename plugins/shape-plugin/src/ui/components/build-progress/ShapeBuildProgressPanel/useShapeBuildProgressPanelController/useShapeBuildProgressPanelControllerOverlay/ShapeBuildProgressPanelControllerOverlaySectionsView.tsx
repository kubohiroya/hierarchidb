import type { ReactElement } from 'react';
import { BuildSessionStageCard } from '~/ui/components/build-progress/ShapeBuildProgressPanel/BuildSessionStageCard/BuildSessionStageCard.js';
import { BuildSessionStageProgressBar } from '~/ui/components/build-progress/ShapeBuildProgressPanel/BuildSessionStageProgressBar/BuildSessionStageProgressBar.js';
import type {
  StageContentArgs,
  StageProgressContentArgs,
} from './useShapeBuildProgressPanelControllerOverlaySections.js';

export const ShapeBuildProgressPanelOverlaySectionProgressContent = ({
  summary,
  resolveTaskTitle,
  stage,
  stageTasks,
}: StageProgressContentArgs): ReactElement => (
  <BuildSessionStageProgressBar
    stages={[stage]}
    tasksByStage={{ [stage.id]: stageTasks }}
    stageTotals={summary?.stageTotals}
    buildStatus={summary?.buildStatus ?? 'waiting'}
    activeStageId={stage.id}
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
  isStartupPendingForDisplay,
  summary,
  resolveStatusLabel,
  resolveStatusColor,
  resolveTaskTitle,
  t,
  matchesSearchQuery,
  isDetailFloatingWindowOpen,
  isOpeningPending = false,
  buildConfig,
  onOpenDetailFloatingWindow,
  onCloseDetailFloatingWindow,
  floatingWindowZIndex,
  onRequestBringFloatingWindowToFront,
}: StageContentArgs): ReactElement => (
  <BuildSessionStageCard
    stage={stage}
    stageValue={stageValue}
    tasksByStage={tasksByStageForDisplay}
    paneProgress={paneProgress}
    isTasksLoading={isTasksLoadingForDisplay}
    isTaskSummaryLoading={isTaskSummaryLoadingForDisplay}
    isStartupPending={isStartupPendingForDisplay}
    buildStatus={summary?.buildStatus ?? 'waiting'}
    resolveStatusLabel={resolveStatusLabel}
    resolveStatusColor={resolveStatusColor}
    resolveTaskTitle={resolveTaskTitle}
    t={t}
    matchesSearchQuery={matchesSearchQuery}
    isDetailFloatingWindowOpen={isDetailFloatingWindowOpen}
    isOpeningPending={isOpeningPending}
    buildConfig={buildConfig}
    onOpenDetailFloatingWindow={onOpenDetailFloatingWindow}
    onCloseDetailFloatingWindow={onCloseDetailFloatingWindow}
    floatingWindowZIndex={floatingWindowZIndex}
    onRequestBringFloatingWindowToFront={onRequestBringFloatingWindowToFront}
  />
);
