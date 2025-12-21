import { useCallback, useMemo, type ReactNode } from 'react';
import {
  Box,
  Button,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { LRUSplitView, type PaneConfig, type PaneProgress } from '@hierarchidb/ui-lru-splitview';

export type BuildStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface BuildStage {
  id: string;
  title: string;
  description?: string;
}

export interface BuildStepPanelProps {
  status: BuildStatus;
  overallProgress: number;
  stages: BuildStage[];
  stageProgress?: Record<string, number>;
  paneProgress?: PaneProgress[];
  renderStageContent?: (stage: BuildStage, progress: number) => ReactNode;
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

  return (
    <Box
      sx={{
        minWidth: 252,
        maxWidth: 312,
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
          startIcon={<PauseIcon fontSize="small" />}
          disabled={disablePause}
          onClick={onPause}
        >
          {pauseLabel ?? 'Pause'}
        </Button>
        <Button
          color="secondary"
          variant="contained"
          size="large"
          startIcon={computedIcon}
          disabled={disableStart}
          onClick={onResume}
        >
          {computedLabel}
        </Button>
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
}) => {
  void onComplete;

  const resolveStageProgress = useCallback((stageId: string): number =>
    Math.min(100, Math.max(0, stageProgress[stageId] ?? overallProgress)), [
    stageProgress, overallProgress
  ]);

  const panes = useMemo<PaneConfig[]>(() =>
    stages.map((stage, index) => ({
      id: stage.id,
      title: stage.title,
      defaultExpanded: index === 0,
      content: renderStageContent
        ? renderStageContent(stage, resolveStageProgress(stage.id))
        : (
          <Stack spacing={1} sx={{ p: 2 }}>
            <Typography variant="subtitle2">{stage.title}</Typography>
            {stage.description ? (
              <Typography variant="body2" color="text.secondary">
                {stage.description}
              </Typography>
            ) : null}
            <LinearProgress
              variant="determinate"
              value={resolveStageProgress(stage.id)}
            />
          </Stack>
        ),
    })),
  [renderStageContent, resolveStageProgress, stages]);

  const computedPaneProgress = useMemo<PaneProgress[]>(
    () =>
      stages.map((stage) => ({
        paneId: stage.id,
        progress: resolveStageProgress(stage.id),
        status,
      })),
    [resolveStageProgress, stages, status],
  );

  const computedStatusLabel = (() => {
    switch (status) {
      case 'running':
        return 'Build in progress';
      case 'paused':
        return 'Build paused';
      case 'completed':
        return 'Build completed';
      default:
        return 'Ready to start build';
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
        <Stack spacing={1} flex={1} justifyContent="center">
          <Typography variant="body2" color="text.secondary">
            {statusLabel ?? computedStatusLabel}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={overallProgress}
            sx={{ height: 10, borderRadius: 6 }}
          />
        </Stack>
      </Stack>

      <Box flex={1} minHeight={0}>
        <LRUSplitView
          panes={panes}
          progress={paneProgress ?? computedPaneProgress}
          maxExpandedPanes={2}
          defaultCollapsedSize={96}
          autoExpand={{ onStart: true, onComplete: true }}
          height="100%"
        />
      </Box>
    </Box>
  );
};
