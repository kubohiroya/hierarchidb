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
  onPause?: () => void;
  onResume?: () => void;
  onComplete?: () => void;
}

type BuildControlCardProps = {
  status: BuildStatus;
  onPause?: () => void;
  onResume?: () => void;
};

const BuildControlCard: React.FC<BuildControlCardProps> = ({ status, onPause, onResume }) => {
  const startLabel = status === 'paused' ? 'Resume Build' : 'Start Build';
  const disablePause = status !== 'running' || !onPause;
  const disableStart = !onResume || status === 'running';

  return (
    <Box
      sx={{
        minWidth: 220,
        maxWidth: 280,
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
        Build Controls
      </Typography>
      <Stack direction="row" spacing={1}>
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
          color="secondary"
          variant="contained"
          size="small"
          startIcon={<PlayArrowIcon fontSize="small" />}
          disabled={disableStart}
          onClick={onResume}
        >
          {startLabel}
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
  onPause,
  onResume,
  onComplete,
}) => {
  void onComplete;
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

      <Stack direction="row" spacing={2} alignItems="stretch">
        <BuildControlCard status={status} onPause={onPause} onResume={onResume} />
        <Stack spacing={1} flex={1} justifyContent="center">
          <Typography variant="body2" color="text.secondary">
            {statusLabel}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={overallProgress}
            sx={{ height: 10, borderRadius: 6 }}
          />
        </Stack>
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
