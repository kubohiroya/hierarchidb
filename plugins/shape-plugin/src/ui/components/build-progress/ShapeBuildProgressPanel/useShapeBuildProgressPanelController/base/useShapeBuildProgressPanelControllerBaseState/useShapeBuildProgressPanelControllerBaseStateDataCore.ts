import { createElement, type ReactNode, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Stack, Typography } from '@mui/material';
import type { SourceConfig } from '@hierarchidb/gis-sdk';
import type { ShapeProcessingConfig } from '~/common/types/BuildTaskResult';
import { DEFAULT_BUILD_CONFIG, DEFAULT_PROCESSING_CONFIG } from '@hierarchidb/shape-api';
import { applyBuildConfigPatch, mergeProcessingConfig } from '~/services/utils/shapeBuildUtils';
import { useShapeBuildProgressPanel } from '~/ui/components/build-progress/useShapeBuildProgressPanel/useShapeBuildProgressPanel';
import { useShapeBuildCacheActions } from '~/ui/hooks/useShapeBuildCacheActions';
import type { TaskItemWithMetadata } from '~/ui/components/build-progress/taskItemCardList/types';
import type { ShapeEntity } from '~/common/types/ShapeEntity';
import type { NodeId } from '@hierarchidb/core-types';
import type { BuildStepStageMenu } from '@hierarchidb/ui-build-progress';
import { useSetAtom } from 'jotai';
import { useShapeBuildProgressPanelControllerBaseStateDataDisplay } from './useShapeBuildProgressPanelControllerBaseStateDataDisplay.js';
import type { TranslateFn } from '~/ui/components/build-progress/useBuildProgressPanelState/useBuildProgressPanelStateComputedHelpers';
import { resolveTaskMetadataMessage } from '~/common/utils/taskMessageUtils';
import { normalizeUiStageId, resolveStageAliasArray } from '~/ui/components/build-progress/stageIdAliases';
import { dispatchBuildSessionEventAtom } from '~/ui/atoms/buildSessionStateAtoms';

type StageMetadataMap<T> = Record<string, T>;

type ShapeBuildProgressPanelControllerBaseProps = {
  data?: Partial<ShapeEntity>;
  nodeId?: NodeId;
  onChange?: (patch: Partial<ShapeEntity>) => void;
};

type SourceRetryConfigPatch = {
  timeoutMs: number;
  retryAttempts: number;
  retryDelay: number;
  retryLimit: number;
  retryBackoff: SourceConfig['retryBackoff'];
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
  const dispatchBuildSessionEvent = useSetAtom(dispatchBuildSessionEventAtom);
  const handleResetSessionState = useCallback(() => {
    dispatchBuildSessionEvent({ type: 'reset' });
  }, [dispatchBuildSessionEvent]);
  const core = useShapeBuildProgressPanel({ data, nodeId });
  const {
    stages,
    tasksByStage,
    summary,
    controls,
    t,
    isTasksLoading,
    isTaskSummaryLoading,
    taskListViewPhase,
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
    handleResetSession: cacheHandleResetSession,
  } = useShapeBuildCacheActions({ nodeId, onResetSession: handleResetSessionState });

  const [isResetSessionPending, setIsResetSessionPending] = useState(false);
  const [startPendingHold, setStartPendingHold] = useState(false);
  const [taskSearchText, setTaskSearchText] = useState('');
  const [stagePreviewWindowPendingMap, setStagePreviewWindowPendingMap] = useState<Record<string, boolean>>({});
  const [stagePreviewWindowOpenMap, setStagePreviewWindowOpenMap] = useState<Record<string, boolean>>({});
  const [stagePreviewWindowZIndexMap, setStagePreviewWindowZIndexMap] = useState<Record<string, number>>({
    source: 1,
    geometry: 2,
    tileEmit: 3,
  });
  const stagePreviewWindowZCounterRef = useRef(4);
  const [concurrencyEditorAnchor, setConcurrencyEditorAnchor] = useState<HTMLElement | null>(null);
  const [concurrencyEditorStageId, setConcurrencyEditorStageId] = useState<'source' | 'geometry' | 'tileEmit' | null>(null);
  const [sourceRetryEditorAnchor, setSourceRetryEditorAnchor] = useState<HTMLElement | null>(null);
  const [startupNoticeDismissed, setStartupNoticeDismissed] = useState(false);

  const isBuildSessionStarted = controls.startPending || summary.buildStatus === 'running';
  const isBuildStartupPending = controls.startPending
    && summary.buildStatus !== 'running'
    && summary.buildStatus !== 'completed'
    && summary.buildStatus !== 'failed';

  const isResetSessionLoading = isResetSessionPending || cacheDeleteLoading.resetSession;
  const isTerminalStatus = summary.buildStatus === 'completed' || summary.buildStatus === 'failed';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const hasPending = Object.values(stagePreviewWindowPendingMap).some(Boolean);
    if (!hasPending) return;
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = 'wait';
    return () => {
      document.body.style.cursor = previousCursor;
    };
  }, [stagePreviewWindowPendingMap]);

  useEffect(() => {
    if (controls.startPending) {
      setStartupNoticeDismissed(false);
      setStartPendingHold(true);
    }
  }, [controls.startPending]);

  const hasAnyTasks = useMemo(() => (
    stages.some((stage: { id: string }) => resolveStageAliasArray(tasksByStage, stage.id).length > 0)
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
    || startPendingHold
    || taskListViewPhase === 'ui-initializing';
  const isTaskSummaryLoadingForDisplay = isTaskSummaryLoading || isResetSessionLoading;
  const isStartupPendingForDisplay = isBuildStartupPending || startPendingHold;
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
  const bringStagePreviewWindowToFront = useCallback((stageId: string) => {
    setStagePreviewWindowZIndexMap((prev) => {
      const nextZIndex = stagePreviewWindowZCounterRef.current;
      stagePreviewWindowZCounterRef.current += 1;
      if (prev[stageId] === nextZIndex) return prev;
      return {
        ...prev,
        [stageId]: nextZIndex,
      };
    });
  }, []);
  const openStagePreviewWindow = useCallback((stageId: string) => {
    let changedToVisible = false;
    setStagePreviewWindowOpenMap((prev) => {
      if ((prev[stageId] ?? true) === false) return prev;
      changedToVisible = true;
      return {
        ...prev,
        [stageId]: false,
      };
    });
    if (changedToVisible) {
      setStagePreviewWindowPendingMap((prev) => ({
        ...prev,
        [stageId]: true,
      }));
      requestAnimationFrame(() => {
        setStagePreviewWindowPendingMap((prev) => ({
          ...prev,
          [stageId]: false,
        }));
      });
    }
    bringStagePreviewWindowToFront(stageId);
  }, [bringStagePreviewWindowToFront]);
  const toggleStagePreviewWindow = useCallback((stageId: string) => {
    let shouldBringToFront = false;
    setStagePreviewWindowOpenMap((prev) => {
      const isToggleOn = prev[stageId] ?? true;
      shouldBringToFront = isToggleOn;
      return {
        ...prev,
        [stageId]: !isToggleOn,
      };
    });
    if (shouldBringToFront) {
      bringStagePreviewWindowToFront(stageId);
    }
  }, [bringStagePreviewWindowToFront]);
  const closeStagePreviewWindow = useCallback((stageId: string) => {
    setStagePreviewWindowOpenMap((prev) => {
      if ((prev[stageId] ?? true) === true) return prev;
      return {
        ...prev,
        [stageId]: true,
      };
    });
  }, []);


  const stageMenus = useMemo<StageMetadataMap<BuildStepStageMenu>>(() => {
    // Remove all stage menus as requested - Build Session, Source, Geometry, TileEmit dropdown menus
    return {};
  }, []);

  const stageHeaderMeta = useMemo<StageMetadataMap<ReactNode>>(() => {
    const headerMetaByStage: Record<string, ReactNode> = {};
    for (const stage of stages) {
      const elapsedValue = formatDuration(
        summary.completedStageElapsedMs[stage.id]
        ?? (summary.timingStageId === stage.id ? summary.stageElapsedMs : undefined),
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
  }, [stages, summary.completedStageElapsedMs, summary.stageElapsedMs, summary.stageRemainingMs, summary.timingStageId, t]);

  const startupStatusMessage = controls.statusLabel?.trim()
    || t('stage.progress.startupPending', 'Preparing build session. Please wait...');
  const pauseButtonLabel = isBuildStartupPending
    ? t('stage.controls.cancelBuild', 'Cancel Build')
    : t('stage.controls.pause', 'Pause');

  const taskSearchQuery = taskSearchText.trim().toLowerCase();
  const matchesSearchQuery = useCallback((task: TaskItemWithMetadata) => {
    if (taskSearchQuery.length === 0) return true;
    const title = resolveTaskTitle(task).toLowerCase();
    const message = resolveTaskMetadataMessage(task.metadata)?.toLowerCase() ?? '';
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

  const sourceRetryConfigForEdit = useMemo(() => ({
    timeoutMs: buildConfigForEdit.sourceConfig.timeoutMs,
    retryAttempts: processingConfigForEdit.source.retryAttempts,
    retryDelay: processingConfigForEdit.source.retryDelay,
    retryLimit: processingConfigForEdit.source.retryLimit,
    retryBackoff: processingConfigForEdit.source.retryBackoff,
  }), [
    buildConfigForEdit.sourceConfig.timeoutMs,
    processingConfigForEdit.source.retryAttempts,
    processingConfigForEdit.source.retryDelay,
    processingConfigForEdit.source.retryLimit,
    processingConfigForEdit.source.retryBackoff,
  ]);

  const applyProcessingConfigUpdate = useCallback((partial: Partial<ShapeProcessingConfig>) => {
    if (!onChange) return;
    const merged = mergeProcessingConfig(processingConfigForEdit, partial);
    onChange({ processingConfig: merged });
  }, [onChange, processingConfigForEdit]);

  const applySourceRetryConfigUpdate = useCallback((next: SourceRetryConfigPatch) => {
    if (!onChange) return;
    const nextBuildConfig = applyBuildConfigPatch(buildConfigForEdit, {
      sourceConfig: {
        ...buildConfigForEdit.sourceConfig,
        timeoutMs: next.timeoutMs,
      },
    });
    const nextProcessingConfig = mergeProcessingConfig(processingConfigForEdit, {
      source: {
        ...processingConfigForEdit.source,
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

  const handleSourceRetryIndicatorClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (isBuildSessionStarted) return;
    setConcurrencyEditorAnchor(null);
    setConcurrencyEditorStageId(null);
    setSourceRetryEditorAnchor(event.currentTarget);
  }, [isBuildSessionStarted]);

  const closeSourceRetryEditor = useCallback(() => {
    setSourceRetryEditorAnchor(null);
  }, []);

  const handleStageConcurrencyIndicatorClick = useCallback((
    stageId: string,
    event: MouseEvent<HTMLElement>,
  ) => {
    if (isBuildSessionStarted) return;
    const canonicalStageId = normalizeUiStageId(stageId);
    if (!canonicalStageId) return;
    setSourceRetryEditorAnchor(null);
    setConcurrencyEditorStageId(canonicalStageId);
    setConcurrencyEditorAnchor(event.currentTarget);
  }, [isBuildSessionStarted]);

  useEffect(() => {
    if (!isBuildSessionStarted) return;
    setConcurrencyEditorAnchor(null);
    setConcurrencyEditorStageId(null);
    setSourceRetryEditorAnchor(null);
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
    isStartupPendingForDisplay,
    taskSearchText,
    setTaskSearchText,
    startupNoticeDismissed,
    setStartupNoticeDismissed,
    startupStatusMessage,
    pauseButtonLabel,
    hasAnyTasks,
    hasAnySummaryTasks,
    controlMenuItems: [], // Empty array since Build Session dropdown menu is removed
    controlMenuAriaLabel: '', // Empty string since Build Session dropdown menu is removed
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
    buildConfigForDisplay: buildConfigForEdit,
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
  });
};
