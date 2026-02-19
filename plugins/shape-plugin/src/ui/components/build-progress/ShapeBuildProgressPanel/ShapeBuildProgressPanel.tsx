import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Popover,
  Snackbar,
  Stack,
  Typography,
  Tooltip,
} from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';
import DownloadingIcon from '@mui/icons-material/Downloading';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import TimelapseIcon from '@mui/icons-material/Timelapse';
import { type NodeId, toNodeType } from '@hierarchidb/core-types';
import { BuildSessionProgressPanel } from '@hierarchidb/components';
import { BuildSessionLauncherPanel } from '@hierarchidb/ui-batch-progress';
import { DownloadRetryControls, type DownloadRetryConfig, WorkerNumberConfigCard } from '@hierarchidb/ui-accordion-config';
import { TreeTableSearchInput } from '@hierarchidb/ui-search-input';
import type { TaskItemWithMetadata } from '../useTaskItemCardList.js';
import type { ShapeEntity } from '../../../../common/types/ShapeEntity.js';
import type { ShapeProcessingConfig } from '../../../../common/types/index.js';
import {
  DEFAULT_BUILD_CONFIG,
  DEFAULT_PROCESSING_CONFIG,
  mergeBuildConfig,
  mergeProcessingConfig,
} from '../../../../common/types/index.js';
import { BuildProgressStageContent } from './BuildProgressStageContent.js';
import { useShapeBuildProgressPanel } from '../useShapeBuildProgressPanel.js';
import { TaskProgressBar } from './TaskProgressBar.js';
import { useShapeBuildCacheActions } from '../../../hooks/useShapeBuildCacheActions.js';

export const ShapeBuildProgressPanel = ({
  data,
  nodeId,
  onChange,
}: {
  data?: Partial<ShapeEntity>;
  nodeId?: NodeId;
  onChange?: (patch: Partial<ShapeEntity>) => void;
}) => {
  const {
    t,
    stages,
    stageProgress,
    paneProgress,
    isTasksLoading,
    isTaskSummaryLoading,
    tasksByStage,
    summary,
    controls,
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
    resolveStatusLabel,
    resolveStatusColor,
    controlDetails,
    stageConcurrencyIndicators,
    handleStartClick,
    handleConfirmStart,
  } = useShapeBuildProgressPanel({ data, nodeId });

  const {
    counts,
    resultCounts,
    deleteLoading,
    canDeleteFetchApiCache,
    canDeleteFetchFilteredCache,
    canDeleteTransformCache,
    canDeleteVTCache,
    canDeleteMetadata,
    handleDeleteFetchApiCache,
    handleDeleteFetchFilteredCache,
    handleDeleteTransformCache,
    handleDeleteVTCache,
    handleDeleteMetadata,
    handleResetSession,
  } = useShapeBuildCacheActions({ nodeId });

  const [isResetSessionPending, setIsResetSessionPending] = useState(false);
  const [startPendingHold, setStartPendingHold] = useState(false);
  const [taskSearchText, setTaskSearchText] = useState('');
  const isResetSessionLoading = isResetSessionPending || deleteLoading.resetSession;
  const [concurrencyEditorAnchor, setConcurrencyEditorAnchor] = useState<HTMLElement | null>(null);
  const [concurrencyEditorStageId, setConcurrencyEditorStageId] = useState<'fetch' | 'transform' | 'vt' | null>(null);
  const [fetchRetryEditorAnchor, setFetchRetryEditorAnchor] = useState<HTMLElement | null>(null);
  const [startupNoticeDismissed, setStartupNoticeDismissed] = useState(false);
  const isBuildSessionStarted = controls.startPending
    || summary.buildStatus === 'running';
  const isBuildStartupPending = controls.startPending
    && summary.buildStatus !== 'running'
    && summary.buildStatus !== 'completed'
    && summary.buildStatus !== 'failed';

  const hasAnyTasks = useMemo(() => (
    stages.some((stage) => (tasksByStage[stage.id] ?? []).length > 0)
  ), [stages, tasksByStage]);
  const hasAnySummaryTasks = useMemo(() => (
    (paneProgress ?? []).some((entry) => (entry.taskCount ?? 0) > 0)
  ), [paneProgress]);
  const isTerminalStatus = summary.buildStatus === 'completed' || summary.buildStatus === 'failed';

  useEffect(() => {
    if (controls.startPending) {
      setStartupNoticeDismissed(false);
      setStartPendingHold(true);
    }
  }, [controls.startPending]);

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
      await handleResetSession();
    } finally {
      setIsResetSessionPending(false);
    }
  }, [handleResetSession, isResetSessionLoading]);

  const tasksByStageForDisplay = useMemo(() => {
    if (!isResetSessionLoading) return tasksByStage;
    return stages.reduce<Record<string, TaskItemWithMetadata[]>>((acc, stage) => {
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
    return stages.reduce<Record<string, number>>((acc, stage) => {
      acc[stage.id] = 0;
      return acc;
    }, {});
  }, [isResetSessionLoading, stageProgress, stages]);

  const isTaskSummaryLoadingForDisplay = isTaskSummaryLoading || isResetSessionLoading;
  const isTasksLoadingForDisplay = isTasksLoading
    || isResetSessionLoading
    || controls.startPending
    || startPendingHold;
  const startupStatusMessage = controls.statusLabel?.trim()
    || t('stage.progress.startupPending', 'Preparing build session. Please wait...');
  const pauseActsAsCancel = isBuildStartupPending;
  const pauseButtonLabel = pauseActsAsCancel
    ? t('stage.controls.cancelBuild', 'Cancel Build')
    : t('stage.controls.pause', 'Pause');
  const taskSearchQuery = taskSearchText.trim().toLowerCase();
  const matchesSearchQuery = useCallback((task: TaskItemWithMetadata) => {
    if (taskSearchQuery.length === 0) return true;
    const title = resolveTaskTitle(task).toLowerCase();
    const message = typeof task.message === 'string' ? task.message.toLowerCase() : '';
    return title.includes(taskSearchQuery) || message.includes(taskSearchQuery);
  }, [taskSearchQuery, resolveTaskTitle]);

  const processingConfigForEdit = useMemo<ShapeProcessingConfig>(() => {
    const draftConfig = data?.processingConfig ?? DEFAULT_PROCESSING_CONFIG;
    return mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG, draftConfig);
  }, [data]);
  const buildConfigForEdit = useMemo(
    () => mergeBuildConfig(DEFAULT_BUILD_CONFIG, data?.buildConfig),
    [data?.buildConfig],
  );
  const fetchRetryConfigForEdit = useMemo<DownloadRetryConfig>(() => ({
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
  const applyFetchRetryConfigUpdate = useCallback((next: DownloadRetryConfig) => {
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
  const closeFetchRetryEditor = useCallback(() => {
    setFetchRetryEditorAnchor(null);
  }, []);
  const handleFetchRetryIndicatorClick = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (isBuildSessionStarted) return;
    setConcurrencyEditorAnchor(null);
    setConcurrencyEditorStageId(null);
    setFetchRetryEditorAnchor(event.currentTarget);
  }, [isBuildSessionStarted]);

  useEffect(() => {
    if (!isBuildSessionStarted) return;
    setConcurrencyEditorAnchor(null);
    setConcurrencyEditorStageId(null);
    setFetchRetryEditorAnchor(null);
  }, [isBuildSessionStarted]);

  const stageConcurrencyIndicatorAriaLabels = useMemo(() => ({
    fetch: t('processing.download.workers', 'Concurrent Fetch Workers'),
    transform: t('processing.transform.workersStage1', 'Transform Workers (Simplification)'),
    vt: t('processing.tile.workers', 'Concurrent VT Workers'),
  }), [t]);
  const stageLeadingControls = useMemo(() => ({
    fetch: (
      <Tooltip title={t('processing.download.fetchRetryTitle', 'Fetch Retry')}>
        <span>
          <Button
            variant="text"
            size="small"
            aria-label={t('processing.download.fetchRetryTitle', 'Fetch Retry')}
            onClick={handleFetchRetryIndicatorClick}
            disabled={!onChange || isBuildSessionStarted}
            sx={{ minWidth: 0, px: 0.5 }}
          >
            <DownloadingIcon fontSize="small" />
          </Button>
        </span>
      </Tooltip>
    ),
  }), [handleFetchRetryIndicatorClick, isBuildSessionStarted, onChange, t]);

  const concurrencyEditorCard = useMemo(() => {
    if (!concurrencyEditorStageId) return null;
    const disabled = !onChange || isBuildSessionStarted;
    if (concurrencyEditorStageId === 'fetch') {
      return (
        <WorkerNumberConfigCard
          title={t('processing.download.workers', 'Concurrent Fetch Workers')}
          value={processingConfigForEdit.fetch.maxConcurrent}
          helperText={t('processing.download.workersHelp', 'Controls how many fetches run in parallel.')}
          warningText={undefined}
          onChange={(maxConcurrent) => {
            applyProcessingConfigUpdate({
              fetch: {
                ...processingConfigForEdit.fetch,
                maxConcurrent,
              },
            });
          }}
          min={1}
          max={4}
          step={1}
          formatLabel={(value) => t('processing.workers.countLabel', '{{count}} workers', { count: value })}
          disabled={disabled}
          disableHoverEffect
        />
      );
    }
    if (concurrencyEditorStageId === 'transform') {
      return (
        <WorkerNumberConfigCard
          title={t('processing.transform.workersStage1', 'Transform Workers (Simplification)')}
          value={processingConfigForEdit.transform.maxConcurrent}
          helperText={t(
            'processing.transform.workersStage1Help',
            'Higher concurrency can speed up processing but may exhaust browser memory.',
          )}
          warningText={undefined}
          onChange={(maxConcurrent) => {
            applyProcessingConfigUpdate({
              transform: {
                ...processingConfigForEdit.transform,
                maxConcurrent,
              },
            });
          }}
          min={1}
          max={4}
          step={1}
          formatLabel={(value) => t('processing.workers.countLabel', '{{count}} workers', { count: value })}
          disabled={disabled}
          disableHoverEffect
        />
      );
    }
    return (
      <WorkerNumberConfigCard
        title={t('processing.tile.workers', 'Concurrent VT Workers')}
        value={processingConfigForEdit.vt.maxConcurrent}
        helperText={t('processing.tile.workersHelp', 'Concurrent workers for VT generation.')}
        warningText={undefined}
        onChange={(maxConcurrent) => {
          const dynamicConcurrency = processingConfigForEdit.vt.dynamicConcurrency ?? {
            enabled: false,
            minConcurrent: maxConcurrent,
            maxConcurrent,
            highWatermark: 0.85,
            lowWatermark: 0.6,
            adjustStep: 1,
            sampleMs: 2000,
          };
          applyProcessingConfigUpdate({
            vt: {
              ...processingConfigForEdit.vt,
              maxConcurrent,
              dynamicConcurrency: {
                ...dynamicConcurrency,
                enabled: maxConcurrent >= 2,
              },
            },
          });
        }}
        min={1}
        max={8}
        step={1}
        formatLabel={(value) => t('processing.workers.countLabel', '{{count}} workers', { count: value })}
        disabled={disabled}
        disableHoverEffect
      />
    );
  }, [applyProcessingConfigUpdate, concurrencyEditorStageId, isBuildSessionStarted, onChange, processingConfigForEdit, t]);
  const fetchRetryEditorCard = useMemo(() => (
    <DownloadRetryControls
      baseRetryConfig={fetchRetryConfigForEdit}
      onChange={applyFetchRetryConfigUpdate}
      disabled={!onChange || isBuildSessionStarted}
      t={t}
      disableHoverEffect
    />
  ), [applyFetchRetryConfigUpdate, fetchRetryConfigForEdit, isBuildSessionStarted, onChange, t]);

  const stageLoadingState = useMemo(() => (
    stages.reduce<Record<string, boolean>>((acc, stage) => {
      acc[stage.id] = isResetSessionLoading;
      return acc;
    }, {})
  ), [isResetSessionLoading, stages]);

  const stageMenus = useMemo(() => {
    const menuDisabled = summary.buildStatus === 'running' || isResetSessionLoading || controls.startPending;
    const fetchApiBaseLabel = t('processing.download.deleteApiCache', 'APIキャッシュを削除');
    const fetchFilteredBaseLabel = t('processing.download.deleteFilteredCache', 'フィルター処理キャッシュを削除');
    const transformBaseLabel = t('processing.download.deleteStage1Cache', '簡略化キャッシュを削除');
    const vtBaseLabel = t('processing.download.deleteTiles', 'タイルデータを削除');
    const metadataLabel = t('processing.download.deleteMetadata', 'フィーチャーメタデータを削除');
    const resetSessionLabel = t('stage.menu.resetSession', 'Reset Session');
    const countUnit = t('processing.download.countUnit', ' items');
    const fetchApiLabel = `${fetchApiBaseLabel}(${counts.fetchApi}${countUnit})`;
    const fetchFilteredLabel = `${fetchFilteredBaseLabel}(${counts.fetchFiltered}${countUnit})`;
    const transformLabel = `${transformBaseLabel}(${counts.transform}${countUnit})`;
    const vtLabel = `${vtBaseLabel}(${counts.vt}${countUnit})`;
    const menuAriaLabel = t('stage.menu.label', 'Stage menu');

    return {
      fetch: {
        disabled: menuDisabled,
        ariaLabel: menuAriaLabel,
        items: [
          {
            id: 'fetch-api',
            label: fetchApiLabel,
            onClick: handleDeleteFetchApiCache,
            disabled: !canDeleteFetchApiCache || deleteLoading.fetchApi,
          },
          {
            id: 'fetch-filtered',
            label: fetchFilteredLabel,
            onClick: handleDeleteFetchFilteredCache,
            disabled: !canDeleteFetchFilteredCache || deleteLoading.fetchFiltered,
          },
          {
            id: 'feature-metadata',
            label: metadataLabel,
            onClick: handleDeleteMetadata,
            disabled: !canDeleteMetadata || deleteLoading.metadata || resultCounts.featureMetadata <= 0,
          },
          {
            id: 'reset-session',
            label: resetSessionLabel,
            onClick: handleResetSessionWithSkeleton,
            disabled: isResetSessionLoading,
          },
        ],
      },
      transform: {
        disabled: menuDisabled,
        ariaLabel: menuAriaLabel,
        items: [
          {
            id: 'transform',
            label: transformLabel,
            onClick: handleDeleteTransformCache,
            disabled: !canDeleteTransformCache || deleteLoading.transform,
          },
        ],
      },
      vt: {
        disabled: menuDisabled,
        ariaLabel: menuAriaLabel,
        items: [
          {
            id: 'vt',
            label: vtLabel,
            onClick: handleDeleteVTCache,
            disabled: !canDeleteVTCache || deleteLoading.vt,
          },
        ],
      },
    };
  }, [
    canDeleteFetchApiCache,
    canDeleteFetchFilteredCache,
    canDeleteMetadata,
    canDeleteTransformCache,
    canDeleteVTCache,
    counts.fetchApi,
    counts.fetchFiltered,
    counts.transform,
    counts.vt,
    deleteLoading.fetchApi,
    deleteLoading.fetchFiltered,
    deleteLoading.metadata,
    deleteLoading.transform,
    deleteLoading.vt,
    handleDeleteFetchApiCache,
    handleDeleteFetchFilteredCache,
    handleDeleteMetadata,
    handleDeleteTransformCache,
    handleDeleteVTCache,
    resultCounts.featureMetadata,
    summary.buildStatus,
    handleResetSessionWithSkeleton,
    isResetSessionLoading,
    controls.startPending,
    t,
  ]);

  const formatInlineDuration = useCallback((durationMs?: number | null) => {
    if (durationMs == null || !Number.isFinite(durationMs) || durationMs < 0) {
      return t('stage.timing.unknown', '-');
    }
    const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return t('stage.timing.inlineDuration', '{{hours}}h {{minutes}}m {{seconds}}s', {
      hours,
      minutes,
      seconds,
    });
  }, [t]);

  const buildTimingSummary = useCallback((stageId: string) => {
    const isTimingStage = Boolean(summary.timingStageId && summary.timingStageId === stageId);
    const completedElapsedMs = summary.completedStageElapsedMs[stageId];
    const elapsed = formatInlineDuration(
      isTimingStage ? summary.stageElapsedMs : completedElapsedMs ?? null,
    );
    const remaining = formatInlineDuration(isTimingStage ? summary.stageRemainingMs : null);
    const elapsedLabel = t('stage.timing.elapsedLabel', 'Elapsed');
    const remainingLabel = t('stage.timing.remainingLabel', 'Est. remaining');
    return (
      <Box
        display="grid"
        gridTemplateColumns="auto auto"
        columnGap={0.5}
        rowGap={0.25}
        sx={{ textAlign: 'right', justifyContent: 'end', alignItems: 'center' }}
      >
        <Box display="flex" alignItems="center" justifyContent="flex-end">
          <TimelapseIcon
            sx={{ fontSize: 14, color: 'text.secondary' }}
            titleAccess={elapsedLabel}
          />
        </Box>
        <Typography variant="caption" color="text.primary">
          {elapsed}
        </Typography>
        <Box display="flex" alignItems="center" justifyContent="flex-end">
          <HourglassTopIcon
            sx={{ fontSize: 14, color: 'text.secondary' }}
            titleAccess={remainingLabel}
          />
        </Box>
        <Typography variant="caption" color="text.primary">
          {remaining}
        </Typography>
      </Box>
    );
  }, [
    formatInlineDuration,
    summary.completedStageElapsedMs,
    summary.stageElapsedMs,
    summary.stageRemainingMs,
    summary.timingStageId,
    t,
  ]);

  const stageHeaderMeta = useMemo(() => (
    stages.reduce<Record<string, JSX.Element>>((acc, stage) => {
      acc[stage.id] = buildTimingSummary(stage.id);
      return acc;
    }, {})
  ), [buildTimingSummary, stages]);

  const stageProgressContent = useMemo(() => (
    stages.reduce<Record<string, JSX.Element>>((acc, stage) => {
      const stageTasks = tasksByStageForDisplay[stage.id] ?? [];
      acc[stage.id] = (
        <Stack gap={1}>
          <TaskProgressBar
            stages={[stage]}
            tasksByStage={{ [stage.id]: stageTasks }}
            stageTotals={summary.stageTotals}
            buildStatus={summary.buildStatus}
            activeStageId={summary.timingStageId ?? null}
            resolveTaskTitle={resolveTaskTitle}
          />
        </Stack>
      );
      return acc;
    }, {})
  ), [resolveTaskTitle, stages, summary.buildStatus, summary.stageTotals, summary.timingStageId, tasksByStageForDisplay]);

  const stageContents = useMemo(() => (
    stages.reduce<Record<string, JSX.Element>>((acc, stage) => {
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
    }, {})
  ), [
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

  return (
        <BuildSessionProgressPanel
          status={summary.buildStatus}
          overallProgress={summary.overallProgress}
      stages={stages}
      stageProgress={stageProgressForDisplay}
      paneProgress={paneProgressForDisplay}
      stageLoadingState={stageLoadingState}
      splitViewBreakpoints={[600, 900, 1200]}
      splitViewInitialSizesByBreakpoint={[
        Array.from({ length: stages.length }, () => 250),
        Array.from({ length: stages.length }, () => 250),
        Array.from({ length: stages.length }, () => 250),
        Array.from({ length: stages.length }, () => 250),
      ]}
      splitViewAutoCloseCountsByBreakpoint={[
        Math.max(0, stages.length - 1),
        Math.max(0, stages.length - 2),
        Math.max(0, stages.length - 3),
        0,
      ]}
      stageContents={stageContents}
      stageProgressContent={stageProgressContent}
      stageConcurrencyIndicators={stageConcurrencyIndicators}
      onStageConcurrencyIndicatorClick={isBuildSessionStarted ? undefined : handleStageConcurrencyIndicatorClick}
      stageConcurrencyIndicatorAriaLabels={stageConcurrencyIndicatorAriaLabels}
      stageLeadingControls={stageLeadingControls}
      stageMenus={stageMenus}
      stageHeaderMeta={stageHeaderMeta}
      chipPlacement="belowProgress"
      suppressStatusFallback
          startIcon={<ConstructionIcon fontSize="small" />}
          onResume={controls.canStartOrResume ? handleStartClickWithHold : undefined}
          onPause={controls.stopRequested ? undefined : controls.handlePause}
          controlLabel={t('stage.controls.title', 'Build controls')}
          pauseLabel={pauseButtonLabel}
          stopRequested={controls.stopRequested}
          pauseActsAsCancel={pauseActsAsCancel}
      startPending={controls.startPending}
      showResumeLabel={controls.showResumeLabel}
      startLabel={t('stage.controls.start', 'Start Build')}
      resumeLabel={t('stage.controls.resume', 'Resume Build')}
      statusLabel={controls.statusLabel}
      controlDetails={controlDetails}
      controlRightContent={(
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
          <BuildSessionLauncherPanel nodeType={toNodeType('shape')} excludeNodeId={nodeId} />
          <TreeTableSearchInput
            fullWidth
            value={taskSearchText}
            onChange={setTaskSearchText}
            onClear={() => setTaskSearchText('')}
            placeholder={t('stage.tasks.search', 'Search tasks')}
            sx={{
              flex: '1 1 auto',
              minWidth: 0,
              maxWidth: 250,
            }}
          />
        </Box>
      )}
      suspendDialog={{
        open: suspendSuspectOpen,
        onClose: () => suspendSuspectControls.close(),
        title: t('stage.progress.suspendSuspectTitle', 'Build tab suspended'),
        message: suspendSuspectMessage ?? t('stage.progress.suspendSuspect', 'Build is paused while another tab is in background.'),
        closeLabel: t('common.close', 'Close'),
      }}
      crashDialog={{
        open: crashSuspectOpen,
        onClose: () => crashSuspectControls.close(),
        title: t('stage.progress.crashSuspectTitle', 'Build may have stopped'),
        message: crashSuspectMessage ?? t('stage.progress.crashSuspect', 'Build session may have stopped unexpectedly.'),
        closeLabel: t('common.close', 'Close'),
      }}
      completionDialog={{
        open: completionDialogOpen,
        onClose: () => setCompletionDialogOpen(false),
        closeLabel: t('common.close', 'Close'),
        title: completionSnapshot?.status === 'completed'
          ? t('stage.progress.completedTitle', 'Build completed')
          : t('stage.progress.failedTitle', 'Build failed'),
        content: (
          <>
            <Typography variant="body2">
              {t('stage.progress.completedStageLabel', 'Stage')}: {completionSnapshot?.stageLabel ?? completionStageLabel}
            </Typography>
            {completionSnapshot?.status === 'failed' ? (
              <>
                <Typography variant="body2">
                  {t('stage.progress.failedTaskLabel', 'Task')}: {completionSnapshot?.taskTitle ?? completionTaskTitle}
                </Typography>
                <Typography variant="body2">
                  {t('stage.progress.failedMessageLabel', 'Message')}: {completionSnapshot?.taskMessage ?? completionTaskMessage}
                </Typography>
              </>
            ) : (
              <Typography variant="body2">
                {t('stage.progress.completedReasonLabel', 'Reason')}: {completionSnapshot?.reason ?? completionReason}
              </Typography>
            )}
          </>
        ),
      }}
      footer={(
        <>
          <Popover
            open={Boolean(fetchRetryEditorAnchor)}
            anchorEl={fetchRetryEditorAnchor}
            onClose={closeFetchRetryEditor}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          >
            <Box sx={{ p: 2, width: 820, maxWidth: 'calc(100vw - 24px)' }}>
              {fetchRetryEditorCard}
            </Box>
          </Popover>
          <Popover
            open={Boolean(concurrencyEditorAnchor && concurrencyEditorStageId)}
            anchorEl={concurrencyEditorAnchor}
            onClose={closeConcurrencyEditor}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          >
            <Box sx={{ p: 2, width: 360, maxWidth: 'calc(100vw - 24px)' }}>
              {concurrencyEditorCard}
            </Box>
          </Popover>
          <Snackbar
            open={isBuildStartupPending && !startupNoticeDismissed}
            onClose={(_event, reason) => {
              if (reason === 'clickaway') return;
              setStartupNoticeDismissed(true);
            }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert severity="info" variant="filled" onClose={() => setStartupNoticeDismissed(true)}>
              {startupStatusMessage}
            </Alert>
          </Snackbar>
          <Snackbar
            open={crashHintOpen}
            autoHideDuration={8000}
            onClose={() => setCrashHintOpen(false)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert severity="warning" variant="filled" onClose={() => setCrashHintOpen(false)}>
              {crashHint}
            </Alert>
          </Snackbar>
          <Dialog open={sizeWarningOpen} onClose={() => setSizeWarningOpen(false)}>
            <DialogTitle>{t('stage.warning.title', 'Build warning')}</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary">
                {warningMessage}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSizeWarningOpen(false)}>
                {t('stage.warning.confirm', 'OK')}
              </Button>
            </DialogActions>
          </Dialog>
          {startWarning ? (
            <Dialog open={warningDialogOpen} onClose={() => setWarningDialogOpen(false)}>
              <DialogTitle>{startWarning.title}</DialogTitle>
              <DialogContent>
                <Typography variant="body2" color="text.secondary">
                  {startWarning.message}
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setWarningDialogOpen(false)}>
                  {t('stage.warning.cancel', 'Cancel')}
                </Button>
                <Button variant="contained" onClick={handleConfirmStartWithHold}>
                  {t('stage.warning.proceed', 'Proceed')}
                </Button>
              </DialogActions>
            </Dialog>
          ) : null}
        </>
      )}
    />
  );
};
