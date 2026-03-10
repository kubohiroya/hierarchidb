import { useBuildSessionStageCardState } from './useBuildSessionStageCardState.js';
import { BuildSessionStageCardView } from './BuildSessionStageCardView.tsx';
import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';
import type { ShapeBuildConfig } from '~/common/types/BuildTaskResult';

type BuildSessionStageCardProps = {
  showHeader?: boolean;
  stage: {
    id: string;
    title: string;
    description?: string | null;
  };
  stageValue: number;
  tasksByStage: Record<string, import('../../taskItemCardList/types.js').TaskItemWithMetadata[]>;
  paneProgress?: Array<{
    paneId?: string;
    progress?: number;
    taskCount?: number;
    completedCount?: number;
    status?: string;
  }>;
  isTaskSummaryLoading: boolean;
  isTasksLoading: boolean;
  isStartupPending: boolean;
  buildStatus: BuildStatus;
  resolveStatusLabel: (statusValue?: string, skipped?: boolean) => string;
  resolveStatusColor: (statusValue?: string, skipped?: boolean) => 'default' | 'success' | 'error' | 'warning' | 'info';
  resolveTaskTitle: (task: import('../../taskItemCardList/types.js').TaskItemWithMetadata) => string;
  t: (key: string, fallback: string) => string;
  matchesSearchQuery: (task: import('../../taskItemCardList/types.js').TaskItemWithMetadata) => boolean;
  isDetailFloatingWindowOpen: boolean;
  isOpeningPending?: boolean;
  buildConfig?: ShapeBuildConfig;
  onOpenDetailFloatingWindow: () => void;
  onCloseDetailFloatingWindow: () => void;
  floatingWindowZIndex: number;
  onRequestBringFloatingWindowToFront: () => void;
};

export const BuildSessionStageCard = ({
  showHeader,
  stage,
  stageValue,
  tasksByStage,
  paneProgress,
  isTaskSummaryLoading,
  isTasksLoading,
  isStartupPending,
  buildStatus,
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
}: BuildSessionStageCardProps) => {
  const state = useBuildSessionStageCardState({
    stage,
    stageValue,
    tasksByStage,
    paneProgress,
    isTaskSummaryLoading,
    isTasksLoading,
    isStartupPending,
    buildStatus,
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

  return (
    <BuildSessionStageCardView
      {...state}
      showHeader={showHeader}
    />
  );
};
