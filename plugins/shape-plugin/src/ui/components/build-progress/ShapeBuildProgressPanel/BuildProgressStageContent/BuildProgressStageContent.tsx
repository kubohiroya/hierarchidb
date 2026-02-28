import { useBuildProgressStageContentState } from './useBuildProgressStageContentState.js';
import { BuildProgressStageContentView } from './BuildProgressStageContentView.tsx';
import type { BuildStatus } from '@hierarchidb/components/build-status';

type BuildProgressStageContentProps = {
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
  onOpenDetailFloatingWindow: () => void;
  onCloseDetailFloatingWindow: () => void;
  floatingWindowZIndex: number;
  onRequestBringFloatingWindowToFront: () => void;
};

export const BuildProgressStageContent = ({
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
  onOpenDetailFloatingWindow,
  onCloseDetailFloatingWindow,
  floatingWindowZIndex,
  onRequestBringFloatingWindowToFront,
}: BuildProgressStageContentProps) => {
  const state = useBuildProgressStageContentState({
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
    onOpenDetailFloatingWindow,
    onCloseDetailFloatingWindow,
    floatingWindowZIndex,
    onRequestBringFloatingWindowToFront,
  });

  return (
    <BuildProgressStageContentView
      {...state}
      showHeader={showHeader}
    />
  );
};
