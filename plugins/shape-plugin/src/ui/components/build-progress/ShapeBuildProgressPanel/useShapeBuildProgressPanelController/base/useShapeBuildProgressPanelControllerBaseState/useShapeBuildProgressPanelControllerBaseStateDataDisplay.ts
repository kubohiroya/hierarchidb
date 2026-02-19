import type { ReactNode, MouseEvent } from 'react';
import type { BuildStepStageMenu } from '@hierarchidb/components';
import type { ShapeProcessingConfig } from '~/common/types/build';
import type { ShapeEntity } from '~/common/types/ShapeEntity';
import type { TaskProgressControls } from '~/ui/atoms/shapeBuildProgressAtoms';
import type { TaskItemWithMetadata } from '~/ui/components/build-progress/taskItemCardList/types';
import type { StartWarning } from '~/ui/components/build-progress/useBuildProgressPanelState/useShapeBuildProgressWarnings';

type StageMetadataMap<T> = Record<string, T>;

type StateLike = {
  t: (key: string, fallback: string) => string;
  stages: Array<{ id: string; title: string }>;
  summary: {
    nodeId?: string;
    buildStatus: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
    timingStageId?: string | null;
    [key: string]: unknown;
  };
  controls: TaskProgressControls;
  paneProgress: Array<{
    paneId: string;
    progress: number;
    taskCount?: number;
    completedCount?: number;
    status?: string;
    summary?: unknown;
  }> | undefined;
  isTasksLoading: boolean;
  isTaskSummaryLoading: boolean;
  tasksByStage: Record<string, TaskItemWithMetadata[]>;
  resolveTaskTitle: (task: TaskItemWithMetadata) => string;
  resolveStatusColor: (name: string) => string;
  resolveStatusLabel: (name: string) => string;
  controlDetails: unknown;
  stageConcurrencyIndicators: unknown;
};

type DisplayArgs = {
  core: StateLike;
  nodeId?: string;
  isBuildSessionStarted: boolean;
  isBuildStartupPending: boolean;
  isResetSessionLoading: boolean;
  isTerminalStatus: boolean;
  isResetSessionPending: boolean;
  startPendingHold: boolean;
  isTasksLoadingForDisplay: boolean;
  isTaskSummaryLoadingForDisplay: boolean;
  taskSearchText: string;
  setTaskSearchText: (next: string) => void;
  startupNoticeDismissed: boolean;
  setStartupNoticeDismissed: (next: boolean) => void;
  startupStatusMessage: string;
  pauseButtonLabel: string;
  hasAnyTasks: boolean;
  hasAnySummaryTasks: boolean;
  cacheCounts: unknown;
  cacheResultCounts: unknown;
  cacheDeleteLoading: {
    resetSession: boolean;
    [key: string]: boolean;
  };
  cacheCanDeleteFetchApiCache: boolean;
  cacheCanDeleteFetchFilteredCache: boolean;
  cacheCanDeleteTransformCache: boolean;
  cacheCanDeleteVTCache: boolean;
  cacheCanDeleteMetadata: boolean;
  cacheHandleDeleteFetchApiCache: () => Promise<void>;
  cacheHandleDeleteFetchFilteredCache: () => Promise<void>;
  cacheHandleDeleteTransformCache: () => Promise<void>;
  cacheHandleDeleteVTCache: () => Promise<void>;
  cacheHandleDeleteMetadata: () => Promise<void>;
  stages: Array<{ id: string; title: string }>;
  summary: StateLike['summary'];
  controls: StateLike['controls'];
  paneProgress: StateLike['paneProgress'];
  stageProgress: Record<string, number>;
  tasksByStage: Record<string, TaskItemWithMetadata[]>;
  tasksByStageForDisplay: Record<string, TaskItemWithMetadata[]>;
  paneProgressForDisplay: StateLike['paneProgress'];
  stageProgressForDisplay: Record<string, number>;
  stageLoadingState: StageMetadataMap<boolean>;
  stageConcurrencyIndicatorAriaLabels: StageMetadataMap<string>;
  stageLeadingControls: StageMetadataMap<ReactNode>;
  stageMenus: StageMetadataMap<BuildStepStageMenu>;
  stageHeaderMeta: StageMetadataMap<ReactNode>;
  matchesSearchQuery: (task: TaskItemWithMetadata) => boolean;
  processingConfigForEdit: ShapeProcessingConfig;
  fetchRetryConfigForEdit: {
    timeoutMs: number;
    retryAttempts: number;
    retryDelay: number;
    retryLimit: number;
    retryBackoff: ShapeProcessingConfig['fetch']['retryBackoff'];
  };
  applyProcessingConfigUpdate: (partial: Partial<ShapeProcessingConfig>) => void;
  applyFetchRetryConfigUpdate: (next: {
    timeoutMs: number;
    retryAttempts: number;
    retryDelay: number;
    retryLimit: number;
    retryBackoff: ShapeProcessingConfig['fetch']['retryBackoff'];
  }) => void;
  handleStartClickWithHold: () => Promise<void>;
  handleConfirmStartWithHold: () => Promise<void>;
  handleResetSessionWithSkeleton: () => Promise<void>;
  handleFetchRetryIndicatorClick: (event: MouseEvent<HTMLElement>) => void;
  handleStageConcurrencyIndicatorClick: (stageId: string, event: MouseEvent<HTMLElement>) => void;
  concurrencyEditorAnchor: HTMLElement | null;
  concurrencyEditorStageId: 'fetch' | 'transform' | 'vt' | null;
  fetchRetryEditorAnchor: HTMLElement | null;
  closeConcurrencyEditor: () => void;
  closeFetchRetryEditor: () => void;
  onChange?: (patch: Partial<ShapeEntity>) => void;
  warningMessage?: string | null;
  startWarning?: StartWarning | null;
  warningDialogOpen: boolean;
  setWarningDialogOpen: (open: boolean) => void;
  crashHint?: string | null;
  crashHintOpen: boolean;
  setCrashHintOpen: (open: boolean) => void;
  sizeWarningOpen: boolean;
  setSizeWarningOpen: (open: boolean) => void;
  crashSuspectMessage?: string | null;
  crashSuspectOpen: boolean;
  crashSuspectControls?: unknown;
  suspendSuspectMessage?: string | null;
  suspendSuspectOpen: boolean;
  suspendSuspectControls?: unknown;
  completionDialogOpen: boolean;
  setCompletionDialogOpen: (open: boolean) => void;
  completionSnapshot: unknown;
  completionStageLabel: string;
  completionTaskTitle: string;
  completionTaskMessage: string;
  completionReason?: string | null;
  resolveTaskTitle: (task: TaskItemWithMetadata) => string;
  resolveStatusColor: StateLike['resolveStatusColor'];
  resolveStatusLabel: StateLike['resolveStatusLabel'];
  controlDetails: StateLike['controlDetails'];
  stageConcurrencyIndicators: StateLike['stageConcurrencyIndicators'];
};

export const useShapeBuildProgressPanelControllerBaseStateDataDisplay = (args: DisplayArgs) => {
  const {
    core,
    isBuildSessionStarted,
    isBuildStartupPending,
    isResetSessionLoading,
    isTerminalStatus,
    isResetSessionPending,
    startPendingHold,
    isTasksLoadingForDisplay,
    isTaskSummaryLoadingForDisplay,
    taskSearchText,
    setTaskSearchText,
    startupNoticeDismissed,
    setStartupNoticeDismissed,
    startupStatusMessage,
    pauseButtonLabel,
    hasAnyTasks,
    hasAnySummaryTasks,
    cacheCounts,
    cacheResultCounts,
    cacheDeleteLoading,
    cacheCanDeleteFetchApiCache,
    cacheCanDeleteFetchFilteredCache,
    cacheCanDeleteTransformCache,
    cacheCanDeleteVTCache,
    cacheCanDeleteMetadata,
    cacheHandleDeleteFetchApiCache,
    cacheHandleDeleteFetchFilteredCache,
    cacheHandleDeleteTransformCache,
    cacheHandleDeleteVTCache,
    cacheHandleDeleteMetadata,
    stages,
    summary,
    controls,
    paneProgress,
    stageProgress,
    tasksByStage,
    tasksByStageForDisplay,
    paneProgressForDisplay,
    stageProgressForDisplay,
    stageLoadingState,
    stageConcurrencyIndicatorAriaLabels,
    stageLeadingControls,
    stageMenus,
    stageHeaderMeta,
    matchesSearchQuery,
    processingConfigForEdit,
    fetchRetryConfigForEdit,
    applyProcessingConfigUpdate,
    applyFetchRetryConfigUpdate,
    handleStartClickWithHold,
    handleConfirmStartWithHold,
    handleResetSessionWithSkeleton,
    handleFetchRetryIndicatorClick,
    handleStageConcurrencyIndicatorClick,
    concurrencyEditorAnchor,
    concurrencyEditorStageId,
    fetchRetryEditorAnchor,
    closeConcurrencyEditor,
    closeFetchRetryEditor,
    onChange,
    warningMessage,
    startWarning,
    warningDialogOpen,
    setWarningDialogOpen,
    crashHint,
    crashHintOpen,
    setCrashHintOpen,
    sizeWarningOpen,
    setSizeWarningOpen,
    crashSuspectMessage,
    crashSuspectOpen,
    crashSuspectControls,
    suspendSuspectMessage,
    suspendSuspectOpen,
    suspendSuspectControls,
    completionDialogOpen,
    setCompletionDialogOpen,
    completionSnapshot,
    completionStageLabel,
    completionTaskTitle,
    completionTaskMessage,
    completionReason,
    resolveTaskTitle,
    resolveStatusColor,
    resolveStatusLabel,
    controlDetails,
    stageConcurrencyIndicators,
  } = args;

  return {
    core,
    nodeId: core.summary.nodeId,
    t: core.t,
    stages,
    summary,
    controls,
    stageConcurrencyIndicators,
    paneProgress,
    isTasksLoading: isTasksLoadingForDisplay,
    isTaskSummaryLoading: isTaskSummaryLoadingForDisplay,
    isResetSessionLoading,
    isResetSessionPending,
    startPendingHold,
    isBuildSessionStarted,
    isBuildStartupPending,
    isTerminalStatus,
    hasAnyTasks,
    hasAnySummaryTasks,
    taskSearchText,
    setTaskSearchText,
    startupNoticeDismissed,
    setStartupNoticeDismissed,
    warningMessage,
    startWarning,
    warningDialogOpen,
    setWarningDialogOpen,
    crashHint,
    crashHintOpen,
    setCrashHintOpen,
    sizeWarningOpen,
    setSizeWarningOpen,
    crashSuspectMessage,
    crashSuspectOpen,
    crashSuspectControls,
    suspendSuspectMessage,
    suspendSuspectOpen,
    suspendSuspectControls,
    completionDialogOpen,
    setCompletionDialogOpen,
    completionSnapshot,
    completionStageLabel,
    completionTaskTitle,
    completionTaskMessage,
    completionReason,
    resolveTaskTitle,
    resolveStatusColor,
    resolveStatusLabel,
    controlDetails,
    handlePause: controls.handlePause,
    handleStartClickWithHold,
    handleConfirmStartWithHold,
    handleResetSessionWithSkeleton,
    counts: cacheCounts,
    resultCounts: cacheResultCounts,
    isTaskSummaryLoadingForDisplay,
    isTasksLoadingForDisplay,
    stageProgressForDisplay,
    paneProgressForDisplay,
    tasksByStage,
    tasksByStageForDisplay,
    startupStatusMessage,
    pauseButtonLabel,
    matchesSearchQuery,
    applyProcessingConfigUpdate,
    applyFetchRetryConfigUpdate,
    processingConfigForEdit,
    fetchRetryConfigForEdit,
    handleFetchRetryIndicatorClick,
    handleStageConcurrencyIndicatorClick,
    stageLoadingState,
    stageConcurrencyIndicatorAriaLabels,
    stageLeadingControls,
    stageMenus,
    stageHeaderMeta,
    onStageConcurrencyIndicatorClick: handleStageConcurrencyIndicatorClick,
    onChange,
    closeConcurrencyEditor,
    closeFetchRetryEditor,
    concurrencyEditorAnchor,
    concurrencyEditorStageId,
    fetchRetryEditorAnchor,
    deleteLoading: cacheDeleteLoading,
    canDeleteFetchApiCache: cacheCanDeleteFetchApiCache,
    canDeleteFetchFilteredCache: cacheCanDeleteFetchFilteredCache,
    canDeleteTransformCache: cacheCanDeleteTransformCache,
    canDeleteVTCache: cacheCanDeleteVTCache,
    canDeleteMetadata: cacheCanDeleteMetadata,
    handleDeleteFetchApiCache: cacheHandleDeleteFetchApiCache,
    handleDeleteFetchFilteredCache: cacheHandleDeleteFetchFilteredCache,
    handleDeleteTransformCache: cacheHandleDeleteTransformCache,
    handleDeleteVTCache: cacheHandleDeleteVTCache,
    handleDeleteMetadata: cacheHandleDeleteMetadata,
    hasBuildPayload: tasksByStageForDisplay != null,
    stageProgress,
  } as const;
};
