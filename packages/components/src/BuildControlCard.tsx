import { Box, Button, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { LoadingButton } from './LoadingButton.js';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import type { BuildStatus } from './BuildStepPanel.tsx';

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
  details?: Array<{ label: string; value: string }>;
};

export const BuildControlCard: React.FC<BuildControlCardProps> = ({
                                                             status,
                                                             onPause,
                                                             onResume,
                                                             controlLabel,
                                                             pauseLabel,
                                                             startLabel,
                                                             resumeLabel,
                                                             startIcon,
                                                             resumeIcon,
                                                             details,
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
      {details && details.length > 0 ? (
        <Stack spacing={0.5}>
          {details.map((detail) => (
            <Stack key={detail.label} direction="row" spacing={1} justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">
                {detail.label}
              </Typography>
              <Typography variant="caption">
                {detail.value}
              </Typography>
            </Stack>
          ))}
        </Stack>
      ) : null}
    </Box>
  );
};
