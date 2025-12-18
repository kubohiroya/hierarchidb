import { useMemo } from 'react';
import {
  Box,
  Button,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { LRUSplitView, type PaneConfig, type PaneProgress } from '@hierarchidb/ui-lru-splitview';

export type BuildStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface BuildStage {
  id: string;
  title: string;
  description?: string;
}

export interface BuildStepPanelProps {
  title: string;
  description?: string;
  status: BuildStatus;
  overallProgress: number;
  stages: BuildStage[];
  stageProgress?: Record<string, number>;
  onPause?: () => void;
  onResume?: () => void;
  onComplete?: () => void;
}

export const BuildStepPanel: React.FC<BuildStepPanelProps> = ({
  title,
  description,
  status,
  overallProgress,
  stages,
  stageProgress = {},
  onPause,
  onResume,
  onComplete,
}) => {
  const panes = useMemo<PaneConfig[]>(() =>
    stages.map((stage, index) => ({
      id: stage.id,
      title: stage.title,
      defaultExpanded: index === 0,
      content: (
        <Stack spacing={1} sx={{ p: 2 }}>
          <Typography variant="subtitle2">{stage.title}</Typography>
          {stage.description ? (
            <Typography variant="body2" color="text.secondary">
              {stage.description}
            </Typography>
          ) : null}
          <LinearProgress
            variant="determinate"
            value={Math.min(100, Math.max(0, stageProgress[stage.id] ?? overallProgress))}
          />
        </Stack>
      ),
    })),
  [overallProgress, stageProgress, stages]);

  const paneProgress = useMemo<PaneProgress[]>(
    () =>
      stages.map((stage) => ({
        paneId: stage.id,
        progress: Math.min(100, Math.max(0, stageProgress[stage.id] ?? overallProgress)),
        status,
      })),
    [overallProgress, stageProgress, stages, status],
  );

  const disablePause = status !== 'running' || !onPause;
  const disableResume = status !== 'paused' || !onResume;
  const disableComplete = (status !== 'running' && status !== 'paused') || !onComplete;

  const statusLabel = (() => {
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
    <Box display="flex" flexDirection="column" gap={3}>
      <Box>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        {description ? (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        ) : null}
      </Box>

      <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary">
          {statusLabel}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={overallProgress}
          sx={{ height: 10, borderRadius: 6 }}
        />
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center">
        <Button
          variant="outlined"
          size="small"
          startIcon={<PauseIcon fontSize="small" />}
          disabled={disablePause}
          onClick={onPause}
        >
          Pause
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<PlayArrowIcon fontSize="small" />}
          disabled={disableResume}
          onClick={onResume}
        >
          Resume
        </Button>
        <Button
          variant="contained"
          size="small"
          color="primary"
          startIcon={<CheckCircleIcon fontSize="small" />}
          disabled={disableComplete}
          onClick={onComplete}
        >
          Complete
        </Button>
      </Stack>

      <Box height={280}>
        <LRUSplitView
          panes={panes}
          progress={paneProgress}
          maxExpandedPanes={2}
          defaultCollapsedSize={60}
          autoExpand={{ onStart: true, onComplete: true }}
          height="100%"
        />
      </Box>
    </Box>
  );
};
