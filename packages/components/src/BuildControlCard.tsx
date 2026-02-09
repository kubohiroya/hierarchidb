import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
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
  pauseLoading?: boolean;
  pausePending?: boolean;
  startLabel?: string;
  resumeLabel?: string;
  showResumeLabel?: boolean;
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
  pauseLoading,
  pausePending,
  startLabel,
  resumeLabel,
  showResumeLabel,
  startIcon,
  resumeIcon,
  details,
}) => {
  const pauseSpinner = (
    <CircularProgress
      size={16}
      thickness={5}
      color="inherit"
    />
  );
  const computedPauseIcon = pauseLoading ? pauseSpinner : <PauseIcon fontSize="small" />;
  const shouldShowResume = Boolean(showResumeLabel) || status === 'paused';
  const computedLabel = shouldShowResume
    ? (resumeLabel ?? 'Resume Build')
    : (startLabel ?? 'Start Build');
  const computedIcon = shouldShowResume
    ? (resumeIcon ?? <PlayArrowIcon fontSize="small" />)
    : (startIcon ?? <PlayArrowIcon fontSize="small" />);
  const disablePause = status !== 'running' || !onPause || pauseLoading || pausePending;
  const disableStart = !onResume || status === 'running' || pausePending;
  const isLoading = status === 'running' && !pausePending;

  return (
    <Box
      sx={{
        minWidth: 0,
        maxWidth: '100%',
        width: 'auto',
        p: 1,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'nowrap',
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
        {controlLabel ?? 'Build Controls'}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ whiteSpace: 'nowrap' }}>
        <Button
          variant="outlined"
          size="small"
          endIcon={computedPauseIcon}
          disabled={disablePause}
          onClick={onPause}
        >
          {pauseLabel ?? 'Pause'}
        </Button>
        <LoadingButton
          color="secondary"
          variant="contained"
          size="small"
          endIcon={computedIcon}
          disabled={disableStart}
          onClick={onResume}
          loading={isLoading}
        >
          {computedLabel}
        </LoadingButton>
      </Stack>
      {details && details.length > 0 ? (
        <Stack direction="row" spacing={2} alignItems="center" sx={{ whiteSpace: 'nowrap' }}>
          {details.map((detail) => (
            <Box key={detail.label} display="flex" alignItems="center" gap={0.5}>
              <Typography variant="caption" color="text.secondary">
                {detail.label}
              </Typography>
              <Typography variant="caption">
                {detail.value}
              </Typography>
            </Box>
          ))}
        </Stack>
      ) : null}
    </Box>
  );
};
