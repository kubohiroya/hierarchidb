import { type MouseEvent as ReactMouseEvent, type ReactNode, useCallback, useMemo, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { LRUSplitView2, type LRUSplitView2Pane, type LRUSplitView2RenderContext, type PaneProgress } from '@hierarchidb/ui-lru-splitview';
import { BuildStepStagePanel } from './BuildStepStagePanel.tsx';
import { BuildStageFilterProvider, type BuildStageFilter } from './BuildStepStageFilterContext.tsx';
import type { BuildStepStageMenuItem, BuildStepStageTaskCount } from './BuildStepStagePanel.tsx';
import { BuildControlCard } from './BuildControlCard.tsx';
import type { BuildStage } from './BuildStage.tsx';
import type { BuildStatus } from './build-status/BuildStatus.ts';

export type BuildStepStageMenu = {
  items: BuildStepStageMenuItem[];
  disabled?: boolean;
  ariaLabel?: string;
};

export type BuildControlDetail = {
  label: ReactNode;
  value: string;
  icon?: 'timelapse';
};

export interface BuildStepPanelProps {
  status: BuildStatus;
  overallProgress: number;
  stages: BuildStage[];
  stageProgress?: Record<string, number>;
  paneProgress?: PaneProgress[];
  stageConcurrencyIndicators?: Record<string, { maxConcurrent: number; isRunning: boolean }>;
  onStageConcurrencyIndicatorClick?: (stageId: string, event: ReactMouseEvent<HTMLElement>) => void;
  stageConcurrencyIndicatorAriaLabels?: Record<string, string>;
  stageLeadingControls?: Record<string, ReactNode>;
  stageMenus?: Record<string, BuildStepStageMenu>;
  stageHeaderMeta?: Record<string, ReactNode>;
  splitViewBreakpoints?: number[];
  splitViewInitialSizesByBreakpoint?: number[][];
  splitViewAutoCloseCountsByBreakpoint?: number[];
  stageContents?: Record<string, ReactNode>;
  stageProgressContent?: Record<string, ReactNode>;
  stageLoadingState?: Record<string, boolean>;
  chipPlacement?: 'header' | 'belowProgress';
  onPause?: () => void;
  onResume?: () => void;
  onComplete?: () => void;
  controlLabel?: string;
  pauseLabel?: string;
  stopRequested?: boolean;
  pauseActsAsCancel?: boolean;
  startPending?: boolean;
  startLabel?: string;
  resumeLabel?: string;
  showResumeLabel?: boolean;
  startIcon?: ReactNode;
  resumeIcon?: ReactNode;
  statusLabel?: string;
  statusContent?: ReactNode;
  suppressStatusFallback?: boolean;
  controlDetails?: BuildControlDetail[];
  controlRightContent?: ReactNode;
}

export const BuildStepPanel: React.FC<BuildStepPanelProps> = ({
  status,
  overallProgress,
  stages,
  stageProgress = {},
  paneProgress,
  stageConcurrencyIndicators,
  onStageConcurrencyIndicatorClick,
  stageConcurrencyIndicatorAriaLabels,
  stageLeadingControls,
  stageMenus,
  stageHeaderMeta,
  splitViewBreakpoints,
  splitViewInitialSizesByBreakpoint,
  splitViewAutoCloseCountsByBreakpoint,
  stageContents,
  stageProgressContent,
  stageLoadingState,
  chipPlacement,
  onPause,
  onResume,
  onComplete,
  controlLabel,
  pauseLabel,
  stopRequested,
  pauseActsAsCancel,
  startPending,
  startLabel,
  resumeLabel,
  showResumeLabel,
  startIcon,
  resumeIcon,
  statusLabel,
  statusContent,
  suppressStatusFallback,
  controlDetails,
  controlRightContent,
}) => {
  void onComplete;

  const [stageFilters, setStageFilters] = useState<Record<string, BuildStageFilter>>({});

  const resolveStageFilter = useCallback((stageId: string): BuildStageFilter => (
    stageFilters[stageId] ?? { failedMode: true, completedMode: true, skippedMode: true }
  ), [stageFilters]);

  const updateStageFilter = useCallback((stageId: string, patch: Partial<BuildStageFilter>) => {
    setStageFilters((prev) => ({
      ...prev,
      [stageId]: {
        failedMode: true,
        completedMode: true,
        skippedMode: true,
        ...prev[stageId],
        ...patch,
      },
    }));
  }, []);

  const resolveStageProgress = useCallback((stageId: string): number =>
    Math.min(100, Math.max(0, stageProgress[stageId] ?? overallProgress)), [
    stageProgress, overallProgress
  ]);

  const computedPaneProgress = useMemo<PaneProgress[]>(
    () =>
      stages.map((stage) => ({
        paneId: stage.id,
        progress: resolveStageProgress(stage.id),
        status,
      })),
    [resolveStageProgress, stages, status],
  );

  const taskCountByStage = useMemo<Record<string, BuildStepStageTaskCount>>(() => {
    const progressList = paneProgress ?? computedPaneProgress;
    return stages.reduce<Record<string, BuildStepStageTaskCount>>((acc, stage) => {
      const progressEntry = progressList.find((entry) => entry.paneId === stage.id);
      const summary = progressEntry?.summary;
      const completed = summary?.success ?? progressEntry?.completedCount ?? 0;
      const failed = summary?.error ?? 0;
      const skipped = summary?.skip ?? 0;
      const total = summary?.total ?? progressEntry?.taskCount ?? (completed + failed + skipped);
      acc[stage.id] = {
        Completed: completed,
        Failed: failed,
        Skip: skipped,
        Total: total,
      };
      return acc;
    }, {});
  }, [computedPaneProgress, paneProgress, stages]);

  const panes = useMemo<LRUSplitView2Pane[]>(() =>
    stages.map((stage, index) => ({
      id: stage.id,
      defaultExpanded: index === 0,
    })),
  [stages]);

  const stageById = useMemo(() => new Map(stages.map((stage) => [stage.id, stage])), [stages]);

  const renderPane = useCallback(({ id, toggle }: LRUSplitView2RenderContext) => {
    const stage = stageById.get(id);
    if (!stage) return null;
    const progressValue = resolveStageProgress(id);
    const taskCount = taskCountByStage[id];
    const filter = resolveStageFilter(id);
    const indicator = stageConcurrencyIndicators?.[stage.id];
    const stageProgressNode = stageProgressContent?.[stage.id];
    const stageContentNode = stageContents?.[stage.id];
    return (
      <Box onDoubleClick={toggle} sx={{ height: '100%', minHeight: 0 }}>
        <BuildStepStagePanel
          title={stage.title}
          icon={stage.icon}
          description={stage.description}
          progress={progressValue}
          progressContent={stageProgressNode ? (
            <BuildStageFilterProvider value={filter}>
              {stageProgressNode}
            </BuildStageFilterProvider>
          ) : undefined}
          headerMeta={stageHeaderMeta?.[stage.id]}
          chipPlacement={chipPlacement}
          taskCount={taskCount}
          concurrencyIndicator={indicator ? {
            count: indicator.maxConcurrent,
            isRunning: indicator.isRunning,
          } : undefined}
          leadingControl={stageLeadingControls?.[stage.id]}
          onConcurrencyIndicatorClick={onStageConcurrencyIndicatorClick
            ? (event) => onStageConcurrencyIndicatorClick(stage.id, event)
            : undefined}
          concurrencyIndicatorAriaLabel={stageConcurrencyIndicatorAriaLabels?.[stage.id]}
          menuItems={stageMenus?.[stage.id]?.items}
          menuDisabled={stageMenus?.[stage.id]?.disabled}
          menuAriaLabel={stageMenus?.[stage.id]?.ariaLabel}
          failedMode={filter.failedMode}
          onFailedModeUpdate={(next) => updateStageFilter(id, { failedMode: next })}
          completedMode={filter.completedMode}
          onCompletedModeUpdate={(next) => updateStageFilter(id, { completedMode: next })}
          skippedMode={filter.skippedMode}
          onSkippedModeUpdate={(next) => updateStageFilter(id, { skippedMode: next })}
          loading={Boolean(stageLoadingState?.[stage.id])}
        >
          {stageContentNode ? (
            <BuildStageFilterProvider value={filter}>
              {stageContentNode}
            </BuildStageFilterProvider>
          ) : null}
        </BuildStepStagePanel>
      </Box>
    );
  }, [
    onStageConcurrencyIndicatorClick,
    resolveStageFilter,
    resolveStageProgress,
    stageById,
    stageConcurrencyIndicatorAriaLabels,
    stageConcurrencyIndicators,
    stageLeadingControls,
    stageContents,
    stageLoadingState,
    stageMenus,
    stageProgressContent,
    taskCountByStage,
    updateStageFilter,
  ]);

  const computedStatusLabel = (() => {
    switch (status) {
      case 'running':
        return 'Build in progress';
      case 'paused':
        return 'Build paused';
      case 'completed':
        return 'Build completSed';
      case 'failed':
        return 'Build failed';
      default:
        return 'Ready to start stage';
    }
  })();

  return (
    <Box display="flex" flexDirection="column" gap={1} height="100%" minHeight={0}>

      <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" flexShrink={0}>
        <BuildControlCard
          status={status}
          onPause={onPause}
          onResume={onResume}
          controlLabel={controlLabel}
          pauseLabel={pauseLabel}
          stopRequested={stopRequested}
          pauseActsAsCancel={pauseActsAsCancel}
          startPending={startPending}
          startLabel={startLabel}
          resumeLabel={resumeLabel}
          showResumeLabel={showResumeLabel}
          startIcon={startIcon}
          resumeIcon={resumeIcon}
          details={controlDetails}
          rightContent={controlRightContent}
        />
        {statusContent ? (
          <Box minWidth={0}>
            {statusContent}
          </Box>
        ) : suppressStatusFallback ? null : (
          <Stack spacing={1} justifyContent="center">
            <Typography variant="body2" color="text.secondary">
              {statusLabel ?? computedStatusLabel}
            </Typography>
          </Stack>
        )}
      </Stack>

      <Box flex={1} minHeight={0}>
        <LRUSplitView2
          panes={panes}
          renderPane={renderPane}
          progress={paneProgress ?? computedPaneProgress}
          maxExpandedPanes={2}
          responsiveBreakpoints={splitViewBreakpoints}
          initialPaneSizesByBreakpoint={splitViewInitialSizesByBreakpoint}
          autoCloseCountsByBreakpoint={splitViewAutoCloseCountsByBreakpoint}
          defaultCollapsedSize={96}
          autoExpand={{ onStart: true, onComplete: true }}
          height="100%"
        />
      </Box>
    </Box>
  );
};
