import type { ReactNode, MouseEvent } from 'react';
import type { BuildStage } from '@hierarchidb/components/build-stage';
import type { BuildStatus } from '@hierarchidb/components/build-status';
import type { BuildControlMenuItem, BuildStepStageMenu } from '@hierarchidb/components';
import type { PaneProgress } from '@hierarchidb/ui-lru-splitview';
import type { ShapeBuildConfig, ShapeProcessingConfig } from '~/common/types/BuildTaskResult';
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
  sourceApi: number;
  sourceFiltered: number;
  geometry: number;
  tileEmit: number;
  [key: string]: number;
};

type CacheResultCounts = {
  tiles: number;
  featureMetadata: number;
  geometryErrors: number;
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
  isStartupPendingForDisplay: boolean;
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
  cacheCanDeleteSourceApiCache: boolean;
  cacheCanDeleteSourceFilteredCache: boolean;
  cacheCanDeleteGeometryCache: boolean;
  cacheCanDeleteTileEmitCache: boolean;
  cacheCanDeleteMetadata: boolean;
  cacheHandleDeleteSourceApiCache: () => Promise<void>;
  cacheHandleDeleteSourceFilteredCache: () => Promise<void>;
  cacheHandleDeleteGeometryCache: () => Promise<void>;
  cacheHandleDeleteTileEmitCache: () => Promise<void>;
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
  buildConfigForDisplay: ShapeBuildConfig;
  processingConfigForEdit: ShapeProcessingConfig;
  sourceRetryConfigForEdit: {
    timeoutMs: number;
    retryAttempts: number;
    retryDelay: number;
    retryLimit: number;
    retryBackoff: ShapeProcessingConfig['source']['retryBackoff'];
  };
  applyProcessingConfigUpdate: (partial: Partial<ShapeProcessingConfig>) => void;
  applySourceRetryConfigUpdate: (next: {
    timeoutMs: number;
    retryAttempts: number;
    retryDelay: number;
    retryLimit: number;
    retryBackoff: ShapeProcessingConfig['source']['retryBackoff'];
  }) => void;
  handleStartClickWithHold: () => Promise<void>;
  handleConfirmStartWithHold: () => Promise<void>;
  handleResetSessionWithSkeleton: () => Promise<void>;
  handleSourceRetryIndicatorClick: (event: MouseEvent<HTMLElement>) => void;
  handleStageConcurrencyIndicatorClick: (stageId: string, event: MouseEvent<HTMLElement>) => void;
  concurrencyEditorAnchor: HTMLElement | null;
  concurrencyEditorStageId: 'source' | 'geometry' | 'tileEmit' | null;
  sourceRetryEditorAnchor: HTMLElement | null;
  closeConcurrencyEditor: () => void;
  closeSourceRetryEditor: () => void;
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
    isStartupPendingForDisplay,
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
    cacheCanDeleteSourceApiCache,
    cacheCanDeleteSourceFilteredCache,
    cacheCanDeleteGeometryCache,
    cacheCanDeleteTileEmitCache,
    cacheCanDeleteMetadata,
    cacheHandleDeleteSourceApiCache,
    cacheHandleDeleteSourceFilteredCache,
    cacheHandleDeleteGeometryCache,
    cacheHandleDeleteTileEmitCache,
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
    buildConfigForDisplay,
    processingConfigForEdit,
    sourceRetryConfigForEdit,
    applyProcessingConfigUpdate,
    applySourceRetryConfigUpdate,
    handleStartClickWithHold,
    handleConfirmStartWithHold,
    handleResetSessionWithSkeleton,
    handleSourceRetryIndicatorClick,
    handleStageConcurrencyIndicatorClick,
    concurrencyEditorAnchor,
    concurrencyEditorStageId,
    sourceRetryEditorAnchor,
    closeConcurrencyEditor,
    closeSourceRetryEditor,
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
    isStartupPendingForDisplay,
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
    buildConfigForDisplay,
    applyProcessingConfigUpdate,
    applySourceRetryConfigUpdate,
    processingConfigForEdit,
    sourceRetryConfigForEdit,
    handleSourceRetryIndicatorClick,
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
    closeSourceRetryEditor,
    concurrencyEditorAnchor,
    concurrencyEditorStageId,
    sourceRetryEditorAnchor,
    deleteLoading: cacheDeleteLoading,
    canDeleteSourceApiCache: cacheCanDeleteSourceApiCache,
    canDeleteSourceFilteredCache: cacheCanDeleteSourceFilteredCache,
    canDeleteGeometryCache: cacheCanDeleteGeometryCache,
    canDeleteTileEmitCache: cacheCanDeleteTileEmitCache,
    canDeleteMetadata: cacheCanDeleteMetadata,
    handleDeleteSourceApiCache: cacheHandleDeleteSourceApiCache,
    handleDeleteSourceFilteredCache: cacheHandleDeleteSourceFilteredCache,
    handleDeleteGeometryCache: cacheHandleDeleteGeometryCache,
    handleDeleteTileEmitCache: cacheHandleDeleteTileEmitCache,
    handleDeleteMetadata: cacheHandleDeleteMetadata,
    hasBuildPayload: tasksByStageForDisplay != null,
    stageProgress,
  } as const;
};
