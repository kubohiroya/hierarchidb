import { type MouseEvent as ReactMouseEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { type BuildStepStageMenu } from '@hierarchidb/components';
import type { NodeId } from '@hierarchidb/core-types';
import type { FetchConfig } from '@hierarchidb/gis-sdk';
import type { ShapeEntity } from '../../../../../common/types/ShapeEntity.js';
import type { ShapeProcessingConfig } from '../../../../../common/types/index.js';
import {
  DEFAULT_BUILD_CONFIG,
  DEFAULT_PROCESSING_CONFIG,
  mergeBuildConfig,
  mergeProcessingConfig,
} from '../../../../../common/types/index.js';
import type { TaskItemWithMetadata } from '../../useTaskItemCardList.js';
import { useShapeBuildCacheActions } from '../../../../hooks/useShapeBuildCacheActions.js';
import { useShapeBuildProgressPanel } from '../../useShapeBuildProgressPanel.js';

type FetchRetryConfigPatch = {
  timeoutMs: number;
  retryAttempts: number;
  retryDelay: number;
  retryLimit: number;
  retryBackoff: FetchConfig['retryBackoff'];
};

type ShapeBuildProgressPanelControllerProps = {
  data?: Partial<ShapeEntity>;
  nodeId?: NodeId;
  onChange?: (patch: Partial<ShapeEntity>) => void;
};

export type StageMetadataMap<T> = Record<string, T>;

export const useShapeBuildProgressPanelControllerBase = ({
  data,
  nodeId,
  onChange,
}: ShapeBuildProgressPanelControllerProps) => {
  const core = useShapeBuildProgressPanel({ data, nodeId });
  const {
    t,
    stages,
    tasksByStage,
    summary,
    controls,
    isTasksLoading,
    isTaskSummaryLoading,
    stageProgress,
    paneProgress,
    stageConcurrencyIndicators,
    handleStartClick,
    handleConfirmStart,
    warningMessage,
    startWarning,
    crashHint,
    warningDialogOpen,
    setWarningDialogOpen,
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
  } = core;

  const {
    counts: cacheCounts,
    resultCounts: cacheResultCounts,
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
    handleResetSession: cacheHandleResetSession,
  } = useShapeBuildCacheActions({ nodeId });

  const [isResetSessionPending, setIsResetSessionPending] = useState(false);
  const [startPendingHold, setStartPendingHold] = useState(false);
  const [taskSearchText, setTaskSearchText] = useState('');
  const [concurrencyEditorAnchor, setConcurrencyEditorAnchor] = useState<HTMLElement | null>(null);
  const [concurrencyEditorStageId, setConcurrencyEditorStageId] = useState<'fetch' | 'transform' | 'vt' | null>(null);
  const [fetchRetryEditorAnchor, setFetchRetryEditorAnchor] = useState<HTMLElement | null>(null);
  const [startupNoticeDismissed, setStartupNoticeDismissed] = useState(false);

  const isBuildSessionStarted = controls.startPending || summary.buildStatus === 'running';
  const isBuildStartupPending = controls.startPending
    && summary.buildStatus !== 'running'
    && summary.buildStatus !== 'completed'
    && summary.buildStatus !== 'failed';

  const isResetSessionLoading = isResetSessionPending || cacheDeleteLoading.resetSession;
  const isTerminalStatus = summary.buildStatus === 'completed' || summary.buildStatus === 'failed';

  useEffect(() => {
    if (controls.startPending) {
      setStartupNoticeDismissed(false);
      setStartPendingHold(true);
    }
  }, [controls.startPending]);

  const hasAnyTasks = useMemo(() => (
    stages.some((stage) => (tasksByStage[stage.id] ?? []).length > 0)
  ), [stages, tasksByStage]);

  const hasAnySummaryTasks = useMemo(
    () => (paneProgress ?? []).some((entry) => (entry.taskCount ?? 0) > 0),
    [paneProgress],
  );

  useEffect(() => {
    if (!startPendingHold) return;
    if (hasAnyTasks || hasAnySummaryTasks || isTerminalStatus) {
      setStartPendingHold(false);
    }
  }, [hasAnySummaryTasks, hasAnyTasks, isTerminalStatus, startPendingHold]);

  const handleStartClickWithHold = useCallback(async () => {
    setStartPendingHold(true);
    await handleStartClick();
  }, [handleStartClick]);

  const handleConfirmStartWithHold = useCallback(async () => {
    setStartPendingHold(true);
    await handleConfirmStart();
  }, [handleConfirmStart]);

  const handleResetSessionWithSkeleton = useCallback(async () => {
    if (isResetSessionLoading) return;
    setIsResetSessionPending(true);
    try {
      await cacheHandleResetSession();
    } finally {
      setIsResetSessionPending(false);
    }
  }, [cacheHandleResetSession, isResetSessionLoading]);

  const isTasksLoadingForDisplay = isTasksLoading
    || isResetSessionLoading
    || controls.startPending
    || startPendingHold;
  const isTaskSummaryLoadingForDisplay = isTaskSummaryLoading || isResetSessionLoading;

  const tasksByStageForDisplay = useMemo(() => {
    if (!isResetSessionLoading) return tasksByStage;
    return stages.reduce<StageMetadataMap<TaskItemWithMetadata[]>>((acc, stage) => {
      acc[stage.id] = [];
      return acc;
    }, {});
  }, [isResetSessionLoading, stages, tasksByStage]);

  const paneProgressForDisplay = useMemo(() => {
    if (!isResetSessionLoading) return paneProgress;
    return stages.map((stage) => ({
      paneId: stage.id,
      progress: 0,
      taskCount: 0,
      completedCount: 0,
      status: 'idle',
      summary: { total: 0, success: 0, error: 0, skip: 0 },
    }));
  }, [isResetSessionLoading, paneProgress, stages]);

  const stageProgressForDisplay = useMemo(() => {
    if (!isResetSessionLoading) return stageProgress;
    return stages.reduce<StageMetadataMap<number>>((acc, stage) => {
      acc[stage.id] = 0;
      return acc;
    }, {});
  }, [isResetSessionLoading, stageProgress, stages]);

  const startupStatusMessage = controls.statusLabel?.trim()
    || t('stage.progress.startupPending', 'Preparing build session. Please wait...');
  const pauseButtonLabel = isBuildStartupPending
    ? t('stage.controls.cancelBuild', 'Cancel Build')
    : t('stage.controls.pause', 'Pause');

  const taskSearchQuery = taskSearchText.trim().toLowerCase();
  const matchesSearchQuery = useCallback((task: TaskItemWithMetadata) => {
    if (taskSearchQuery.length === 0) return true;
    const title = resolveTaskTitle(task).toLowerCase();
    const message = typeof task.message === 'string' ? task.message.toLowerCase() : '';
    return title.includes(taskSearchQuery) || message.includes(taskSearchQuery);
  }, [resolveTaskTitle, taskSearchQuery]);

  const processingConfigForEdit = useMemo<ShapeProcessingConfig>(() => {
    const draftConfig = data?.processingConfig ?? DEFAULT_PROCESSING_CONFIG;
    return mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG, draftConfig);
  }, [data]);

  const buildConfigForEdit = useMemo(
    () => mergeBuildConfig(DEFAULT_BUILD_CONFIG, data?.buildConfig),
    [data?.buildConfig],
  );

  const fetchRetryConfigForEdit = useMemo(() => ({
    timeoutMs: buildConfigForEdit.fetchConfig.timeoutMs,
    retryAttempts: processingConfigForEdit.fetch.retryAttempts,
    retryDelay: processingConfigForEdit.fetch.retryDelay,
    retryLimit: processingConfigForEdit.fetch.retryLimit,
    retryBackoff: processingConfigForEdit.fetch.retryBackoff,
  }), [
    buildConfigForEdit.fetchConfig.timeoutMs,
    processingConfigForEdit.fetch.retryAttempts,
    processingConfigForEdit.fetch.retryBackoff,
    processingConfigForEdit.fetch.retryDelay,
    processingConfigForEdit.fetch.retryLimit,
  ]);

  const applyProcessingConfigUpdate = useCallback((partial: Partial<ShapeProcessingConfig>) => {
    if (!onChange) return;
    const merged = mergeProcessingConfig(processingConfigForEdit, partial);
    onChange({ processingConfig: merged });
  }, [onChange, processingConfigForEdit]);

  const applyFetchRetryConfigUpdate = useCallback((next: FetchRetryConfigPatch) => {
    if (!onChange) return;
    const nextBuildConfig = mergeBuildConfig(buildConfigForEdit, {
      fetchConfig: {
        ...buildConfigForEdit.fetchConfig,
        timeoutMs: next.timeoutMs,
      },
    });
    const nextProcessingConfig = mergeProcessingConfig(processingConfigForEdit, {
      fetch: {
        ...processingConfigForEdit.fetch,
        retryAttempts: next.retryAttempts,
        retryDelay: next.retryDelay,
        retryLimit: next.retryLimit,
        retryBackoff: next.retryBackoff,
      },
    });
    onChange({
      buildConfig: nextBuildConfig,
      processingConfig: nextProcessingConfig,
    });
  }, [buildConfigForEdit, onChange, processingConfigForEdit]);

  const closeConcurrencyEditor = useCallback(() => {
    setConcurrencyEditorAnchor(null);
    setConcurrencyEditorStageId(null);
  }, []);

  const handleFetchRetryIndicatorClick = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (isBuildSessionStarted) return;
    setConcurrencyEditorAnchor(null);
    setConcurrencyEditorStageId(null);
    setFetchRetryEditorAnchor(event.currentTarget);
  }, [isBuildSessionStarted]);

  const closeFetchRetryEditor = useCallback(() => {
    setFetchRetryEditorAnchor(null);
  }, []);

  const handleStageConcurrencyIndicatorClick = useCallback((
    stageId: string,
    event: ReactMouseEvent<HTMLElement>,
  ) => {
    if (isBuildSessionStarted) return;
    if (stageId !== 'fetch' && stageId !== 'transform' && stageId !== 'vt') return;
    setFetchRetryEditorAnchor(null);
    setConcurrencyEditorStageId(stageId);
    setConcurrencyEditorAnchor(event.currentTarget);
  }, [isBuildSessionStarted]);

  const stageLoadingState = useMemo<Record<string, boolean>>(() => {
    const next = stages.reduce<Record<string, boolean>>((acc, stage) => {
      acc[stage.id] = summary.buildStatus === 'running' && summary.timingStageId === stage.id;
      return acc;
    }, {});
    return next;
  }, [stages, summary.buildStatus, summary.timingStageId]);

  const stageConcurrencyIndicatorAriaLabels = useMemo<Record<string, string>>(() => {
    const next = stages.reduce<Record<string, string>>((acc, stage) => {
      acc[stage.id] = stage.title;
      return acc;
    }, {});
    return next;
  }, [stages]);

  const stageLeadingControls = useMemo<Record<string, ReactNode>>(() => {
    const controlsByStage: Record<string, ReactNode> = {};
    return controlsByStage;
  }, []);

  const stageMenus = useMemo<Record<string, BuildStepStageMenu>>(() => {
    const menusByStage: Record<string, BuildStepStageMenu> = {};
    return menusByStage;
  }, []);

  const stageHeaderMeta = useMemo<Record<string, ReactNode>>(() => {
    const headerMetaByStage: Record<string, ReactNode> = {};
    return headerMetaByStage;
  }, []);

  useEffect(() => {
    if (!isBuildSessionStarted) return;
    setConcurrencyEditorAnchor(null);
    setConcurrencyEditorStageId(null);
    setFetchRetryEditorAnchor(null);
  }, [isBuildSessionStarted]);

  return {
    core,
    t,
    nodeId,
    stages,
    summary,
    controls,
    stageConcurrencyIndicators,
    stageProgress,
    paneProgress,
    isTasksLoadingForDisplay,
    isTaskSummaryLoadingForDisplay,
    stageProgressForDisplay,
    paneProgressForDisplay,
    tasksByStageForDisplay,
    counts: cacheCounts,
    resultCounts: cacheResultCounts,
    isResetSessionLoading,
    isResetSessionPending,
    startupNoticeDismissed,
    setStartupNoticeDismissed,
    startPendingHold,
    setStartPendingHold,
    isBuildSessionStarted,
    isTerminalStatus,
    hasAnyTasks,
    hasAnySummaryTasks,
    taskSearchText,
    setTaskSearchText,
    handleStartClickWithHold,
    handleConfirmStartWithHold,
    handleResetSessionWithSkeleton,
    startupStatusMessage,
    pauseButtonLabel,
    controlDetails,
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
    processingConfigForEdit,
    buildConfigForEdit,
    fetchRetryConfigForEdit,
    applyProcessingConfigUpdate,
    applyFetchRetryConfigUpdate,
    concurrencyEditorAnchor,
    concurrencyEditorStageId,
    fetchRetryEditorAnchor,
    closeConcurrencyEditor,
    closeFetchRetryEditor,
    handleFetchRetryIndicatorClick,
    onStageConcurrencyIndicatorClick: handleStageConcurrencyIndicatorClick,
    matchesSearchQuery,
    handleStageConcurrencyIndicatorClick,
    isBuildStartupPending,
    stageLoadingState,
    stageConcurrencyIndicatorAriaLabels,
    stageLeadingControls,
    stageMenus,
    stageHeaderMeta,
    canDeleteFetchApiCache: cacheCanDeleteFetchApiCache,
    canDeleteFetchFilteredCache: cacheCanDeleteFetchFilteredCache,
    canDeleteTransformCache: cacheCanDeleteTransformCache,
    canDeleteVTCache: cacheCanDeleteVTCache,
    canDeleteMetadata: cacheCanDeleteMetadata,
    deleteLoading: cacheDeleteLoading,
    handleDeleteFetchApiCache: cacheHandleDeleteFetchApiCache,
    handleDeleteFetchFilteredCache: cacheHandleDeleteFetchFilteredCache,
    handleDeleteTransformCache: cacheHandleDeleteTransformCache,
    handleDeleteVTCache: cacheHandleDeleteVTCache,
    handleDeleteMetadata: cacheHandleDeleteMetadata,
    onChange,
  };
};

export type ShapeBuildProgressPanelControllerBaseResult = ReturnType<typeof useShapeBuildProgressPanelControllerBase>;
