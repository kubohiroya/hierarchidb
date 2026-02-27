import type { ReactNode, MouseEvent } from 'react';
import type { BuildStage } from '@hierarchidb/components/build-stage';
import type { BuildStatus } from '@hierarchidb/components/build-status';
import type { BuildControlMenuItem, BuildStepStageMenu } from '@hierarchidb/components';
import type { PaneProgress } from '@hierarchidb/ui-lru-splitview';
import type { ShapeProcessingConfig } from '~/common/types/build';
import type { ShapeEntity } from '~/common/types/ShapeEntity';
import type {
  CrashSuspectControls,
  ShapeBuildTaskSummary,
  SuspendSuspectControls,
  TaskProgressControls,
  TaskProgressSummary,
} from '~/ui/atoms/shapeBuildProgressAtoms';
import type { TaskItemWithMetadata } from '~/ui/components/build-progress/taskItemCardList/types';
import type { BuildProgressPanelStateComputed } from '~/ui/components/build-progress/useBuildProgressPanelState/useBuildProgressPanelStateComputed';
import type { StartWarning } from '~/ui/components/build-progress/useBuildProgressPanelState/useShapeBuildProgressWarnings';
import type { TranslateFn } from '~/ui/components/build-progress/useBuildProgressPanelState/useBuildProgressPanelStateComputedHelpers';

type StageMetadataMap<T> = Record<string, T>;

type CompletionSnapshot = {
  status: BuildStatus;
  stageLabel: string;
  taskTitle?: string;
  taskMessage?: string;
  reason?: string;
} | null;

type StateLike = {
  t: TranslateFn;
  stages: BuildStage[];
  summary: TaskProgressSummary & {
    nodeId?: string;
  };
  controls: TaskProgressControls;
  paneProgress: PaneProgress[];
  isTasksLoading: boolean;
  isTaskSummaryLoading: boolean;
  tasksByStage: Record<string, ShapeBuildTaskSummary[]>;
  resolveTaskTitle: (task: TaskItemWithMetadata) => string;
  resolveStatusColor: BuildProgressPanelStateComputed['resolveStatusColor'];
  resolveStatusLabel: BuildProgressPanelStateComputed['resolveStatusLabel'];
  controlDetails: BuildProgressPanelStateComputed['controlDetails'];
  stageConcurrencyIndicators: BuildProgressPanelStateComputed['stageConcurrencyIndicators'];
};

type CacheCounts = {
  fetchApi: number;
  fetchFiltered: number;
  transform: number;
  vt: number;
  [key: string]: number;
};

type CacheResultCounts = {
  tiles: number;
  featureMetadata: number;
  transformErrors: number;
  [key: string]: number;
};

type DisplayArgs = {
  core: StateLike;
  nodeId?: string;
  isBuildSessionStarted: boolean;
  isBuildStartupPending: boolean;
  isResetSessionLoading: boolean;
  isControlMenuDisabled: boolean;
  isStartButtonLoading: boolean;
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
  controlMenuItems: BuildControlMenuItem[];
  controlMenuAriaLabel: string;
  cacheCounts: CacheCounts;
  cacheResultCounts: CacheResultCounts;
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
  stages: BuildStage[];
  summary: StateLike['summary'];
  controls: StateLike['controls'];
  paneProgress: StateLike['paneProgress'];
  stageProgress: Record<string, number>;
  tasksByStage: Record<string, TaskItemWithMetadata[]>;
  tasksByStageForDisplay: Record<string, TaskItemWithMetadata[]>;
  paneProgressForDisplay: StateLike['paneProgress'];
  stageProgressForDisplay: Record<string, number>;
  stageLoadingState: StageMetadataMap<boolean>;
  stagePreviewWindowOpenMap: StageMetadataMap<boolean>;
  stagePreviewWindowPendingMap: StageMetadataMap<boolean>;
  stagePreviewWindowZIndexMap: StageMetadataMap<number>;
  openStagePreviewWindow: (stageId: string) => void;
  toggleStagePreviewWindow: (stageId: string) => void;
  bringStagePreviewWindowToFront: (stageId: string) => void;
  closeStagePreviewWindow: (stageId: string) => void;
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
  crashSuspectControls?: CrashSuspectControls;
  suspendSuspectMessage?: string | null;
  suspendSuspectOpen: boolean;
  suspendSuspectControls?: SuspendSuspectControls;
  completionDialogOpen: boolean;
  setCompletionDialogOpen: (open: boolean) => void;
  completionSnapshot: CompletionSnapshot;
  completionStageLabel: string;
  completionTaskTitle: string;
  completionTaskMessage: string;
  completionReason: string | null | undefined;
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
    isControlMenuDisabled,
    isStartButtonLoading,
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
    controlMenuItems,
    controlMenuAriaLabel,
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
    stagePreviewWindowOpenMap,
    stagePreviewWindowPendingMap,
    stagePreviewWindowZIndexMap,
    openStagePreviewWindow,
    toggleStagePreviewWindow,
    bringStagePreviewWindowToFront,
    closeStagePreviewWindow,
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
    isControlMenuDisabled,
    isStartButtonLoading,
    isBuildSessionStarted,
    isBuildStartupPending,
    isTerminalStatus,
    hasAnyTasks,
    hasAnySummaryTasks,
    controlMenuItems,
    controlMenuAriaLabel,
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
    stagePreviewWindowOpenMap,
    stagePreviewWindowPendingMap,
    stagePreviewWindowZIndexMap,
    openStagePreviewWindow,
    toggleStagePreviewWindow,
    bringStagePreviewWindowToFront,
    closeStagePreviewWindow,
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
