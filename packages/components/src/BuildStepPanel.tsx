import { type ReactNode, useCallback, useMemo } from 'react';
import { Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { LRUSplitView, type PaneConfig, type PaneProgress } from '@hierarchidb/ui-lru-splitview';
import { type BuildStage, type BuildStageContentFilter, BuildStepStagePanel } from './BuildStepStagePanel.js';
import type { BuildStepStageTaskCount } from './BuildStepStageSummaryPanel.js';
import { LoadingButton } from './LoadingButton.tsx';


export type BuildStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export type { BuildStage } from './BuildStepStagePanel.js';

export interface BuildStepPanelProps {
  status: BuildStatus;
  overallProgress: number;
  stages: BuildStage[];
  stageProgress?: Record<string, number>;
  paneProgress?: PaneProgress[];
  splitViewBreakpoints?: number[];
  splitViewInitialSizesByBreakpoint?: number[][];
  splitViewAutoCloseCountsByBreakpoint?: number[];
  renderStageContent?: (stage: BuildStage, progress: number, filter: BuildStageContentFilter) => ReactNode;
  onPause?: () => void;
  onResume?: () => void;
  onComplete?: () => void;
  controlLabel?: string;
  pauseLabel?: string;
  startLabel?: string;
  resumeLabel?: string;
  startIcon?: ReactNode;
  resumeIcon?: ReactNode;
  statusLabel?: string;
  statusContent?: ReactNode;
}

type BuildControlCardProps = {
  status: BuildStatus;
  onPause?: () => void;
  onResume?: () => void;
  controlLabel?: string;
  pauseLabel?: string;
  startLabel?: string;
  resumeLabel?: string;
  startIcon?: ReactNode;
  resumeIcon?: ReactNode;
};

const BuildControlCard: React.FC<BuildControlCardProps> = ({
  status,
  onPause,
  onResume,
  controlLabel,
  pauseLabel,
  startLabel,
  resumeLabel,
  startIcon,
  resumeIcon,
}) => {
  const computedLabel = status === 'paused'
    ? (resumeLabel ?? 'Resume Build')
    : (startLabel ?? 'Start Build');
  const computedIcon = status === 'paused'
    ? (resumeIcon ?? <PlayArrowIcon fontSize="small" />)
    : (startIcon ?? <PlayArrowIcon fontSize="small" />);
  const disablePause = status !== 'running' || !onPause;
  const disableStart = !onResume || status === 'running';
  const isLoading = status === 'running';

  return (
    <Box
      sx={{
        minWidth: 252,
        maxWidth: 312,
        width: 312,
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <Typography variant="subtitle2" color="text.secondary">
        {controlLabel ?? 'Build Controls'}
      </Typography>
      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          size="small"
          endIcon={<PauseIcon fontSize="small" />}
          disabled={disablePause}
          onClick={onPause}
        >
          {pauseLabel ?? 'Pause'}
        </Button>
        <LoadingButton
          color="secondary"
          variant="contained"
          size="large"
          endIcon={computedIcon}
          disabled={disableStart}
          onClick={onResume}
          loading={isLoading}
        >
          {computedLabel}
        </LoadingButton>
      </Stack>
    </Box>
  );
};

export const BuildStepPanel: React.FC<BuildStepPanelProps> = ({
  status,
  overallProgress,
  stages,
  stageProgress = {},
  paneProgress,
  splitViewBreakpoints,
  splitViewInitialSizesByBreakpoint,
  splitViewAutoCloseCountsByBreakpoint,
  renderStageContent,
  onPause,
  onResume,
  onComplete,
  controlLabel,
  pauseLabel,
  startLabel,
  resumeLabel,
  startIcon,
  resumeIcon,
  statusLabel,
  statusContent,
}) => {
  void onComplete;

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

  const panes = useMemo<PaneConfig[]>(() =>
    stages.map((stage, index) => ({
      id: stage.id,
      title: stage.title,
      icon: stage.icon,
      defaultExpanded: index === 0,
      content: (
        <BuildStepStagePanel
          stage={stage}
          progress={resolveStageProgress(stage.id)}
          renderStageContent={renderStageContent}
          taskCount={taskCountByStage[stage.id]}
        />
      ),
    })),
  [renderStageContent, resolveStageProgress, stages, taskCountByStage]);

  const computedStatusLabel = (() => {
    switch (status) {
      case 'running':
        return 'Build in progress';
      case 'paused':
        return 'Build paused';
      case 'completed':
        return 'Build completed';
      case 'failed':
        return 'Build failed';
      default:
        return 'Ready to start stage';
    }
  })();

  return (
    <Box display="flex" flexDirection="column" gap={3} height="100%" minHeight={0}>

      <Stack direction="row" spacing={2} alignItems="stretch" flexShrink={0}>
        <BuildControlCard
          status={status}
          onPause={onPause}
          onResume={onResume}
          controlLabel={controlLabel}
          pauseLabel={pauseLabel}
          startLabel={startLabel}
          resumeLabel={resumeLabel}
          startIcon={startIcon}
          resumeIcon={resumeIcon}
        />
        {statusContent ? (
          <Box flex={1} minWidth={0}>
            {statusContent}
          </Box>
        ) : (
          <Stack spacing={1} flex={1} justifyContent="center">
            <Typography variant="body2" color="text.secondary">
              {statusLabel ?? computedStatusLabel}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={overallProgress}
              sx={{ height: 10, borderRadius: 6, margin: 0, padding: 0, border: 0}}
            />
          </Stack>
        )}
      </Stack>

      <Box flex={1} minHeight={0}>
        <LRUSplitView
          panes={panes}
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
