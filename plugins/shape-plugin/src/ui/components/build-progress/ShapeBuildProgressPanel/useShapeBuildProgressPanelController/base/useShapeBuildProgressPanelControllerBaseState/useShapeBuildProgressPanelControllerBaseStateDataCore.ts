import { createElement, type ReactNode, useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { Stack, Typography } from '@mui/material';
import type { FetchConfig } from '@hierarchidb/gis-sdk';
import type { ShapeProcessingConfig } from '~/common/types/build';
import { DEFAULT_BUILD_CONFIG, DEFAULT_PROCESSING_CONFIG } from '@hierarchidb/shape-api';
import { applyBuildConfigPatch, mergeProcessingConfig } from '~/services/utils/utils';
import { useShapeBuildProgressPanel } from '~/ui/components/build-progress/useShapeBuildProgressPanel/useShapeBuildProgressPanel';
import { useShapeBuildCacheActions } from '~/ui/hooks/useShapeBuildCacheActions';
import type { TaskItemWithMetadata } from '~/ui/components/build-progress/taskItemCardList/types';
import type { ShapeEntity } from '~/common/types/ShapeEntity';
import type { NodeId } from '@hierarchidb/core-types';
import type { BuildControlMenuItem, BuildStepStageMenu } from '@hierarchidb/components';
import { useShapeBuildProgressPanelControllerBaseStateDataDisplay } from './useShapeBuildProgressPanelControllerBaseStateDataDisplay.js';
import type { TranslateFn } from '~/ui/components/build-progress/useBuildProgressPanelState/useBuildProgressPanelStateComputedHelpers';

type StageMetadataMap<T> = Record<string, T>;

type ShapeBuildProgressPanelControllerBaseProps = {
  data?: Partial<ShapeEntity>;
  nodeId?: NodeId;
  onChange?: (patch: Partial<ShapeEntity>) => void;
};

type FetchRetryConfigPatch = {
  timeoutMs: number;
  retryAttempts: number;
  retryDelay: number;
  retryLimit: number;
  retryBackoff: FetchConfig['retryBackoff'];
};

const formatDuration = (
  durationMs: number | null | undefined,
  t: TranslateFn,
  showZeroAsDash = false,
): string => {
  if (durationMs == null || durationMs < 0 || !Number.isFinite(durationMs)) {
    return t('stage.timing.unknown', '-');
  }
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  if (totalSeconds === 0) {
    return showZeroAsDash ? t('stage.timing.unknown', '-') : '0s';
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || (hours > 0 && seconds > 0)) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`);
  }
  return parts.join(' ');
};

export const useShapeBuildProgressPanelControllerBaseStateDataCore = ({
  data,
  nodeId,
  onChange,
}: ShapeBuildProgressPanelControllerBaseProps) => {
  const core = useShapeBuildProgressPanel({ data, nodeId });
  const {
    stages,
    tasksByStage,
    summary,
    controls,
    t,
    isTasksLoading,
    isTaskSummaryLoading,
    stageProgress,
    paneProgress,
    resolveTaskTitle,
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
    resolveStatusColor,
    resolveStatusLabel,
    controlDetails,
    stageConcurrencyIndicators,
    handleStartClick,
    handleConfirmStart,
  } = core;

  const {
    counts: cacheCounts,
    resultCounts: cacheResultCounts,
    deleteLoading: cacheDeleteLoading,
    canDeleteFetchApiCache: cacheCanDeleteFetchApiCache,
    canDeleteFetchFilteredCache: cacheCanDeleteFetchFilteredCache,
    canDeleteTransformCache: cacheCanDeleteTransformCache,
    canDeleteVTCache: cacheCanDeleteVTCache,
    canDeleteTransposeIndex: cacheCanDeleteTransposeIndex,
    canDeleteMetadata: cacheCanDeleteMetadata,
    handleDeleteFetchApiCache: cacheHandleDeleteFetchApiCache,
    handleDeleteFetchFilteredCache: cacheHandleDeleteFetchFilteredCache,
    handleDeleteTransformCache: cacheHandleDeleteTransformCache,
    handleDeleteVTCache: cacheHandleDeleteVTCache,
    handleDeleteTransposeIndex: cacheHandleDeleteTransposeIndex,
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
    stages.some((stage: { id: string }) => (tasksByStage[stage.id] ?? []).length > 0)
  ), [stages, tasksByStage]);

  const hasAnySummaryTasks = useMemo(
    () => (paneProgress ?? []).some(
      (entry: { taskCount?: number } | undefined) => (entry?.taskCount ?? 0) > 0,
    ),
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
    setStartPendingHold(false);
    setIsResetSessionPending(true);
    try {
      await cacheHandleResetSession();
    } finally {
      setStartPendingHold(false);
      setIsResetSessionPending(false);
    }
  }, [cacheHandleResetSession, isResetSessionLoading]);

  const isTasksLoadingForDisplay = isTasksLoading
    || isResetSessionLoading
    || controls.startPending
    || startPendingHold;
  const isTaskSummaryLoadingForDisplay = isTaskSummaryLoading || isResetSessionLoading;
  const isControlMenuDisabled = isResetSessionLoading || summary.buildStatus === 'idle';
  const isStartButtonLoading = isResetSessionLoading
    ? false
    : (summary.buildStatus === 'running' || controls.startPending || startPendingHold);

  const tasksByStageForDisplay = useMemo(() => {
    if (!isResetSessionLoading) return tasksByStage;
    return stages.reduce<StageMetadataMap<TaskItemWithMetadata[]>>((acc, stage: { id: string }) => {
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
    return stages.reduce<StageMetadataMap<number>>((acc, stage: { id: string }) => {
      acc[stage.id] = 0;
      return acc;
    }, {});
  }, [isResetSessionLoading, stageProgress, stages]);

  const stageLoadingState = useMemo<StageMetadataMap<boolean>>(() => (
    stages.reduce<StageMetadataMap<boolean>>((acc, stage: { id: string }) => {
      acc[stage.id] = summary.buildStatus === 'running' && summary.timingStageId === stage.id;
      return acc;
    }, {})
  ), [stages, summary.buildStatus, summary.timingStageId]);

  const stageConcurrencyIndicatorAriaLabels = useMemo<StageMetadataMap<string>>(() => (
    stages.reduce<StageMetadataMap<string>>((acc, stage: { id: string; title: string }) => {
      acc[stage.id] = stage.title;
      return acc;
    }, {})
  ), [stages]);

  const stageLeadingControls = useMemo<StageMetadataMap<ReactNode>>(() => {
    const controlsByStage: Record<string, ReactNode> = {};
    return controlsByStage;
  }, []);

  const deleteCountUnit = t('processing.download.countUnit', ' items');
  const formatDeleteLabelWithCount = useCallback((label: string, count: number, unit = deleteCountUnit) => (
    count > 0 ? `${label} (${count}${unit})` : label
  ), [deleteCountUnit]);

  const fetchApiDeleteLabel = useMemo(() => (
    formatDeleteLabelWithCount(
      t('processing.download.deleteApiCache', 'Delete API cache'),
      cacheCounts.fetchApi ?? 0,
    )
  ), [cacheCounts.fetchApi, formatDeleteLabelWithCount, t]);
  const fetchFilteredDeleteLabel = useMemo(() => (
    formatDeleteLabelWithCount(
      t('processing.download.deleteFilteredCache', 'Delete filtered cache'),
      cacheCounts.fetchFiltered ?? 0,
    )
  ), [cacheCounts.fetchFiltered, formatDeleteLabelWithCount, t]);
  const transformDeleteLabel = useMemo(() => (
    formatDeleteLabelWithCount(
      t('processing.download.deleteStage1Cache', 'Delete simplified cache'),
      cacheCounts.transform ?? 0,
    )
  ), [cacheCounts.transform, formatDeleteLabelWithCount, t]);
  const vtDeleteLabel = useMemo(() => (
    formatDeleteLabelWithCount(
      t('processing.download.deleteTiles', 'Delete tile data'),
      cacheCounts.vt ?? 0,
    )
  ), [cacheCounts.vt, formatDeleteLabelWithCount, t]);
  const transposeIndexDeleteLabel = useMemo(() => (
    formatDeleteLabelWithCount(
      t('processing.download.deleteTransposeIndex', 'Delete transpose index'),
      cacheCounts.vt ?? 0,
    )
  ), [cacheCounts.vt, formatDeleteLabelWithCount, t]);
  const metadataDeleteLabel = useMemo(() => (
    formatDeleteLabelWithCount(
      t('processing.download.deleteMetadata', 'Delete feature metadata'),
      cacheResultCounts.featureMetadata ?? 0,
    )
  ), [cacheResultCounts.featureMetadata, formatDeleteLabelWithCount, t]);

  const resetSessionLabel = useMemo(() => (
    t('processing.download.resetSession', 'Reset build session')
  ), [t]);
  const controlMenuAriaLabel = useMemo(() => (
    String(t('build.controls.title', 'Build controls'))
  ), [t]);

  const stageMenus = useMemo<StageMetadataMap<BuildStepStageMenu>>(() => {
    const menusByStage: Record<string, BuildStepStageMenu> = {};
    menusByStage.fetch = {
      disabled: isResetSessionLoading,
      items: [
        {
          id: 'delete-fetch-api-cache',
          label: fetchApiDeleteLabel,
          onClick: cacheHandleDeleteFetchApiCache,
          disabled: isResetSessionLoading || !cacheCanDeleteFetchApiCache || cacheDeleteLoading.fetchApi,
        },
        {
          id: 'delete-fetch-filtered-cache',
          label: fetchFilteredDeleteLabel,
          onClick: cacheHandleDeleteFetchFilteredCache,
          disabled: isResetSessionLoading || !cacheCanDeleteFetchFilteredCache || cacheDeleteLoading.fetchFiltered,
        },
      ],
      ariaLabel: controlMenuAriaLabel,
    };
    menusByStage.transform = {
      disabled: isResetSessionLoading,
      items: [
        {
          id: 'delete-transform-cache',
          label: transformDeleteLabel,
          onClick: cacheHandleDeleteTransformCache,
          disabled: isResetSessionLoading || !cacheCanDeleteTransformCache || cacheDeleteLoading.transform,
        },
      ],
      ariaLabel: controlMenuAriaLabel,
    };
    menusByStage.vt = {
      disabled: isResetSessionLoading,
      items: [
        {
          id: 'delete-vt-cache',
          label: vtDeleteLabel,
          onClick: cacheHandleDeleteVTCache,
          disabled: isResetSessionLoading || !cacheCanDeleteVTCache || cacheDeleteLoading.vt,
        },
      ],
      ariaLabel: controlMenuAriaLabel,
    };
    return menusByStage;
  }, [
    cacheCanDeleteFetchApiCache,
    cacheCanDeleteFetchFilteredCache,
    cacheCanDeleteMetadata,
    cacheCanDeleteTransformCache,
    cacheCanDeleteVTCache,
    cacheDeleteLoading.fetchApi,
    cacheDeleteLoading.fetchFiltered,
    cacheDeleteLoading.metadata,
    cacheDeleteLoading.transform,
    cacheDeleteLoading.vt,
    fetchApiDeleteLabel,
    fetchFilteredDeleteLabel,
    handleResetSessionWithSkeleton,
    isResetSessionLoading,
    controlMenuAriaLabel,
    transformDeleteLabel,
    vtDeleteLabel,
    cacheHandleDeleteFetchApiCache,
    cacheHandleDeleteFetchFilteredCache,
    cacheHandleDeleteTransformCache,
    cacheHandleDeleteVTCache,
    cacheHandleDeleteMetadata,
  ]);

  const controlMenuItems = useMemo<BuildControlMenuItem[]>(() => ([
    {
      id: 'delete-metadata-cache',
      label: metadataDeleteLabel,
      onClick: cacheHandleDeleteMetadata,
      disabled: isResetSessionLoading || !cacheCanDeleteMetadata || cacheDeleteLoading.metadata,
    },
    {
      id: 'delete-transpose-index',
      label: transposeIndexDeleteLabel,
      onClick: cacheHandleDeleteTransposeIndex,
      disabled: isResetSessionLoading || !cacheCanDeleteTransposeIndex || cacheDeleteLoading.transposeIndex,
    },
    {
      id: 'reset-build-session',
      label: resetSessionLabel,
      onClick: handleResetSessionWithSkeleton,
      disabled: isResetSessionLoading,
    },
  ]), [
    cacheCanDeleteMetadata,
    cacheCanDeleteTransposeIndex,
    cacheDeleteLoading.metadata,
    cacheDeleteLoading.transposeIndex,
    cacheHandleDeleteMetadata,
    cacheHandleDeleteTransposeIndex,
    handleResetSessionWithSkeleton,
    isResetSessionLoading,
    transposeIndexDeleteLabel,
    metadataDeleteLabel,
    resetSessionLabel,
  ]);

  const stageHeaderMeta = useMemo<StageMetadataMap<ReactNode>>(() => {
    const headerMetaByStage: Record<string, ReactNode> = {};
    for (const stage of stages) {
      const elapsedValue = formatDuration(
        summary.completedStageElapsedMs[stage.id]
          ?? (summary.timingStageId === stage.id ? 0 : undefined),
        t,
      );
      const remainingValue = summary.timingStageId === stage.id
        ? formatDuration(summary.stageRemainingMs, t, true)
        : t('stage.timing.unknown', '-');
      headerMetaByStage[stage.id] = createElement(
        Stack,
        { spacing: 0.25, alignItems: 'flex-end' },
        createElement(
          Typography,
          { variant: 'caption', color: 'text.secondary' },
          `${t('stage.timing.stageElapsed', 'Time elapsed')}: ${elapsedValue}`,
        ),
        createElement(
          Typography,
          { variant: 'caption', color: 'text.secondary' },
          `${t('stage.timing.stageRemaining', 'Time left(est)')}: ${remainingValue}`,
        ),
      );
    }
    return headerMetaByStage;
  }, [stages, summary.completedStageElapsedMs, summary.stageRemainingMs, summary.timingStageId, t]);

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
    () => applyBuildConfigPatch(DEFAULT_BUILD_CONFIG, data?.buildConfig),
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
    processingConfigForEdit.fetch.retryDelay,
    processingConfigForEdit.fetch.retryLimit,
    processingConfigForEdit.fetch.retryBackoff,
  ]);

  const applyProcessingConfigUpdate = useCallback((partial: Partial<ShapeProcessingConfig>) => {
    if (!onChange) return;
    const merged = mergeProcessingConfig(processingConfigForEdit, partial);
    onChange({ processingConfig: merged });
  }, [onChange, processingConfigForEdit]);

  const applyFetchRetryConfigUpdate = useCallback((next: FetchRetryConfigPatch) => {
    if (!onChange) return;
    const nextBuildConfig = applyBuildConfigPatch(buildConfigForEdit, {
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

  const handleFetchRetryIndicatorClick = useCallback((event: MouseEvent<HTMLElement>) => {
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
    event: MouseEvent<HTMLElement>,
  ) => {
    if (isBuildSessionStarted) return;
    if (stageId !== 'fetch' && stageId !== 'transform' && stageId !== 'vt') return;
    setFetchRetryEditorAnchor(null);
    setConcurrencyEditorStageId(stageId);
    setConcurrencyEditorAnchor(event.currentTarget);
  }, [isBuildSessionStarted]);

  useEffect(() => {
    if (!isBuildSessionStarted) return;
    setConcurrencyEditorAnchor(null);
    setConcurrencyEditorStageId(null);
    setFetchRetryEditorAnchor(null);
  }, [isBuildSessionStarted]);

  return useShapeBuildProgressPanelControllerBaseStateDataDisplay({
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
  });
};
